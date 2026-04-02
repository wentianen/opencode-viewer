import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import type { UIRecord } from "../lib/api"

// ── colour tokens per kind ────────────────────────────────────────────────────
const KIND_COLOR: Record<string, string> = {
  chat: "var(--c-chat)",
  message: "var(--c-message)",
  tool: "var(--c-tool)",
  session: "var(--c-session)",
  system: "var(--c-system)",
}

// ── strip well-known prefixes so badges are compact ───────────────────────────
function shortLabel(value: string): string {
  return value
    .replace(/^agent:/, "")
    .replace(/^tool:/, "")
    .replace(/^model:/, "")
    .replace(/^message:.*/, "message")
    .replace(/^command:/, "cmd:")
}

// ── badge colour class by prefix ─────────────────────────────────────────────
function actorClass(value: string): string {
  if (value === "user") return "badge badge-user"
  if (value.startsWith("agent:")) return "badge badge-agent"
  if (value === "system") return "badge badge-system"
  return "badge badge-neutral"
}

function targetClass(value: string): string {
  if (value.startsWith("tool:") || value.startsWith("command:")) return "badge badge-tool"
  if (value.startsWith("model:")) return "badge badge-model"
  if (value.startsWith("agent:")) return "badge badge-agent"
  if (value === "session") return "badge badge-session"
  if (value === "permission") return "badge badge-system"
  return "badge badge-neutral"
}

// ── collapsed display record ──────────────────────────────────────────────────
type DisplayRecord = UIRecord & {
  pendingArgs?: unknown
}

// ── collapse noisy repeated records into single representative rows ───────────
function collapseRecords(records: UIRecord[]): DisplayRecord[] {
  // Pass 1: merge tool before/after pairs
  const beforeByCallID: Record<string, UIRecord> = {}
  const pass1: DisplayRecord[] = []

  for (const r of records) {
    if (r.kind === "tool" && r.type === "tool.execute.before") {
      const callID = (r.rawPayload as any)?.callID ?? r.id
      beforeByCallID[callID] = r
      continue
    }
    if (r.kind === "tool" && r.type === "tool.execute.after") {
      const callID = (r.rawPayload as any)?.callID ?? r.id
      const before = beforeByCallID[callID]
      if (before) {
        delete beforeByCallID[callID]
        pass1.push({ ...r, pendingArgs: (before.rawPayload as any)?.args })
      } else {
        pass1.push(r)
      }
      continue
    }
    pass1.push(r)
  }
  // unmatched before records — show as pending
  for (const r of Object.values(beforeByCallID)) {
    pass1.push({ ...r, type: "tool.execute.before" })
  }

  // Pass 2: global deduplication — keep only the final record per message/session.
  // Pre-scan: for each messageID find the best record
  //   • message.updated beats message.part.updated (it's the complete final state)
  //   • within the same type, last occurrence wins
  const msgWinners = new Map<string, DisplayRecord>()
  let lastSessionUpdated: DisplayRecord | null = null

  for (const r of pass1) {
    if (r.type === "message.part.updated" || r.type === "message.updated") {
      const key = (r.rawPayload as any)?.messageID ?? r.id
      const prev = msgWinners.get(key)
      if (!prev || prev.type === "message.part.updated" || r.type === prev.type) {
        msgWinners.set(key, r)
      }
    } else if (r.type === "session.updated") {
      lastSessionUpdated = r
    }
  }

  // Emit pass: each group emits its winner at the position of the first occurrence,
  // all subsequent records for that group are skipped.
  const emittedMsgKeys = new Set<string>()
  let sessionUpdatedEmitted = false
  const result: DisplayRecord[] = []

  for (const r of pass1) {
    if (r.type === "message.part.updated" || r.type === "message.updated") {
      const key = (r.rawPayload as any)?.messageID ?? r.id
      if (emittedMsgKeys.has(key)) continue
      emittedMsgKeys.add(key)
      result.push(msgWinners.get(key)!)
    } else if (r.type === "session.updated") {
      if (sessionUpdatedEmitted) continue
      sessionUpdatedEmitted = true
      if (lastSessionUpdated) result.push(lastSessionUpdated)
    } else {
      result.push(r)
    }
  }

  return result
}

// ── indentation level per kind ────────────────────────────────────────────────
function indentLevel(record: DisplayRecord): number {
  if (record.kind === "chat") return 0
  if (record.kind === "session") return 0
  if (record.kind === "system") return 0
  if (record.kind === "message") return 1
  if (record.kind === "tool") return 1
  return 0
}

// ── human-readable event label ────────────────────────────────────────────────
function eventLabel(record: DisplayRecord): string {
  if (record.kind === "chat") {
    const text = (record.rawPayload as any)?.text ?? record.summary
    if (typeof text === "string" && text.trim()) {
      return text.length > 120 ? `${text.slice(0, 120).trimEnd()}…` : text
    }
  }
  if (record.kind === "tool") {
    const toolName = record.target.startsWith("tool:") ? record.target.slice(5) : record.target
    const title = (record.rawPayload as any)?.title
    return title ? `${toolName} — ${title}` : toolName
  }
  if (record.kind === "message") {
    if (record.type === "message.updated") {
      const model = record.target.startsWith("model:") ? record.target.slice(6) : record.target
      return model !== "session" ? model : record.summary
    }
    return record.summary
  }
  return record.summary
}

// ── type badge text ───────────────────────────────────────────────────────────
function typeBadge(record: DisplayRecord): string {
  if (record.type === "tool.execute.after") return "tool ✓"
  if (record.type === "tool.execute.before") return "tool …"
  if (record.type === "chat.message") return "chat"
  if (record.type === "message.updated") return "llm"
  if (record.type === "message.part.updated") return "stream"
  if (record.type === "session.updated") return "session"
  return record.type.split(".").slice(-1)[0] ?? record.type
}

// ── group records: level-0 as parents, level-1 as children ───────────────────
type RecordGroup = {
  parent: DisplayRecord
  children: DisplayRecord[]
}

function groupRecords(records: DisplayRecord[]): RecordGroup[] {
  const groups: RecordGroup[] = []
  let i = 0
  while (i < records.length) {
    const r = records[i]
    if (indentLevel(r) === 0) {
      const group: RecordGroup = { parent: r, children: [] }
      i++
      while (i < records.length && indentLevel(records[i]) > 0) {
        group.children.push(records[i])
        i++
      }
      groups.push(group)
    } else {
      // orphan indented record (e.g. when type filter hides the parent)
      groups.push({ parent: r, children: [] })
      i++
    }
  }
  return groups
}

export function Timeline(props: {
  records: UIRecord[]
  types: string[]
  typeCounts: Record<string, number>
  totalCount: number
  selectedType: string
  selectedID?: string
  onSelect: (record: UIRecord) => void
  onTypeChange: (type: string) => void
}) {
  const displayRecords = useMemo(() => collapseRecords(props.records), [props.records])
  const groups = useMemo(() => groupRecords(displayRecords), [displayRecords])
  const [expandedIDs, setExpandedIDs] = useState<Set<string>>(() => new Set())

  const toggleGroup = (id: string) => {
    setExpandedIDs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Auto-expand the group containing the externally-selected child record
  useEffect(() => {
    if (!props.selectedID) return
    for (const group of groups) {
      if (group.children.some((c) => c.id === props.selectedID)) {
        setExpandedIDs((prev) => new Set([...prev, group.parent.id]))
        break
      }
    }
  }, [props.selectedID, groups])

  const renderRow = (record: DisplayRecord, isChild: boolean) => {
    const kindColor = KIND_COLOR[record.kind] ?? "var(--c-neutral)"
    const isPending = record.type === "tool.execute.before"
    const isSelected = props.selectedID === record.id
    return (
      <button
        key={record.id}
        className={[
          "timeline-row",
          isSelected ? "is-selected" : "",
          isChild ? "timeline-row-child" : "",
        ].filter(Boolean).join(" ")}
        onClick={() => props.onSelect(record)}
        type="button"
      >
        <span className="tl-stripe" style={{ background: kindColor }} aria-hidden />
        <span className="tl-body" style={isChild ? { paddingLeft: "24px" } : undefined}>
          <span className="tl-route">
            <span className={actorClass(record.actor)}>{shortLabel(record.actor)}</span>
            <span className="tl-arrow" aria-hidden>→</span>
            <span className={targetClass(record.target)}>{shortLabel(record.target)}</span>
            <span className={`tl-type-pill${isPending ? " tl-type-pill-pending" : ""}`}>
              {typeBadge(record)}
            </span>
          </span>
            <span className="tl-summary">
              <span className={isPending ? "tl-summary-text tl-summary-muted" : "tl-summary-text"}>
                {eventLabel(record)}
              </span>
              {record.usageTotal > 0 && (
                <span className="tl-tokens" title={record.usageTitle}>{record.usageLabel}</span>
              )}
            </span>
        </span>
      </button>
    )
  }

  return (
    <section className="panel panel-timeline" aria-label="Timeline">
      <div className="panel-header panel-header-stack">
        <div className="panel-header-copy">
          <p className="section-label">Timeline</p>
          <span>Interaction flow</span>
        </div>
        <div className="timeline-filter-bar" aria-label="Timeline type filters">
          {["All", ...props.types].map((type) => {
            const count = type === "All" ? props.totalCount : (props.typeCounts[type] ?? 0)
            return (
              <button
                className={props.selectedType === type ? "timeline-filter is-active" : "timeline-filter"}
                key={type}
                onClick={() => props.onTypeChange(type)}
                type="button"
              >
                {type}
                <span className="timeline-filter-count">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="timeline-list panel-scroll-region">
        {groups.map((group) => {
          const { parent, children } = group
          const hasChildren = children.length > 0
          const isExpanded = expandedIDs.has(parent.id)
          const kindColor = KIND_COLOR[parent.kind] ?? "var(--c-neutral)"
          const isPending = parent.type === "tool.execute.before"
          const isSelected = props.selectedID === parent.id

          // No children — render as a plain row
          if (!hasChildren) {
            return renderRow(parent, false)
          }

          // Has children — render as collapsible group
          return (
            <div key={parent.id} className="tl-group">
              <button
                className={["timeline-row", isSelected ? "is-selected" : ""].filter(Boolean).join(" ")}
                onClick={() => {
                  props.onSelect(parent)
                  toggleGroup(parent.id)
                }}
                type="button"
              >
                <span className="tl-stripe" style={{ background: kindColor }} aria-hidden />
                <span className="tl-body">
                  <span className="tl-route">
                    <span className={actorClass(parent.actor)}>{shortLabel(parent.actor)}</span>
                    <span className="tl-arrow" aria-hidden>→</span>
                    <span className={targetClass(parent.target)}>{shortLabel(parent.target)}</span>
                    <span className={`tl-type-pill${isPending ? " tl-type-pill-pending" : ""}`}>
                      {typeBadge(parent)}
                    </span>
                    <span className={`tl-chevron${isExpanded ? " is-open" : ""}`} aria-hidden>
                      <span className="tl-chevron-icon">›</span>
                      {!isExpanded && (
                        <span className="tl-chevron-count">{children.length}</span>
                      )}
                    </span>
                  </span>
                  <span className="tl-summary">
                    <span className={isPending ? "tl-summary-text tl-summary-muted" : "tl-summary-text"}>
                      {eventLabel(parent)}
                    </span>
                    {parent.usageTotal > 0 && (
                      <span className="tl-tokens" title={parent.usageTitle}>{parent.usageLabel}</span>
                    )}
                  </span>
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="children"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="tl-children">
                      {children.map((child) => renderRow(child, true))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {groups.length === 0 && (
          <div className="timeline-empty">
            <p>No matching records</p>
            <span>Adjust the type filter to widen the timeline.</span>
          </div>
        )}
      </div>
    </section>
  )
}
