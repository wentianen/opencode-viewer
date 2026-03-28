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
  const [selectedRecord, setSelectedRecord] = useState<UIRecord | undefined>()
  const live = useLiveActivity()
  const replay = useReplayActivity()
  const state = mode === "live" ? live : replay

  useEffect(() => {
    setSelectedRecord(state.records[0])
  }, [state.records])

  return (
    <main className="app-shell">
      <motion.header className="hero-strip" {...fadeUp}>
        <div>
          <p className="eyebrow">OpenCode</p>
          <h1>Activity Viewer</h1>
        </div>
        <ModeBar mode={mode} onChange={setMode} />
      </motion.header>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 }}>
        <UsageOverview
          totalTokens={state.overview.totalTokens}
          totalCost={state.overview.totalCost}
          totalSessions={state.overview.totalSessions}
          totalMessages={state.overview.totalMessages}
        />
      </motion.div>

      <section className="workspace">
        <motion.div {...panelReveal} transition={{ ...panelReveal.transition, delay: 0.12 }}>
          <SessionTree sessions={state.sessions} />
        </motion.div>
        <motion.div {...panelReveal} transition={{ ...panelReveal.transition, delay: 0.18 }}>
          <Timeline records={state.records} selectedID={selectedRecord?.id} onSelect={setSelectedRecord} />
        </motion.div>
        <motion.div {...detailSlide} transition={{ ...detailSlide.transition, delay: 0.22 }}>
          <DetailPanel record={selectedRecord} />
        </motion.div>
      </section>
    </main>
  )
}

export default App
