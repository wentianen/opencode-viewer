export type SessionParentMap = Record<string, string | undefined>

export type SessionLineage = {
  sessionID: string
  parentSessionID?: string
  rootSessionID: string
  forkDepth: number
}

export function resolveSessionLineage(sessionID: string, parents: SessionParentMap): SessionLineage {
  let rootSessionID = sessionID
  let forkDepth = 0
  let cursor = parents[sessionID]

  while (cursor) {
    rootSessionID = cursor
    forkDepth += 1
    cursor = parents[cursor]
  }

  return {
    sessionID,
    parentSessionID: parents[sessionID],
    rootSessionID,
    forkDepth,
  }
}
