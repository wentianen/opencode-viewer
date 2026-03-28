import path from "node:path"
import { describe, expect, test, vi } from "vitest"
import {
  defaultServiceCwd,
  ensureService,
  ensureServiceRunning,
  getServiceUrl,
  resolveServiceCwd,
} from "../../src/plugin/service-launcher"

describe("ensureService", () => {
  test("returns true when the health endpoint responds ok", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
    })

    await expect(ensureService("http://localhost:4310", fetcher)).resolves.toBe(true)
    expect(fetcher).toHaveBeenCalledWith("http://localhost:4310/health")
  })

  test("returns false when the health endpoint throws", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"))

    await expect(ensureService("http://localhost:4310", fetcher)).resolves.toBe(false)
  })
})

describe("getServiceUrl", () => {
  test("builds the local service health base url from env-like values", () => {
    expect(getServiceUrl({ ACTIVITY_VIEWER_HOST: "127.0.0.1", ACTIVITY_VIEWER_PORT: "4310" })).toBe(
      "http://127.0.0.1:4310",
    )
  })
})

describe("service launcher paths", () => {
  test("defaults to the package root instead of the caller cwd", () => {
    expect(path.basename(defaultServiceCwd())).toBe("opencode-viewer")
  })

  test("resolves the package root from source module paths", () => {
    expect(
      resolveServiceCwd(
        "file:///tmp/opencode-viewer/src/plugin/service-launcher.ts",
        (target) => target === "/tmp/opencode-viewer/package.json",
      ),
    ).toBe("/tmp/opencode-viewer")
  })

  test("resolves the package root from built plugin module paths", () => {
    expect(
      resolveServiceCwd(
        "file:///tmp/opencode-viewer/dist/index.js",
        (target) => target === "/tmp/opencode-viewer/package.json",
      ),
    ).toBe("/tmp/opencode-viewer")
  })
})

describe("ensureServiceRunning", () => {
  test("requests in-process startup when health check is down", async () => {
    const health = vi.fn().mockResolvedValue(false)
    const start = vi.fn().mockReturnValue(true)

    await expect(ensureServiceRunning("http://127.0.0.1:4310", health, start)).resolves.toBe(true)
    expect(start).toHaveBeenCalled()
  })

  test("does not restart the service when health check is already ok", async () => {
    const health = vi.fn().mockResolvedValue(true)
    const start = vi.fn().mockReturnValue(true)

    await expect(ensureServiceRunning("http://127.0.0.1:4310", health, start)).resolves.toBe(true)
    expect(start).not.toHaveBeenCalled()
  })
})
