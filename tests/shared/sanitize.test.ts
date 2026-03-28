import { describe, expect, test } from "vitest"
import { normalizeUsage, sanitizePayload } from "../../src/shared/sanitize"
import { UsageSchema } from "../../src/shared/schema"

describe("sanitizePayload", () => {
  test("redacts sensitive keys and truncates long strings and arrays", () => {
    const longText = "a".repeat(1001)
    const payload = {
      apiKey: "secret-value",
      nested: {
        token: "nested-secret",
        message: longText,
      },
      items: Array.from({ length: 51 }, (_, index) => index),
    }

    const result = sanitizePayload(payload)

    expect(result.flags).toEqual({
      truncated: true,
      redacted: true,
      error: false,
    })
    expect(result.payload).toEqual({
      apiKey: "[REDACTED]",
      nested: {
        token: "[REDACTED]",
        message: `${"a".repeat(200)}...[truncated]`,
      },
      items: Array.from({ length: 50 }, (_, index) => index),
    })
  })

  test("returns depth limit marker when nesting exceeds the limit", () => {
    const payload = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: "too deep",
              },
            },
          },
        },
      },
    }

    const result = sanitizePayload(payload)

    expect(result.flags).toEqual({
      truncated: true,
      redacted: false,
      error: false,
    })
    expect(result.payload).toEqual({
      level1: {
        level2: {
          level3: {
            level4: {
              level5: "[DEPTH_LIMIT]",
            },
          },
        },
      },
    })
  })
})

describe("normalizeUsage", () => {
  test("maps OpenCode-style token fields into viewer usage keys", () => {
    const usage = normalizeUsage({
      total_tokens: 120,
      input_tokens: 50,
      output_tokens: 60,
      reasoning_tokens: 10,
      cache_read_tokens: 5,
      cache_write_tokens: 3,
      cost_usd: 0.25,
    })

    expect(usage).toEqual({
      total: 120,
      input: 50,
      output: 60,
      reasoning: 10,
      cacheRead: 5,
      cacheWrite: 3,
      cost: 0.25,
    })
    expect(UsageSchema.parse(usage)).toEqual(usage)
  })

  test("maps nested cache fields and plain totals into viewer usage keys", () => {
    const usage = normalizeUsage({
      total: 100,
      input: 60,
      output: 20,
      reasoning: 10,
      cache: {
        read: 5,
        write: 5,
      },
      cost: 0.002,
    })

    expect(usage).toEqual({
      total: 100,
      input: 60,
      output: 20,
      reasoning: 10,
      cacheRead: 5,
      cacheWrite: 5,
      cost: 0.002,
    })
    expect(UsageSchema.parse(usage)).toEqual(usage)
  })
})
