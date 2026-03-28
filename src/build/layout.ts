import path from "node:path"
import { fileURLToPath } from "node:url"

export const DIST_DIR = "dist"
export const WEB_DIST_DIR = path.join(DIST_DIR, "web")

type AccessLike = (target: string) => Promise<unknown>

export async function resolveStaticDir(
  moduleUrl: string,
  access: AccessLike,
) {
  const moduleDir = path.dirname(fileURLToPath(moduleUrl))
  const candidates = [
    path.resolve(moduleDir, "web"),
    path.resolve(moduleDir, "../../dist/web"),
  ]

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      continue
    }
  }

  return candidates[candidates.length - 1]
}
