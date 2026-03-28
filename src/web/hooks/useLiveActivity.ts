import { useEffect, useState } from "react"
import {
  getOverview,
  getRecords,
  getSessions,
  mapRecords,
  mapSessions,
  type StreamSnapshot,
  type UIRecord,
} from "../lib/api"

type OverviewState = {
  totalTokens: number
  totalCost: number
  totalSessions: number
  totalMessages: number
}

type UISessionState = {
  sessionID: string
  label: string
  subtreeTokens: number
  cost: number
  depth: number
  active: boolean
}

const emptyOverview = (): OverviewState => ({
  totalTokens: 0,
  totalCost: 0,
  totalSessions: 0,
  totalMessages: 0,
})

function applySnapshot(data: StreamSnapshot, update: {
  setOverview: (overview: OverviewState) => void
  setSessions: (sessions: UISessionState[]) => void
  setRecords: (records: UIRecord[]) => void
}) {
  update.setOverview(data.overview)
  update.setSessions(mapSessions(data.sessions))
  update.setRecords(mapRecords(data.records))
}

export function useLiveActivity() {
  const [overview, setOverview] = useState<OverviewState>(emptyOverview)
  const [sessions, setSessions] = useState<UISessionState[]>([])
  const [records, setRecords] = useState<UIRecord[]>([])

  useEffect(() => {
    void getOverview().then(setOverview).catch(() => setOverview(emptyOverview()))
    void getSessions().then(setSessions).catch(() => setSessions([]))
    void getRecords().then(setRecords).catch(() => setRecords([]))

    if (typeof EventSource === "undefined") return

    const source = new EventSource(
      `${import.meta.env.VITE_ACTIVITY_VIEWER_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:4310"}/api/stream`,
    )

    source.addEventListener("snapshot", (event) => {
      const message = event as MessageEvent<string>
      applySnapshot(JSON.parse(message.data) as StreamSnapshot, {
        setOverview,
        setSessions,
        setRecords,
      })
    })

    return () => {
      source.close()
    }
  }, [])

  return { overview, sessions, records }
}
