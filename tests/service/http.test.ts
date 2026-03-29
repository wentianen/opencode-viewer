import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { createServiceApp } from "../../src/service/index"

describe("createServiceApp", () => {
  test("serves health and sessions endpoints", async () => {
    const staticDir = await fs.mkdtemp(path.join(os.tmpdir(), "activity-viewer-static-"))
    await fs.mkdir(path.join(staticDir, "assets"), { recursive: true })
    await fs.writeFile(path.join(staticDir, "index.html"), "<!doctype html><html><body>viewer</body></html>", "utf8")
    await fs.writeFile(path.join(staticDir, "assets", "app.js"), 'console.log("viewer")', "utf8")

    const app = createServiceApp({
      health: () => ({ ok: true }),
      listSessions: () => [{ sessionID: "root" }],
      listRecords: () => [{ id: "evt_1", summary: "Executed bash", rawPayload: { command: "ls" }, payload: { command: "ls" } }],
      getOverview: () => ({
        totalTokens: 100,
        totalCost: 0.1,
        totalSessions: 1,
        totalMessages: 2,
      }),
      staticDir,
    })

    const health = await app.request("/health")
    const sessions = await app.request("/api/sessions")
    const records = await app.request("/api/records")
    const overview = await app.request("/api/overview")
    const stream = await app.request("/api/stream?once=1")
    const shell = await app.request("/")
    const asset = await app.request("/assets/app.js")
    const replayRoute = await app.request("/sessions/root")

    expect(health.status).toBe(200)
    expect(await health.json()).toEqual({ ok: true })
    expect(await sessions.json()).toEqual([{ sessionID: "root" }])
    expect(await records.json()).toEqual([{ id: "evt_1", summary: "Executed bash", rawPayload: { command: "ls" }, payload: { command: "ls" } }])
    expect(await overview.json()).toEqual({
      totalTokens: 100,
      totalCost: 0.1,
      totalSessions: 1,
      totalMessages: 2,
    })
    expect(stream.headers.get("content-type")).toContain("text/event-stream")
    await expect(stream.text()).resolves.toContain("event: snapshot")
    expect(shell.headers.get("content-type")).toContain("text/html")
    await expect(shell.text()).resolves.toContain("viewer")
    expect(asset.headers.get("content-type")).toContain("javascript")
    await expect(asset.text()).resolves.toContain('console.log("viewer")')
    expect(replayRoute.headers.get("content-type")).toContain("text/html")
    await expect(replayRoute.text()).resolves.toContain("viewer")
  })
})
