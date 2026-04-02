function stripTrailingZero(value: number) {
  return value.toFixed(1).replace(/\.0$/, "")
}

export function formatTokenCount(value: number) {
  if (value >= 1_000_000) {
    return `${stripTrailingZero(value / 1_000_000)}M`
  }

  if (value >= 1_000) {
    return `${stripTrailingZero(value / 1_000)}K`
  }

  return `${value}`
}

export function formatTokenTitle(value: number) {
  return `${value.toLocaleString()} tokens`
}
