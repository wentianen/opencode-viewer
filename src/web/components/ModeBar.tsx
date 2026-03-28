type Mode = "live" | "replay"

export function ModeBar(props: {
  mode: Mode
  onChange: (mode: Mode) => void
}) {
  return (
    <div className="mode-bar" aria-label="Mode">
      <button
        className={props.mode === "live" ? "mode-pill is-active" : "mode-pill"}
        onClick={() => props.onChange("live")}
        type="button"
      >
        Live
      </button>
      <button
        className={props.mode === "replay" ? "mode-pill is-active" : "mode-pill"}
        onClick={() => props.onChange("replay")}
        type="button"
      >
        Replay
      </button>
    </div>
  )
}
