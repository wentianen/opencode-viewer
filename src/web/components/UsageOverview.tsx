import { formatTokenCount, formatTokenTitle } from "../lib/format"

export function UsageOverview(props: {
  totalTokens: number
  totalCost: number
  totalSessions: number
  totalMessages: number
}) {
  const showCost = props.totalCost > 0
  const stats = [
    { label: "Tokens", value: formatTokenCount(props.totalTokens), title: formatTokenTitle(props.totalTokens) },
    ...(showCost ? [{ label: "Cost", value: `$${props.totalCost.toFixed(2)}` }] : []),
    { label: "Sessions", value: `${props.totalSessions}` },
    { label: "Messages", value: `${props.totalMessages}` },
  ]

  return (
    <section className={showCost ? "overview-strip" : "overview-strip overview-strip-no-cost"} aria-label="Usage Overview">
      {stats.map((stat) => (
        <div className="overview-stat" key={stat.label}>
          <span>{stat.label}</span>
          <strong title={stat.title}>{stat.value}</strong>
        </div>
      ))}
    </section>
  )
}
