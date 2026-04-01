import type { UIRecord } from "../lib/api"

function formatJSON(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2)
}

function syntaxHighlight(json: string): string {
  return json.replace(
    /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|(true|false)|(null)|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
    (_match, key, str, bool, nil, num) => {
      if (key != null) return `<span class="json-key">${key}</span>:`
      if (str != null) return `<span class="json-str">${str}</span>`
      if (bool != null) return `<span class="json-bool">${bool}</span>`
      if (nil != null) return `<span class="json-null">${nil}</span>`
      if (num != null) return `<span class="json-num">${num}</span>`
      return _match
    },
  )
}

export function DetailPanel(props: { record?: UIRecord }) {
  const payload = props.record?.rawPayload ?? props.record?.payload ?? {}
  const highlighted = syntaxHighlight(formatJSON(payload))

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
          {/* eslint-disable-next-line react/no-danger */}
          <pre dangerouslySetInnerHTML={{ __html: highlighted }} />
        </div>
      </div>
    </section>
  )
}
