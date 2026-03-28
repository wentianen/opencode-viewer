import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"

type HealthFetcher = (input: string) => Promise<{ ok: boolean }>

export function getServiceUrl(env: Record<string, string | undefined> = process.env) {
  const host = env.ACTIVITY_VIEWER_HOST || "127.0.0.1"
  const port = env.ACTIVITY_VIEWER_PORT || "4310"
  return `http://${host}:${port}`
}

export async function ensureService(url: string, fetcher: HealthFetcher = fetch): Promise<boolean> {
  try {
    const response = await fetcher(`${url}/health`)
    return response.ok
  } catch {
    return false
  }
}

export function defaultServiceCwd() {
  return resolveServiceCwd(import.meta.url)
}

export function resolveServiceCwd(
  moduleUrl: string,
  exists: (target: string) => boolean = fs.existsSync,
) {
  const moduleDir = path.dirname(fileURLToPath(moduleUrl))
  const candidates = [
    path.resolve(moduleDir, ".."),
    path.resolve(moduleDir, "../.."),
  ]

  for (const candidate of candidates) {
    if (exists(path.join(candidate, "package.json"))) {
      return candidate
    }
  }

  return candidates[candidates.length - 1]
}

export async function ensureServiceRunning(
  url: string,
  healthCheck: (url: string) => Promise<boolean> = ensureService,
  start: () => boolean | Promise<boolean>,
) {
  const healthy = await healthCheck(url)
  if (healthy) return true
  return start()
}
