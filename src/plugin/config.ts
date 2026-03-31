import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { resolveStaticDir } from "../build/layout"

export type RuntimeDefaults = {
  logDir: string
  host: string
  port: number
  openBrowser: boolean
}

export type RuntimeConfig = {
  host: string
  port: number
  logDir: string
  openBrowser: boolean
  url: string
}

export type StartConfig = {
  host: string
  port: number
  logDir: string
  staticDir: string
  openBrowser: boolean
  url: string
}

type EnvLike = Record<string, string | undefined>

export function defaultConfigRoot() {
  return path.join(os.homedir(), ".config", "opencode")
}

export function buildLogDir(configRoot: string) {
  return path.join(configRoot, "activity-logs")
}

export function buildConfigPath(configRoot: string) {
  return path.join(configRoot, "activity-viewer.json")
}

export function getRuntimeDefaults(configRoot: string, overrides: Partial<RuntimeDefaults> = {}): RuntimeDefaults {
  return {
    logDir: buildLogDir(configRoot),
    host: "127.0.0.1",
    port: 4310,
    openBrowser: true,
    ...overrides,
  }
}

async function readInstalledConfig(configRoot: string) {
  const filePath = buildConfigPath(configRoot)
  const raw = await fs.readFile(filePath, "utf8").catch(() => undefined)
  if (!raw) return undefined

  return JSON.parse(raw) as Partial<RuntimeDefaults>
}

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === "true") return true
  if (value === "false") return false
  return fallback
}

export async function resolveRuntimeConfig(
  env: EnvLike = process.env,
  configRoot = defaultConfigRoot(),
): Promise<RuntimeConfig> {
  const installed = await readInstalledConfig(configRoot)
  const defaults = getRuntimeDefaults(configRoot, installed)
  const host = env.ACTIVITY_VIEWER_HOST ?? defaults.host
  const port = Number(env.ACTIVITY_VIEWER_PORT ?? defaults.port)
  const logDir = env.ACTIVITY_VIEWER_LOG_DIR ?? defaults.logDir
  const openBrowser = parseBoolean(env.ACTIVITY_VIEWER_OPEN_BROWSER, defaults.openBrowser)

  return {
    host,
    port,
    logDir,
    openBrowser,
    url: `http://${host}:${port}`,
  }
}

export async function resolveStartConfig(
  moduleUrl: string,
  env: EnvLike = process.env,
  configRoot = defaultConfigRoot(),
): Promise<StartConfig> {
  const runtime = await resolveRuntimeConfig(env, configRoot)
  const staticDir = await resolveStaticDir(moduleUrl, (target) => fs.access(target))

  return {
    ...runtime,
    staticDir,
  }
}
