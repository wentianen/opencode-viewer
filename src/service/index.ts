import fs from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"

type Awaitable<T> = T | Promise<T>

type ServiceDeps = {
  health: () => Awaitable<unknown>
  listSessions: () => Awaitable<unknown>
  listRecords: () => Awaitable<unknown>
  getOverview: () => Awaitable<unknown>
  staticDir?: string
  getSnapshot?: () => Awaitable<{
    overview: unknown
    sessions: unknown
    records: unknown
  }>
}

async function buildSnapshot(deps: ServiceDeps) {
  if (deps.getSnapshot) {
    return await deps.getSnapshot()
  }

  const [overview, sessions, records] = await Promise.all([
    deps.getOverview(),
    deps.listSessions(),
    deps.listRecords(),
  ])

  return {
    overview,
    sessions,
    records,
  }
}

const contentType = (filePath: string) => {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8"
    case ".js":
      return "text/javascript; charset=utf-8"
    case ".css":
      return "text/css; charset=utf-8"
    case ".json":
      return "application/json; charset=utf-8"
    case ".svg":
      return "image/svg+xml"
    default:
      return "application/octet-stream"
  }
}

async function serveStaticFile(staticDir: string, relativePath: string) {
  const safePath = relativePath.replace(/^\/+/, "")
  const filePath = path.resolve(staticDir, safePath)

  if (!filePath.startsWith(path.resolve(staticDir))) {
    return new Response("Not found", { status: 404 })
  }

  const body = await fs.readFile(filePath).catch(() => undefined)
  if (!body) {
    return new Response("Not found", { status: 404 })
  }

  return new Response(body, {
    headers: {
      "content-type": contentType(filePath),
    },
  })
}

export function createServiceApp(deps: ServiceDeps) {
  const app = new Hono()

  app.get("/health", async (c) => c.json(await deps.health()))
  app.get("/api/sessions", async (c) => c.json(await deps.listSessions()))
  app.get("/api/records", async (c) => c.json(await deps.listRecords()))
  app.get("/api/overview", async (c) => c.json(await deps.getOverview()))
  app.get("/api/stream", async (c) => {
    const encoder = new TextEncoder()
    const headers = {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    }
    const encodeSnapshot = async () => {
      const snapshot = JSON.stringify(await buildSnapshot(deps))
      return encoder.encode(`event: snapshot\ndata: ${snapshot}\n\n`)
    }

    if (c.req.query("once") === "1") {
      return new Response(await encodeSnapshot(), { headers })
    }

    let interval: ReturnType<typeof setInterval> | undefined
    let lastSnapshot = ""

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const pushSnapshot = async () => {
          const nextSnapshot = JSON.stringify(await buildSnapshot(deps))

          if (nextSnapshot === lastSnapshot) return

          lastSnapshot = nextSnapshot
          controller.enqueue(encoder.encode(`event: snapshot\ndata: ${nextSnapshot}\n\n`))
        }

        await pushSnapshot()

        interval = setInterval(() => {
          void pushSnapshot().catch((error: unknown) => {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  message: error instanceof Error ? error.message : "Unknown stream error",
                })}\n\n`,
              ),
            )
          })
        }, 1000)
      },
      cancel() {
        if (interval) clearInterval(interval)
      },
    })

    return new Response(stream, { headers })
  })

  if (deps.staticDir) {
    app.get("/assets/*", async (c) => {
      return await serveStaticFile(deps.staticDir!, c.req.path)
    })

    app.get("*", async (c) => {
      if (c.req.path.startsWith("/api/") || c.req.path === "/health") {
        return new Response("Not found", { status: 404 })
      }

      return await serveStaticFile(deps.staticDir!, "index.html")
    })
  }

  return app
}
