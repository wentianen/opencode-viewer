export function SessionTree(props: {
  sessions: Array<{
    sessionID: string
    label: string
    subtreeTokens: number
    cost: number
    depth: number
    active: boolean
  }>
}) {
  return (
    <section className="panel panel-tree" aria-label="Session Tree">
      <div className="panel-header">
        <p className="section-label">Session Tree</p>
        <span>Subtree totals</span>
      </div>
      <div className="session-list">
        {props.sessions.map((session) => (
          <button
            className={session.active ? "session-row is-active" : "session-row"}
            key={session.sessionID}
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
    </section>
  )
}
