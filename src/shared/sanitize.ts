const MAX_STRING_LENGTH = 1000
const STRING_PREFIX_LENGTH = 200
const MAX_ARRAY_LENGTH = 50
const MAX_DEPTH = 5
const TRUNCATED_SUFFIX = "...[truncated]"
const DEPTH_LIMIT_VALUE = "[DEPTH_LIMIT]"
const REDACTED_VALUE = "[REDACTED]"

const SENSITIVE_KEYS = new Set([
  "apikey",
  "key",
  "token",
  "secret",
  "authorization",
  "password",
  "credential",
])

export type SanitizeFlags = {
  truncated: boolean
  redacted: boolean
  error: boolean
}

export type SanitizedPayload<T = unknown> = {
  payload: T
  flags: SanitizeFlags
}

type UsageSource = Record<string, unknown>

const createFlags = (): SanitizeFlags => ({
  truncated: false,
  redacted: false,
  error: false,
})

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const normalizeKey = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

const isSensitiveKey = (key: string) => {
  const parts = normalizeKey(key)
  return parts.some((part) => SENSITIVE_KEYS.has(part)) || SENSITIVE_KEYS.has(parts.join(""))
}

const sanitizeValue = (value: unknown, flags: SanitizeFlags, depth: number): unknown => {
  if (depth >= MAX_DEPTH) {
    flags.truncated = true
    return DEPTH_LIMIT_VALUE
  }

  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      flags.truncated = true
      return `${value.slice(0, STRING_PREFIX_LENGTH)}${TRUNCATED_SUFFIX}`
    }

    return value
  }

  if (Array.isArray(value)) {
    const limit = Math.min(value.length, MAX_ARRAY_LENGTH)
    if (value.length > MAX_ARRAY_LENGTH) {
      flags.truncated = true
    }

    return value.slice(0, limit).map((item) => sanitizeValue(item, flags, depth + 1))
  }

  if (isPlainObject(value)) {
    const sanitized: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        flags.redacted = true
        sanitized[key] = REDACTED_VALUE
        continue
      }

      sanitized[key] = sanitizeValue(entry, flags, depth + 1)
    }

    return sanitized
  }

  return value
}

export const sanitizePayload = <T = unknown>(payload: T): SanitizedPayload => {
  const flags = createFlags()

  try {
    return {
      payload: sanitizeValue(payload, flags, 0) as T,
      flags,
    }
  } catch {
    return {
      payload: "[SANITIZE_ERROR]",
      flags: {
        ...flags,
        error: true,
      },
    }
  }
}

const usageField = (usage: UsageSource, keys: string[]) => {
  for (const key of keys) {
    const value = usage[key]
    if (typeof value === "number") {
      return value
    }
  }

  return 0
}

const nestedUsageField = (usage: UsageSource, key: string, nestedKey: string) => {
  const nested = usage[key]
  if (!isPlainObject(nested)) return 0

  const value = nested[nestedKey]
  return typeof value === "number" ? value : 0
}

export const normalizeUsage = (usage: UsageSource) => ({
  total: usageField(usage, ["total_tokens", "totalTokens", "total"]),
  input: usageField(usage, ["input_tokens", "inputTokens", "input"]),
  output: usageField(usage, ["output_tokens", "outputTokens", "output"]),
  reasoning: usageField(usage, ["reasoning_tokens", "reasoningTokens", "reasoning"]),
  cacheRead:
    usageField(usage, ["cache_read_tokens", "cacheReadTokens", "cacheRead"]) || nestedUsageField(usage, "cache", "read"),
  cacheWrite:
    usageField(usage, ["cache_write_tokens", "cacheWriteTokens", "cacheWrite"]) ||
    nestedUsageField(usage, "cache", "write"),
  cost: usageField(usage, ["cost_usd", "costUsd", "cost"]),
})
