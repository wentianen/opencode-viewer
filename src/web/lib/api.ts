type OverviewResponse = {
  totalTokens: number
  totalCost: number
  totalSessions: number
  totalMessages: number
}

type SessionResponse = {
  sessionID: string
  parentSessionID?: string
  rootSessionID: string
  forkDepth: number
  firstTs: number
  selfTotals: {
    tokens: number
    cost: number
    messages: number
  }
  subtreeTotals: {
    tokens: number
    cost: number
    messages: number
  }
}

type RecordResponse = {
  id: string
  sessionID: string
  rootSessionID: string
  kind: string
  type: string
  actor: string
  target: string
  summary: string
  rawPayload?: Record<string, unknown>
  payload: Record<string, unknown>
  usage?: {
    total?: number
  }
}

export type UISession = {
  sessionID: string
  label: string
  fallbackLabel: string
  subtreeTokens: number
  cost: number
  depth: number
  firstTs: number
}

export type UIRecord = {
  id: string
  sessionID: string
  rootSessionID: string
  kind: string
  type: string
  actor: string
  target: string
  summary: string
  rawPayload: Record<string, unknown>
  payload: Record<string, unknown>
  usageTotal: number
  usageLabel: string
}

export type StreamSnapshot = {
  overview: OverviewResponse
  sessions: SessionResponse[]
  records: RecordResponse[]
}

const baseUrl = () => {
  const configured = import.meta.env.VITE_ACTIVITY_VIEWER_API_URL
  return configured?.replace(/\/$/, "") || "http://127.0.0.1:4310"
}

async function fetchJSON<T>(pathname: string): Promise<T> {
  const response = await fetch(`${baseUrl()}${pathname}`)
  if (!response.ok) {
    throw new Error(`Request failed for ${pathname}`)
  }
  return await response.json()
}

export async function getOverview(): Promise<OverviewResponse> {
  return await fetchJSON<OverviewResponse>("/api/overview")
}

export function mapSessions(sessions: SessionResponse[]): UISession[] {
  return sessions.map((session) => ({
    sessionID: session.sessionID,
    label: session.forkDepth === 0 ? "Root Session" : `Fork #${session.forkDepth}`,
    fallbackLabel: session.forkDepth === 0 ? "Root Session" : `Fork #${session.forkDepth}`,
    subtreeTokens: session.subtreeTotals.tokens,
    cost: session.subtreeTotals.cost,
    depth: session.forkDepth,
    firstTs: session.firstTs,
  }))
}

export function mapRecords(records: RecordResponse[]): UIRecord[] {
  return records.map((record) => ({
    id: record.id,
    sessionID: record.sessionID,
    rootSessionID: record.rootSessionID,
    kind: record.kind,
    type: record.type,
    actor: record.actor,
    target: record.target,
    summary: record.summary,
    rawPayload: record.rawPayload ?? record.payload,
    payload: record.payload,
    usageTotal: record.usage?.total ?? 0,
    usageLabel: `${record.usage?.total ?? 0} tok`,
  }))
}

const sessionLabelMaxLength = 42

function compactLabel(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim()
  if (trimmed.length <= sessionLabelMaxLength) return trimmed
  return `${trimmed.slice(0, sessionLabelMaxLength - 1).trimEnd()}…`
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

export function resolveSessionLabel(session: UISession, records: UIRecord[]) {
  const firstPrompt = records.find((record) => {
    if (record.sessionID !== session.sessionID) return false
    if (record.type !== "chat.message") return false
    return record.actor === "user" && Boolean(readString(record.rawPayload.text) ?? readString(record.payload.text) ?? readString(record.summary))
  })

  const firstPromptText = firstPrompt
    ? readString(firstPrompt.rawPayload.text) ?? readString(firstPrompt.payload.text) ?? readString(firstPrompt.summary)
    : undefined
  if (firstPromptText) {
    return compactLabel(firstPromptText)
  }

  const titledSession = records.find((record) => {
    if (record.sessionID !== session.sessionID) return false
    if (!record.type.startsWith("session.")) return false
    return Boolean(readString(record.rawPayload.title) ?? readString(record.payload.title))
  })

  const titledSessionText = titledSession
    ? readString(titledSession.rawPayload.title) ?? readString(titledSession.payload.title)
    : undefined
  if (titledSessionText) {
    return compactLabel(titledSessionText)
  }

  return session.fallbackLabel
}

export async function getSessions(): Promise<UISession[]> {
  return mapSessions(await fetchJSON<SessionResponse[]>("/api/sessions"))
}

export async function getRecords(): Promise<UIRecord[]> {
  return mapRecords(await fetchJSON<RecordResponse[]>("/api/records"))
}
