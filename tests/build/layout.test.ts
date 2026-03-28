import path from "node:path"
import { describe, expect, test } from "vitest"
import { DIST_DIR, WEB_DIST_DIR, resolveStaticDir } from "../../src/build/layout"

describe("build layout", () => {
  test("treats web assets as a subdirectory under the plugin dist output", () => {
    expect(DIST_DIR).toBe("dist")
    expect(WEB_DIST_DIR).toBe(path.join("dist", "web"))
  })

  test("resolves dist/web when running from source files", async () => {
    const seen: string[] = []
    const resolved = await resolveStaticDir(
      "file:///tmp/opencode-viewer/src/plugin/index.ts",
      async (target) => {
        seen.push(target)
        if (target === "/tmp/opencode-viewer/dist/web") return
        throw new Error("missing")
      },
    )

    expect(resolved).toBe("/tmp/opencode-viewer/dist/web")
    expect(seen).toEqual([
      "/tmp/opencode-viewer/src/plugin/web",
      "/tmp/opencode-viewer/dist/web",
    ])
  })

  test("resolves sibling web assets when running from built dist files", async () => {
    const seen: string[] = []
    const resolved = await resolveStaticDir(
      "file:///tmp/opencode-viewer/dist/index.js",
      async (target) => {
        seen.push(target)
        if (target === "/tmp/opencode-viewer/dist/web") return
        throw new Error("missing")
      },
    )

    expect(resolved).toBe("/tmp/opencode-viewer/dist/web")
    expect(seen).toEqual([
      "/tmp/opencode-viewer/dist/web",
    ])
  })
})
