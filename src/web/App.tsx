import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { DetailPanel } from "./components/DetailPanel"
import { SessionTree } from "./components/SessionTree"
import { Timeline } from "./components/Timeline"
import { UsageOverview } from "./components/UsageOverview"
import { useLiveActivity } from "./hooks/useLiveActivity"
import { resolveSessionLabel, type UIRecord } from "./lib/api"
import { detailSlide, fadeUp, panelReveal } from "./motion"

export function App() {
  const [selectedType, setSelectedType] = useState<string>("All")
  const [selectedRecord, setSelectedRecord] = useState<UIRecord | undefined>()
  const [selectedSessionID, setSelectedSessionID] = useState<string | undefined>()
  const state = useLiveActivity()
  const sessions = state.sessions.map((session) => ({
    ...session,
    label: resolveSessionLabel(session, state.records),
  }))
  const activeSessionID = selectedSessionID ?? selectedRecord?.sessionID ?? sessions[0]?.sessionID
  const sessionRecords = activeSessionID
    ? state.records.filter((record) => record.sessionID === activeSessionID)
    : state.records
  const recordKinds = Array.from(new Set(sessionRecords.map((record) => record.kind)))
  const sessionStats = selectedSessionID ? (() => {
    const toolCallRecords = sessionRecords.filter(
      (r) => r.kind === "tool" && r.type === "tool.execute.after",
    )
    const toolCallsByType: Record<string, number> = {}
    for (const r of toolCallRecords) {
      const toolName = r.target.startsWith("tool:") ? r.target.slice(5) : r.target
      toolCallsByType[toolName] = (toolCallsByType[toolName] ?? 0) + 1
    }
    return {
      tokens: sessionRecords.reduce((sum, r) => sum + r.usageTotal, 0),
      toolCalls: toolCallRecords.length,
      userMessages: sessionRecords.filter((r) => r.kind === "chat" && r.actor === "user").length,
      toolCallsByType,
    }
  })() : undefined
  const typeCounts = sessionRecords.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + 1
    return acc
  }, {})
  const visibleRecords = selectedType === "All"
    ? sessionRecords
    : sessionRecords.filter((record) => record.kind === selectedType)

  const handleRecordSelect = (record: UIRecord) => {
    setSelectedRecord(record)
    setSelectedSessionID(record.sessionID)
  }

  const handleSessionSelect = (sessionID: string) => {
    setSelectedSessionID(sessionID)
    const nextSessionRecords = state.records.filter((record) => record.sessionID === sessionID)
    const nextRecord = (
      selectedType === "All"
        ? nextSessionRecords
        : nextSessionRecords.filter((record) => record.type === selectedType)
    )[0] ?? nextSessionRecords[0]

    if (!nextRecord) return

    if (selectedType !== "All" && !nextSessionRecords.some((record) => record.kind === selectedType)) {
      setSelectedType("All")
    }

    setSelectedRecord(nextRecord)
  }

  useEffect(() => {
    if (selectedType !== "All" && !recordKinds.includes(selectedType)) {
      setSelectedType("All")
    }
  }, [recordKinds, selectedType])

  useEffect(() => {
    if (visibleRecords.length === 0) {
      setSelectedRecord(undefined)
      setSelectedSessionID(undefined)
      return
    }

    setSelectedRecord((current) => {
      if (current && visibleRecords.some((record) => record.id === current.id)) {
        return current
      }

      return visibleRecords[0]
    })
  }, [visibleRecords])

  useEffect(() => {
    if (!selectedRecord) return
    setSelectedSessionID(selectedRecord.sessionID)
  }, [selectedRecord])

  return (
    <main className="app-shell">
      <motion.header className="hero-strip" {...fadeUp}>
        <div className="hero-brand">
          <div className="brand-lockup">
            <h1 className="brand-wordmark"><span className="brand-accent">◈</span> OpenCode</h1>
            <span className="brand-subtitle">Activity Viewer</span>
          </div>
        </div>
        <div className="hero-tools">
          <UsageOverview
            totalTokens={state.overview.totalTokens}
            totalCost={state.overview.totalCost}
            totalSessions={state.overview.totalSessions}
            totalMessages={state.overview.totalMessages}
          />
        </div>
      </motion.header>

      <section className="workspace">
        <motion.div {...panelReveal} transition={{ ...panelReveal.transition, delay: 0.12 }}>
          <SessionTree
            sessions={sessions}
            selectedID={selectedSessionID}
            stats={sessionStats}
            onSelect={handleSessionSelect}
          />
        </motion.div>
        <motion.div {...panelReveal} transition={{ ...panelReveal.transition, delay: 0.18 }}>
          <Timeline
            records={visibleRecords}
            selectedID={selectedRecord?.id}
            selectedType={selectedType}
            types={recordKinds}
            typeCounts={typeCounts}
            totalCount={sessionRecords.length}
            onSelect={handleRecordSelect}
            onTypeChange={setSelectedType}
          />
        </motion.div>
        <motion.div {...detailSlide} transition={{ ...detailSlide.transition, delay: 0.22 }}>
          <DetailPanel record={selectedRecord} />
        </motion.div>
      </section>
    </main>
  )
}

export default App
