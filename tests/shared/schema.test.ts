import { describe, expect, test } from "vitest"
import { ActivityRecordSchema, SessionAggregateSchema } from "../../src/shared/schema"

describe("shared schema", () => {
  test("parses an activity record", () => {
    const record = {
      id: "record-1",
      ts: 1710000000000,
      sessionID: "session-1",
      rootSessionID: "session-1",
      forkDepth: 0,
      kind: "message",
      type: "assistant",
      actor: "assistant",
      target: "user",
      direction: "outbound",
      summary: "Assistant replied",
      refs: {},
      payload: {},
      flags: {
        truncated: false,
        redacted: false,
        error: false,
      },
      usage: {
        total: 10,
        input: 4,
        output: 5,
        reasoning: 1,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0.01,
      },
    }

    expect(ActivityRecordSchema.parse(record)).toEqual(record)
  })

  test("rejects an invalid activity record", () => {
    const result = ActivityRecordSchema.safeParse({
        id: "record-1",
        ts: -1,
        sessionID: "session-1",
        rootSessionID: "session-1",
        forkDepth: 0,
        kind: "message",
        type: "assistant",
        actor: "assistant",
        target: "user",
        direction: "outbound",
        summary: "Assistant replied",
        refs: {},
        payload: {},
        flags: {
          truncated: false,
          redacted: false,
          error: false,
        },
      })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["ts"])
    }
  })

  test("parses a session aggregate", () => {
    const aggregate = {
      sessionID: "session-1",
      rootSessionID: "session-1",
      forkDepth: 0,
      selfTotals: {
        tokens: 12,
        cost: 0.02,
        messages: 3,
      },
      subtreeTotals: {
        tokens: 40,
        cost: 0.08,
        messages: 7,
      },
    }

    expect(SessionAggregateSchema.parse(aggregate)).toEqual(aggregate)
  })

  test("rejects an invalid session aggregate", () => {
    const result = SessionAggregateSchema.safeParse({
        sessionID: "session-1",
        rootSessionID: "session-1",
        forkDepth: 0,
        selfTotals: {
          tokens: 12,
          cost: 0.02,
          messages: -1,
        },
        subtreeTotals: {
          tokens: 40,
          cost: 0.08,
          messages: 7,
        },
      })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["selfTotals", "messages"])
    }
  })
})
