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
  type: string
  actor: string
  target: string
  summary: string
  payload: Record<string, unknown>
  usage?: {
    total?: number
  }
}

export type UISession = {
  sessionID: string
  label: string
  subtreeTokens: number
  cost: number
  depth: number
  active: boolean
}

export type UIRecord = {
  id: string
  type: string
  actor: string
  target: string
  summary: string
  payload: Record<string, unknown>
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
    subtreeTokens: session.subtreeTotals.tokens,
    cost: session.subtreeTotals.cost,
    depth: session.forkDepth,
    active: session.forkDepth === 0,
  }))
}

export function mapRecords(records: RecordResponse[]): UIRecord[] {
  return records.map((record) => ({
    id: record.id,
    type: record.type,
    actor: record.actor,
    target: record.target,
    summary: record.summary,
    payload: record.payload,
    usageLabel: `${record.usage?.total ?? 0} tok`,
  }))
}

export async function getSessions(): Promise<UISession[]> {
  return mapSessions(await fetchJSON<SessionResponse[]>("/api/sessions"))
}

export async function getRecords(): Promise<UIRecord[]> {
  return mapRecords(await fetchJSON<RecordResponse[]>("/api/records"))
}
