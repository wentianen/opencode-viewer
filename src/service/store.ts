import fs from "node:fs/promises"
import path from "node:path"
import { ActivityRecordSchema, type ActivityRecord } from "../shared/schema"

type UsageLike = {
  total: number
  cost: number
}

type AggregateSeed = {
  sessionID: string
  parentSessionID?: string
  rootSessionID: string
  forkDepth: number
  firstTs?: number
  usage?: UsageLike
}

type SessionTotals = {
  tokens: number
  cost: number
  messages: number
}

const roundCost = (value: number) => Math.round(value * 1_000_000) / 1_000_000

export type SessionTreeAggregate = {
  sessionID: string
  parentSessionID?: string
  rootSessionID: string
  forkDepth: number
  firstTs: number
  selfTotals: SessionTotals
  subtreeTotals: SessionTotals
}

export type ActivityOverview = {
  totalTokens: number
  totalCost: number
  totalSessions: number
  totalMessages: number
}

export type ActivityStore = {
  records: ActivityRecord[]
  listSessions: () => SessionTreeAggregate[]
  listRecords: () => ActivityRecord[]
  getOverview: () => ActivityOverview
}

const createTotals = (): SessionTotals => ({
  tokens: 0,
  cost: 0,
  messages: 0,
})

const ensureAggregate = (
  aggregates: Record<string, SessionTreeAggregate>,
  sessionID: string,
  parents: Record<string, string | undefined>,
  seed?: Partial<AggregateSeed>,
) => {
  if (aggregates[sessionID]) return aggregates[sessionID]

  const parentSessionID = seed?.parentSessionID ?? parents[sessionID]
  let rootSessionID = seed?.rootSessionID ?? sessionID
  let forkDepth = seed?.forkDepth ?? 0

  if (!seed?.rootSessionID) {
    let cursor = parentSessionID
    rootSessionID = sessionID
    forkDepth = 0

    while (cursor) {
      rootSessionID = cursor
      forkDepth += 1
      cursor = parents[cursor]
    }
  }

  aggregates[sessionID] = {
    sessionID,
    parentSessionID,
    rootSessionID,
    forkDepth,
    firstTs: seed?.firstTs ?? 0,
    selfTotals: createTotals(),
    subtreeTotals: createTotals(),
  }

  return aggregates[sessionID]
}

export function buildSessionTreeTotals(
  records: AggregateSeed[],
  parents: Record<string, string | undefined>,
): Record<string, SessionTreeAggregate> {
  const aggregates: Record<string, SessionTreeAggregate> = {}

  for (const record of records) {
    const entry = ensureAggregate(aggregates, record.sessionID, parents, record)
    const tokens = record.usage?.total ?? 0
    const cost = record.usage?.cost ?? 0

    entry.selfTotals.tokens += tokens
    entry.selfTotals.cost = roundCost(entry.selfTotals.cost + cost)
    entry.selfTotals.messages += 1
  }

  for (const entry of Object.values(aggregates)) {
    entry.subtreeTotals.tokens += entry.selfTotals.tokens
    entry.subtreeTotals.cost = roundCost(entry.subtreeTotals.cost + entry.selfTotals.cost)
    entry.subtreeTotals.messages += entry.selfTotals.messages

    let cursor = parents[entry.sessionID]
    while (cursor) {
      const parent = ensureAggregate(aggregates, cursor, parents)
      parent.subtreeTotals.tokens += entry.selfTotals.tokens
      parent.subtreeTotals.cost = roundCost(parent.subtreeTotals.cost + entry.selfTotals.cost)
      parent.subtreeTotals.messages += entry.selfTotals.messages
      cursor = parents[cursor]
    }
  }

  return aggregates
}

async function readJsonlFile(filePath: string) {
  const content = await fs.readFile(filePath, "utf8")

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ActivityRecordSchema.parse(JSON.parse(line)))
}

export async function readActivityRecords(logDir: string) {
  const entries = await fs.readdir(logDir, { withFileTypes: true }).catch(() => [])
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
  const groups = await Promise.all(files.map((entry) => readJsonlFile(path.join(logDir, entry.name))))

  return groups.flat().sort((left, right) => left.ts - right.ts)
}

function buildOverview(records: ActivityRecord[]): ActivityOverview {
  return {
    totalTokens: records.reduce((total, record) => total + (record.usage?.total ?? 0), 0),
    totalCost: roundCost(records.reduce((total, record) => total + (record.usage?.cost ?? 0), 0)),
    totalSessions: new Set(records.map((record) => record.sessionID)).size,
    totalMessages: records.length,
  }
}

export async function createActivityStore(logDir: string): Promise<ActivityStore> {
  const records = await readActivityRecords(logDir)
  const parents = Object.fromEntries(records.map((record) => [record.sessionID, record.parentSessionID]))
  const sessionFirstTs: Record<string, number> = {}
  for (const record of records) {
    if (sessionFirstTs[record.sessionID] === undefined) {
      sessionFirstTs[record.sessionID] = record.ts
    }
  }

  const aggregateMap = buildSessionTreeTotals(
    records.map((record) => ({
      sessionID: record.sessionID,
      parentSessionID: record.parentSessionID,
      rootSessionID: record.rootSessionID,
      forkDepth: record.forkDepth,
      firstTs: sessionFirstTs[record.sessionID],
      usage: record.usage ? { total: record.usage.total, cost: record.usage.cost } : undefined,
    })),
    parents,
  )

  const sessions = Object.values(aggregateMap).sort(
    (left, right) => (right.firstTs ?? 0) - (left.firstTs ?? 0),
  )
  const overview = buildOverview(records)

  return {
    records,
    listSessions: () => sessions,
    listRecords: () => records,
    getOverview: () => overview,
  }
}
