import { formatTokenCount, formatTokenTitle } from "../lib/format"

function formatSessionTime(ts: number): string {
  if (!ts) return "—"
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function SessionTree(props: {
  sessions: Array<{
    sessionID: string
    label: string
    subtreeTokens: number
    cost: number
    depth: number
    firstTs: number
  }>
  selectedID?: string
  stats?: {
    tokens: number
    toolCalls: number
    userMessages: number
    toolCallsByType: Record<string, number>
  }
  onSelect: (sessionID: string) => void
}) {
  return (
    <section className="panel panel-tree" aria-label="Session List">
      <div className="panel-header">
        <p className="section-label">Session List</p>
      </div>
      <div className="session-list panel-scroll-region">
        {props.sessions.map((session) => (
          <button
            aria-pressed={props.selectedID === session.sessionID}
            className={props.selectedID === session.sessionID ? "session-row is-selected" : "session-row"}
            key={session.sessionID}
            onClick={() => props.onSelect(session.sessionID)}
            style={{ paddingLeft: `${16 + session.depth * 18}px` }}
            type="button"
          >
            <span className="session-name">{session.label}</span>
            <span className="session-meta">
              {formatSessionTime(session.firstTs)}
            </span>
          </button>
        ))}
      </div>
      {props.stats && (
        <div className="session-stats-wrap" aria-label="Session Stats">
          <div className="session-stats">
            <div className="session-stat">
              <span className="session-stat-value" title={formatTokenTitle(props.stats.tokens)}>
                {formatTokenCount(props.stats.tokens)}
              </span>
              <span className="session-stat-label">tokens</span>
            </div>
            <div className="session-stat">
              <span className="session-stat-value">{props.stats.toolCalls}</span>
              <span className="session-stat-label">tool calls</span>
            </div>
            <div className="session-stat">
              <span className="session-stat-value">{props.stats.userMessages}</span>
              <span className="session-stat-label">messages</span>
            </div>
          </div>
          {Object.keys(props.stats.toolCallsByType).length > 0 && (
            <div className="tool-breakdown">
              <p className="tool-breakdown-heading">Tools used</p>
              <ul className="tool-breakdown-list">
                {Object.entries(props.stats.toolCallsByType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tool, count]) => (
                    <li className="tool-breakdown-row" key={tool}>
                      <span className="tool-breakdown-name">{tool}</span>
                      <span className="tool-breakdown-count">{count}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
