import type { UIRecord } from "../lib/api"

export function Timeline(props: {
  records: UIRecord[]
  selectedID?: string
  onSelect: (record: UIRecord) => void
}) {
  return (
    <section className="panel panel-timeline" aria-label="Timeline">
      <div className="panel-header">
        <p className="section-label">Timeline</p>
        <span>Actor to target flow</span>
      </div>
      <div className="timeline-list">
        {props.records.map((record) => (
          <button
            className={props.selectedID === record.id ? "timeline-row is-selected" : "timeline-row"}
            key={record.id}
            onClick={() => props.onSelect(record)}
            type="button"
          >
            <p className="timeline-route">
              <span>{record.actor}</span>
              <span className="timeline-arrow">→</span>
              <span>{record.target}</span>
            </p>
            <div className="timeline-meta">
              <span>{record.summary}</span>
              <span>{record.usageLabel}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
