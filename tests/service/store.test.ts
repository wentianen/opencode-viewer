import { describe, expect, test } from "vitest"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { buildSessionTreeTotals, createActivityStore } from "../../src/service/store"

describe("buildSessionTreeTotals", () => {
  test("aggregates subtree totals across child sessions", () => {
    const totals = buildSessionTreeTotals(
      [
        {
          sessionID: "root",
          parentSessionID: undefined,
          rootSessionID: "root",
          forkDepth: 0,
          usage: { total: 100, cost: 0.1 },
        },
        {
          sessionID: "child",
          parentSessionID: "root",
          rootSessionID: "root",
          forkDepth: 1,
          usage: { total: 50, cost: 0.05 },
        },
      ],
      {
        root: undefined,
        child: "root",
      },
    )

    expect(totals.root.selfTotals.tokens).toBe(100)
    expect(totals.root.subtreeTotals.tokens).toBe(150)
    expect(totals.child.subtreeTotals.tokens).toBe(50)
  })

  test("reads jsonl logs into session and overview summaries", async () => {
    const logDir = await fs.mkdtemp(path.join(os.tmpdir(), "activity-viewer-store-"))
    const records = [
      {
        id: "evt_1",
        ts: 1,
        sessionID: "root",
        rootSessionID: "root",
        forkDepth: 0,
        kind: "message",
        type: "message.updated",
        actor: "user",
        target: "agent:build",
        direction: "inbound",
        summary: "User prompt",
        refs: {},
        payload: {},
        flags: { truncated: false, redacted: false, error: false },
        usage: { total: 100, input: 60, output: 20, reasoning: 10, cacheRead: 5, cacheWrite: 5, cost: 0.1 },
      },
      {
        id: "evt_2",
        ts: 2,
        sessionID: "child",
        parentSessionID: "root",
        rootSessionID: "root",
        forkDepth: 1,
        kind: "tool",
        type: "tool.execute.after",
        actor: "agent:build",
        target: "tool:bash",
        direction: "outbound",
        summary: "Executed bash",
        refs: { callID: "call_1" },
        payload: {},
        flags: { truncated: false, redacted: false, error: false },
        usage: { total: 50, input: 20, output: 20, reasoning: 5, cacheRead: 5, cacheWrite: 0, cost: 0.05 },
      },
    ]

    await fs.writeFile(path.join(logDir, "root.jsonl"), `${JSON.stringify(records[0])}\n`, "utf8")
    await fs.writeFile(path.join(logDir, "child.jsonl"), `${JSON.stringify(records[1])}\n`, "utf8")

    const store = await createActivityStore(logDir)

    expect(store.listSessions()).toHaveLength(2)
    // newest session (child, ts=2) sorts first; root (ts=1) sorts second
    expect(store.listSessions()[0]?.sessionID).toBe("child")
    expect(store.listSessions()[1]?.subtreeTotals.tokens).toBe(150)
    expect(store.listRecords()).toHaveLength(2)
    expect(store.listRecords()[0]?.id).toBe("evt_1")
    expect(store.getOverview()).toEqual({
      totalTokens: 150,
      totalCost: 0.15,
      totalSessions: 2,
      totalMessages: 2,
    })
  })
})
