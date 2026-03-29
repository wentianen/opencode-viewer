import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { resolveRuntimeConfig, resolveStartConfig } from "../../src/plugin/config"

describe("resolveRuntimeConfig", () => {
  test("uses installed config values for plugin runtime data before static assets are involved", async () => {
    const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), "activity-viewer-runtime-config-"))
    await fs.writeFile(
      path.join(configRoot, "activity-viewer.json"),
      JSON.stringify({
        logDir: path.join(configRoot, "custom-logs"),
        host: "0.0.0.0",
        port: 4321,
        openBrowser: false,
      }),
      "utf8",
    )

    await expect(resolveRuntimeConfig({}, configRoot)).resolves.toEqual({
      host: "0.0.0.0",
      port: 4321,
      logDir: path.join(configRoot, "custom-logs"),
      openBrowser: false,
      url: "http://0.0.0.0:4321",
    })
  })
})

describe("resolveStartConfig", () => {
  test("defaults to opening the browser when no installed config is present", async () => {
    const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), "activity-viewer-start-defaults-"))

    await expect(resolveStartConfig("file:///tmp/opencode-viewer/src/plugin/index.ts", {}, configRoot)).resolves.toEqual({
      host: "127.0.0.1",
      port: 4310,
      logDir: path.join(configRoot, "activity-logs"),
      staticDir: path.join("/tmp/opencode-viewer", "dist", "web"),
      openBrowser: true,
      url: "http://127.0.0.1:4310",
    })
  })

  test("reads the installed viewer config when env overrides are not provided", async () => {
    const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), "activity-viewer-start-config-"))
    await fs.writeFile(
      path.join(configRoot, "activity-viewer.json"),
      JSON.stringify({
        logDir: path.join(configRoot, "custom-logs"),
        host: "0.0.0.0",
        port: 4321,
        openBrowser: false,
      }),
      "utf8",
    )

    await expect(resolveStartConfig("file:///tmp/opencode-viewer/src/plugin/index.ts", {}, configRoot)).resolves.toEqual({
      host: "0.0.0.0",
      port: 4321,
      logDir: path.join(configRoot, "custom-logs"),
      staticDir: path.join("/tmp/opencode-viewer", "dist", "web"),
      openBrowser: false,
      url: "http://0.0.0.0:4321",
    })
  })

  test("prefers explicit env values over the installed viewer config", async () => {
    const configRoot = await fs.mkdtemp(path.join(os.tmpdir(), "activity-viewer-start-env-"))
    await fs.writeFile(
      path.join(configRoot, "activity-viewer.json"),
      JSON.stringify({
        logDir: path.join(configRoot, "custom-logs"),
        host: "0.0.0.0",
        port: 4321,
        openBrowser: false,
      }),
      "utf8",
    )

    await expect(
      resolveStartConfig(
        "file:///tmp/opencode-viewer/src/plugin/index.ts",
        {
          ACTIVITY_VIEWER_LOG_DIR: path.join(configRoot, "env-logs"),
          ACTIVITY_VIEWER_HOST: "127.0.0.1",
          ACTIVITY_VIEWER_PORT: "4310",
          ACTIVITY_VIEWER_OPEN_BROWSER: "true",
        },
        configRoot,
      ),
    ).resolves.toEqual({
      host: "127.0.0.1",
      port: 4310,
      logDir: path.join(configRoot, "env-logs"),
      staticDir: path.join("/tmp/opencode-viewer", "dist", "web"),
      openBrowser: true,
      url: "http://127.0.0.1:4310",
    })
  })
})
