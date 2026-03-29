import type { UIRecord } from "../lib/api"

export function Timeline(props: {
  records: UIRecord[]
  types: string[]
  selectedType: string
  selectedID?: string
  onSelect: (record: UIRecord) => void
  onTypeChange: (type: string) => void
}) {
  return (
    <section className="panel panel-timeline" aria-label="Timeline">
      <div className="panel-header panel-header-stack">
        <div className="panel-header-copy">
          <p className="section-label">Timeline</p>
          <span>Actor to target flow</span>
        </div>
        <div className="timeline-filter-bar" aria-label="Timeline type filters">
          {["All", ...props.types].map((type) => (
            <button
              className={props.selectedType === type ? "timeline-filter is-active" : "timeline-filter"}
              key={type}
              onClick={() => props.onTypeChange(type)}
              type="button"
            >
              {type}
            </button>
          ))}
        </div>
      </div>
      <div className="timeline-list panel-scroll-region">
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
        {props.records.length === 0 ? (
          <div className="timeline-empty">
            <p>No matching records</p>
            <span>Adjust the type filter to widen the timeline.</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}
