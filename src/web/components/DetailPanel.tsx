import type { UIRecord } from "../lib/api"

function formatJSON(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2)
}

export function DetailPanel(props: { record?: UIRecord }) {
  const payload = props.record?.rawPayload ?? props.record?.payload ?? {}

  return (
    <section className="panel panel-detail" aria-label="Detail">
      <div className="panel-header panel-header-detail">
        <p className="section-label">Detail</p>
      </div>
      <div className="detail-block panel-scroll-region">
        <div className="detail-heading">
          <p className="detail-title">{props.record?.type ?? "No record selected"}</p>
          <span className="detail-caption">Full payload</span>
        </div>
        <div className="detail-section">
          <div className="detail-section-header">
            <span className="detail-kicker">Payload</span>
            <span>Stored event body</span>
          </div>
          <pre>{formatJSON(payload)}</pre>
        </div>
      </div>
    </section>
  )
}
