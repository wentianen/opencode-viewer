export function SessionTree(props: {
  sessions: Array<{
    sessionID: string
    label: string
    subtreeTokens: number
    cost: number
    depth: number
  }>
  selectedID?: string
  stats?: {
    tokens: number
    toolCalls: number
    userMessages: number
  }
  onSelect: (sessionID: string) => void
}) {
  return (
    <section className="panel panel-tree" aria-label="Session Tree">
      <div className="panel-header">
        <p className="section-label">Session Tree</p>
        <span>Subtree totals</span>
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
              {session.subtreeTokens.toLocaleString()} tok
            </span>
          </button>
        ))}
      </div>
      {props.stats && (
        <div className="session-stats" aria-label="Session Stats">
          <div className="session-stat">
            <span className="session-stat-value">{props.stats.tokens.toLocaleString()}</span>
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
      )}
    </section>
  )
}
