import fs from "node:fs/promises"
import path from "node:path"
import { serve } from "@hono/node-server"
import { createServiceApp } from "../service"
import { openBrowser } from "../service/browser"
import { createActivityStore } from "../service/store"
import { normalizeUsage, sanitizePayload } from "../shared/sanitize"
import type { ActivityRecord } from "../shared/schema"
import { buildLogDir, defaultConfigRoot, resolveRuntimeConfig, resolveStartConfig } from "./config"
import { ensureService } from "./service-launcher"
import type { SessionLineage } from "./session-lineage"
import { resolveSessionLineage, type SessionParentMap } from "./session-lineage"

type ToolEventInput = {
  type: string
  tool: string
  sessionID: string
  callID: string
  messageID?: string
  title?: string
  output?: string
  args?: unknown
  agent?: string
}

type SessionEventInput = {
  type: string
  info?: {
    id: string
    parentID?: string
    title?: string
  }
}

type MessageEventInput = {
  type: string
  info: {
    id: string
    sessionID: string
    role: string
    agent?: string
    modelID?: string
    providerID?: string
    time?: { created?: number }
    cost?: number
    tokens?: {
      total?: number
      input?: number
      output?: number
      reasoning?: number
      cache?: { read?: number; write?: number }
    }
  }
}

type ChatHookInput = {
  sessionID: string
  agent?: string
  model?: { providerID: string; modelID: string }
  messageID?: string
}

type ChatHookOutput = {
  message: { role?: string }
  parts: Array<Record<string, unknown>>
}

type MessagePartEventInput = {
  type: "message.part.updated" | "message.part.removed"
  properties: Record<string, any>
}

type ActivityViewerPluginContext = {
  project?: unknown
  client?: unknown
  $?: unknown
  directory?: string
  worktree?: string
}

const recordID = () => globalThis.crypto?.randomUUID?.() ?? `evt_${Date.now()}`

let viewerServiceStartPromise: Promise<boolean> | undefined
let viewerBrowserOpened = false

async function loadStore(logDir: string) {
  return await createActivityStore(logDir)
}

export async function startInProcessViewerService() {
  const config = await resolveStartConfig(import.meta.url)

  if (await ensureService(config.url)) {
    return false
  }

  const app = createServiceApp({
    health: () => ({ ok: true, logDir: config.logDir }),
    listSessions: async () => (await loadStore(config.logDir)).listSessions(),
    listRecords: async () => (await loadStore(config.logDir)).listRecords(),
    getOverview: async () => (await loadStore(config.logDir)).getOverview(),
    staticDir: config.staticDir,
    getSnapshot: async () => {
      const store = await loadStore(config.logDir)
      return {
        overview: store.getOverview(),
        sessions: store.listSessions(),
        records: store.listRecords(),
      }
    },
  })

  serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  })

  return true
}

export async function ensureInProcessViewerService(
  startViewerService: () => Promise<boolean> = startInProcessViewerService,
) {
  if (!viewerServiceStartPromise) {
    viewerServiceStartPromise = startViewerService().catch(() => false)
  }

  return await viewerServiceStartPromise
}

export function resetViewerServiceForTests() {
  viewerServiceStartPromise = undefined
  viewerBrowserOpened = false
}

export function mapToolEvent(input: ToolEventInput, lineage: SessionLineage): ActivityRecord {
  const payload = {
    ...(input.title ? { title: input.title } : {}),
    ...(input.args !== undefined ? { args: input.args } : {}),
    ...(input.output !== undefined ? { outputPreview: input.output } : {}),
  }
  const sanitized = sanitizePayload(payload)
  const summary =
    input.type === "tool.execute.before"
      ? `agent:${input.agent ?? "build"} preparing ${input.tool}`
      : `agent:${input.agent ?? "build"} executed ${input.tool}`

  return {
    id: recordID(),
    ts: Date.now(),
    sessionID: lineage.sessionID,
    parentSessionID: lineage.parentSessionID,
    rootSessionID: lineage.rootSessionID,
    forkDepth: lineage.forkDepth,
    kind: "tool",
    type: input.type,
    actor: `agent:${input.agent ?? "build"}`,
    target: `tool:${input.tool}`,
    direction: "outbound",
    summary,
    refs: {
      callID: input.callID,
      messageID: input.messageID,
    },
    rawPayload: payload as Record<string, unknown>,
    payload: sanitized.payload as Record<string, unknown>,
    flags: sanitized.flags,
  }
}

export function mapSessionEvent(input: SessionEventInput, lineage: SessionLineage): ActivityRecord {
  const payload = {
    title: input.info?.title,
  }
  const sanitized = sanitizePayload(payload)

  return {
    id: recordID(),
    ts: Date.now(),
    sessionID: lineage.sessionID,
    parentSessionID: lineage.parentSessionID,
    rootSessionID: lineage.rootSessionID,
    forkDepth: lineage.forkDepth,
    kind: "session",
    type: input.type,
    actor: "system",
    target: "session",
    direction: "internal",
    summary: input.info?.title ? `${input.type} ${input.info.title}` : input.type,
    refs: {},
    rawPayload: payload as Record<string, unknown>,
    payload: sanitized.payload as Record<string, unknown>,
    flags: sanitized.flags,
  }
}

export function mapMessageEvent(input: MessageEventInput, lineage: SessionLineage): ActivityRecord {
  const usage = normalizeUsage({
    total: input.info.tokens?.total,
    input: input.info.tokens?.input,
    output: input.info.tokens?.output,
    reasoning: input.info.tokens?.reasoning,
    cache: {
      read: input.info.tokens?.cache?.read,
      write: input.info.tokens?.cache?.write,
    },
    cost: input.info.cost,
  })

  return {
    id: recordID(),
    ts: input.info.time?.created ?? Date.now(),
    sessionID: lineage.sessionID,
    parentSessionID: lineage.parentSessionID,
    rootSessionID: lineage.rootSessionID,
    forkDepth: lineage.forkDepth,
    kind: "message",
    type: input.type,
    actor: input.info.role === "assistant" ? `agent:${input.info.agent ?? "build"}` : input.info.role,
    target: input.info.modelID ? `model:${input.info.modelID}` : "session",
    direction: input.info.role === "assistant" ? "outbound" : "inbound",
    summary: `${input.type} ${input.info.role}`,
    refs: {
      messageID: input.info.id,
    },
    rawPayload: {
      role: input.info.role,
      providerID: input.info.providerID,
      modelID: input.info.modelID,
    },
    payload: {
      role: input.info.role,
      providerID: input.info.providerID,
      modelID: input.info.modelID,
    },
    flags: {
      truncated: false,
      redacted: false,
      error: false,
    },
    usage,
  }
}

export function mapChatMessageEvent(
  input: ChatHookInput,
  output: ChatHookOutput,
  lineage: SessionLineage,
): ActivityRecord {
  const textPart = output.parts.find((part) => part.type === "text" && typeof part.text === "string")
  const payload = {
    role: output.message.role,
    text: textPart?.text,
  }
  const sanitized = sanitizePayload(payload)

  return {
    id: recordID(),
    ts: Date.now(),
    sessionID: lineage.sessionID,
    parentSessionID: lineage.parentSessionID,
    rootSessionID: lineage.rootSessionID,
    forkDepth: lineage.forkDepth,
    kind: "chat",
    type: "chat.message",
    actor: output.message.role ?? "user",
    target: `agent:${input.agent ?? "build"}`,
    direction: "inbound",
    summary: typeof textPart?.text === "string" ? textPart.text : "chat.message",
    refs: {
      messageID: input.messageID,
    },
    rawPayload: payload as Record<string, unknown>,
    payload: sanitized.payload as Record<string, unknown>,
    flags: sanitized.flags,
  }
}

export function mapMessagePartEvent(input: MessagePartEventInput, lineage: SessionLineage): ActivityRecord {
  const part = input.properties.part
  const sessionID = part?.sessionID ?? input.properties.sessionID ?? lineage.sessionID
  const messageID = part?.messageID ?? input.properties.messageID
  const partID = part?.id ?? input.properties.partID
  const payload = (
    input.type === "message.part.updated"
      ? {
          partType: part?.type,
          text: part?.text,
        }
      : {
          partID,
        }
  )
  const sanitized = sanitizePayload(payload)

  return {
    id: recordID(),
    ts: Date.now(),
    sessionID,
    parentSessionID: lineage.parentSessionID,
    rootSessionID: lineage.rootSessionID,
    forkDepth: lineage.forkDepth,
    kind: "message",
    type: input.type,
    actor: "agent:build",
    target: messageID ? `message:${messageID}` : "message",
    direction: "outbound",
    summary: `${input.type} ${part?.type ?? ""}`.trim(),
    refs: {
      messageID,
      partID,
    },
    rawPayload: payload as Record<string, unknown>,
    payload: sanitized.payload as Record<string, unknown>,
    flags: sanitized.flags,
  }
}

export async function appendActivityRecord(logDir: string, record: ActivityRecord) {
  await fs.mkdir(logDir, { recursive: true })
  const filePath = path.join(logDir, `${record.sessionID}.jsonl`)
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8")
  return filePath
}

export async function ActivityViewerPlugin(_ctx: ActivityViewerPluginContext = {}) {
  const sessionParents: SessionParentMap = {}
  const runtimeConfig = await resolveRuntimeConfig().catch(() => undefined)
  const logDir = runtimeConfig?.logDir ?? buildLogDir(defaultConfigRoot())
  const didStartViewer = await ensureInProcessViewerService(startInProcessViewerService).catch(() => false)
  if (didStartViewer && !viewerBrowserOpened) {
    if (runtimeConfig?.openBrowser) {
      await openBrowser(runtimeConfig.url).catch(() => false)
      viewerBrowserOpened = true
    }
  }

  return {
    event: async ({ event }: { event: { type: string; properties?: Record<string, any> } }) => {
      if (event.type.startsWith("session.")) {
        const info = event.properties?.info
        const sessionID = info?.id
        if (!sessionID) return

        sessionParents[sessionID] = info?.parentID
        const lineage = resolveSessionLineage(sessionID, sessionParents)
        await appendActivityRecord(logDir, mapSessionEvent({ type: event.type, info }, lineage))
        return
      }

      if (event.type === "message.updated") {
        const info = event.properties?.info
        if (!info?.sessionID) return

        const lineage = resolveSessionLineage(info.sessionID, sessionParents)
        await appendActivityRecord(logDir, mapMessageEvent({ type: event.type, info }, lineage))
        return
      }

      if (event.type === "message.part.updated" || event.type === "message.part.removed") {
        const sessionID = event.properties?.part?.sessionID ?? event.properties?.sessionID
        if (!sessionID) return

        const lineage = resolveSessionLineage(sessionID, sessionParents)
        await appendActivityRecord(logDir, mapMessagePartEvent({ type: event.type, properties: event.properties ?? {} }, lineage))
      }
    },
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string; args: any },
      output: { title: string; output: string },
    ) => {
      const lineage = resolveSessionLineage(input.sessionID, sessionParents)
      await appendActivityRecord(
        logDir,
        mapToolEvent(
          {
            type: "tool.execute.after",
            tool: input.tool,
            sessionID: input.sessionID,
            callID: input.callID,
            title: output.title,
            output: output.output,
          },
          lineage,
        ),
      )
    },
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string; messageID?: string; args: unknown; agent?: string },
    ) => {
      const lineage = resolveSessionLineage(input.sessionID, sessionParents)
      await appendActivityRecord(
        logDir,
        mapToolEvent(
          {
            type: "tool.execute.before",
            tool: input.tool,
            sessionID: input.sessionID,
            callID: input.callID,
            messageID: input.messageID,
            args: input.args,
            agent: input.agent,
          },
          lineage,
        ),
      )
    },
    "chat.message": async (
      input: ChatHookInput,
      output: ChatHookOutput,
    ) => {
      const lineage = resolveSessionLineage(input.sessionID, sessionParents)
      await appendActivityRecord(logDir, mapChatMessageEvent(input, output, lineage))
    },
  }
}

export default ActivityViewerPlugin
