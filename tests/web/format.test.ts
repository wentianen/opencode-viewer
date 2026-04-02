import { describe, expect, test } from "vitest"
import { mapRecords } from "../../src/web/lib/api"

describe("mapRecords token formatting", () => {
  test("formats usage labels compactly and keeps full token titles", () => {
    const mapped = mapRecords([
      {
        id: "r1",
        sessionID: "s1",
        rootSessionID: "s1",
        kind: "message",
        type: "message.updated",
        actor: "assistant",
        target: "model:gpt-5.4",
        summary: "small",
        payload: {},
        usage: { total: 950 },
      },
      {
        id: "r2",
        sessionID: "s1",
        rootSessionID: "s1",
        kind: "message",
        type: "message.updated",
        actor: "assistant",
        target: "model:gpt-5.4",
        summary: "thousand",
        payload: {},
        usage: { total: 1000 },
      },
      {
        id: "r3",
        sessionID: "s1",
        rootSessionID: "s1",
        kind: "message",
        type: "message.updated",
        actor: "assistant",
        target: "model:gpt-5.4",
        summary: "compact-k",
        payload: {},
        usage: { total: 1234 },
      },
      {
        id: "r4",
        sessionID: "s1",
        rootSessionID: "s1",
        kind: "message",
        type: "message.updated",
        actor: "assistant",
        target: "model:gpt-5.4",
        summary: "compact-m",
        payload: {},
        usage: { total: 1250000 },
      },
    ])

    expect(mapped.map((record) => record.usageLabel)).toEqual([
      "950 tok",
      "1K tok",
      "1.2K tok",
      "1.3M tok",
    ])
    expect(mapped.map((record) => Reflect.get(record, "usageTitle"))).toEqual([
      "950 tokens",
      "1,000 tokens",
      "1,234 tokens",
      "1,250,000 tokens",
    ])
  })
})
