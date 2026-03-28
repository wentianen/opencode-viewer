import type { UIRecord } from "../lib/api"

export function DetailPanel(props: { record?: UIRecord }) {
  return (
    <section className="panel panel-detail" aria-label="Detail">
      <div className="panel-header">
        <p className="section-label">Detail</p>
        <span>Sanitized payload</span>
      </div>
      <div className="detail-block">
        <p className="detail-title">{props.record?.type ?? "No record selected"}</p>
        <pre>{JSON.stringify(props.record?.payload ?? {}, null, 2)}</pre>
      </div>
    </section>
  )
}
