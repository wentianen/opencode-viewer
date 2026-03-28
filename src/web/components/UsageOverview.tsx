export function UsageOverview(props: {
  totalTokens: number
  totalCost: number
  totalSessions: number
  totalMessages: number
}) {
  return (
    <section className="overview-strip" aria-label="Usage Overview">
      <div>
        <p className="section-label">Usage Overview</p>
        <strong>{props.totalTokens.toLocaleString()}</strong>
        <span>Total tokens</span>
      </div>
      <div>
        <strong>${props.totalCost.toFixed(2)}</strong>
        <span>Total cost</span>
      </div>
      <div>
        <strong>{props.totalSessions}</strong>
        <span>Sessions</span>
      </div>
      <div>
        <strong>{props.totalMessages}</strong>
        <span>Messages</span>
      </div>
    </section>
  )
}
