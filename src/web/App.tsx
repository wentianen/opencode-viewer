import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { DetailPanel } from "./components/DetailPanel"
import { ModeBar } from "./components/ModeBar"
import { SessionTree } from "./components/SessionTree"
import { Timeline } from "./components/Timeline"
import { UsageOverview } from "./components/UsageOverview"
import { useLiveActivity } from "./hooks/useLiveActivity"
import { useReplayActivity } from "./hooks/useReplayActivity"
import type { UIRecord } from "./lib/api"
import { detailSlide, fadeUp, panelReveal } from "./motion"

export function App() {
  const [mode, setMode] = useState<"live" | "replay">("live")
  const [selectedType, setSelectedType] = useState<string>("All")
  const [selectedRecord, setSelectedRecord] = useState<UIRecord | undefined>()
  const live = useLiveActivity()
  const replay = useReplayActivity()
  const state = mode === "live" ? live : replay
  const recordTypes = Array.from(new Set(state.records.map((record) => record.type)))
  const visibleRecords = selectedType === "All"
    ? state.records
    : state.records.filter((record) => record.type === selectedType)

  useEffect(() => {
    if (selectedType !== "All" && !recordTypes.includes(selectedType)) {
      setSelectedType("All")
    }
  }, [recordTypes, selectedType])

  useEffect(() => {
    if (visibleRecords.length === 0) {
      setSelectedRecord(undefined)
      return
    }

    setSelectedRecord((current) => {
      if (current && visibleRecords.some((record) => record.id === current.id)) {
        return current
      }

      return visibleRecords[0]
    })
  }, [visibleRecords])

  return (
    <main className="app-shell">
      <motion.header className="hero-strip" {...fadeUp}>
        <div className="hero-brand">
          <p className="eyebrow">OpenCode</p>
        </div>
        <div className="hero-tools">
          <UsageOverview
            totalTokens={state.overview.totalTokens}
            totalCost={state.overview.totalCost}
            totalSessions={state.overview.totalSessions}
            totalMessages={state.overview.totalMessages}
          />
          <ModeBar mode={mode} onChange={setMode} />
        </div>
      </motion.header>

      <section className="workspace">
        <motion.div {...panelReveal} transition={{ ...panelReveal.transition, delay: 0.12 }}>
          <SessionTree sessions={state.sessions} />
        </motion.div>
        <motion.div {...panelReveal} transition={{ ...panelReveal.transition, delay: 0.18 }}>
          <Timeline
            records={visibleRecords}
            selectedID={selectedRecord?.id}
            selectedType={selectedType}
            types={recordTypes}
            onSelect={setSelectedRecord}
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
