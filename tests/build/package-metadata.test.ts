import fs from "node:fs/promises"
import path from "node:path"
import { describe, expect, test } from "vitest"

const workspaceRoot = path.resolve(import.meta.dirname, "../..")

describe("package metadata", () => {
  test("exports the plugin from the package root for opencode.json npm loading", async () => {
    const packageJson = JSON.parse(await fs.readFile(path.join(workspaceRoot, "package.json"), "utf8")) as {
      main?: string
      exports?: Record<string, string>
    }

    expect(packageJson.main).toBe("./dist/index.js")
    expect(packageJson.exports).toMatchObject({
      ".": "./dist/index.js",
      "./plugin": "./dist/index.js",
    })
  })

  test("uses a named plugin re-export in the local plugin template", async () => {
    const template = await fs.readFile(path.join(workspaceRoot, "templates", "opencode-plugin.ts"), "utf8")

    expect(template).toContain('export { ActivityViewerPlugin } from "../dist/index.js"')
  })

  test("does not expose a separate start build once startup is embedded into the plugin", async () => {
    const packageJson = JSON.parse(await fs.readFile(path.join(workspaceRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.service).toBeUndefined()
    expect(packageJson.scripts?.["build:start"]).toBeUndefined()
  })

  test("builds the published plugin from a dedicated entry that only re-exports ActivityViewerPlugin", async () => {
    const packageJson = JSON.parse(await fs.readFile(path.join(workspaceRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>
    }
    const entry = await fs.readFile(path.join(workspaceRoot, "src", "plugin", "index.ts"), "utf8")

    expect(packageJson.scripts?.["build:plugin"]).toContain("src/plugin/index.ts")
    expect(entry).toContain('export { ActivityViewerPlugin } from "./main"')
  })
})
