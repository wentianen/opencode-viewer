import { useState } from "react"
import type { UIRecord } from "../lib/api"

type DetailMode = "raw" | "sanitized"

const detailModes: Array<{
  id: DetailMode
  label: string
  kicker: string
  caption: string
}> = [
  {
    id: "raw",
    label: "Raw",
    kicker: "Raw payload",
    caption: "Original event body",
  },
  {
    id: "sanitized",
    label: "Sanitized",
    kicker: "Sanitized payload",
    caption: "Stored safe comparison",
  },
]

function formatJSON(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2)
}

export function DetailPanel(props: { record?: UIRecord }) {
  const [mode, setMode] = useState<DetailMode>("raw")
  const activeMode = detailModes.find((item) => item.id === mode) ?? detailModes[0]
  const payload = mode === "raw" ? props.record?.rawPayload ?? {} : props.record?.payload ?? {}

  return (
    <section className="panel panel-detail" aria-label="Detail">
      <div className="panel-header panel-header-detail">
        <p className="section-label">Detail</p>
        <div className="detail-filter-bar" role="group" aria-label="Payload view">
          {detailModes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              className={`detail-filter${mode === item.id ? " is-active" : ""}`}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="detail-block panel-scroll-region">
        <div className="detail-heading">
          <p className="detail-title">{props.record?.type ?? "No record selected"}</p>
          <span className="detail-caption">{activeMode.caption}</span>
        </div>
        <div className={`detail-section${mode === "sanitized" ? " detail-section-muted" : ""}`}>
          <div className="detail-section-header">
            <span className="detail-kicker">{activeMode.kicker}</span>
            <span>{activeMode.caption}</span>
          </div>
          <pre>{formatJSON(payload)}</pre>
        </div>
      </div>
    </section>
  )
}
