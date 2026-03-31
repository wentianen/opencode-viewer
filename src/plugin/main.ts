import fs from "node:fs/promises"
import path from "node:path"
import { serve } from "@hono/node-server"
import { createServiceApp } from "../service"
import { openBrowser } from "../service/browser"
import { createActivityStore } from "../service/store"
import { normalizeUsage } from "../shared/sanitize"
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
  metadata?: unknown
  args?: unknown
  agent?: string
}

type SessionEventInput = {
  type: string
  sessionID: string
  info?: {
    id: string
    parentID?: string
    title?: string
    [key: string]: unknown
  }
  properties?: Record<string, unknown>
}

type MessageEventInput = {
  type: string
  info: Record<string, unknown> & {
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

const recordID = () => globalThis.crypto?.randomUUID?.() ?? `evt_${Date.now()}`
const recordFlags = () => ({
  truncated: false,
  redacted: false,
  error: false,
})

let viewerServiceStartPromise: Promise<boolean> | undefined
let viewerBrowserOpened = false

export async function startInProcessViewerService() {
  const config = await resolveStartConfig(import.meta.url)

  if (await ensureService(config.url)) {
    return false
  }

  const app = createServiceApp({
    health: () => ({ ok: true, logDir: config.logDir }),
    listSessions: async () => (await createActivityStore(config.logDir)).listSessions(),
    listRecords: async () => (await createActivityStore(config.logDir)).listRecords(),
    getOverview: async () => (await createActivityStore(config.logDir)).getOverview(),
    staticDir: config.staticDir,
    getSnapshot: async () => {
      const store = await createActivityStore(config.logDir)
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
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  }
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
    payload: payload as Record<string, unknown>,
    flags: recordFlags(),
  }
}

export function mapSessionEvent(input: SessionEventInput, lineage: SessionLineage): ActivityRecord {
  const payload = (input.info ?? input.properties ?? {}) as Record<string, unknown>
  const title = input.info?.title ?? (input.properties?.title as string | undefined)

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
    summary: title ? `${input.type} ${title}` : input.type,
    refs: {},
    rawPayload: payload as Record<string, unknown>,
    payload: payload as Record<string, unknown>,
    flags: recordFlags(),
  }
}

export function mapMessageEvent(input: MessageEventInput, lineage: SessionLineage): ActivityRecord {
  const payload = input.info as Record<string, unknown>
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
    rawPayload: payload,
    payload,
    flags: recordFlags(),
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
    payload: payload as Record<string, unknown>,
    flags: recordFlags(),
  }
}

export function mapMessagePartEvent(input: MessagePartEventInput, lineage: SessionLineage): ActivityRecord {
  const part = input.properties.part
  const sessionID = part?.sessionID ?? input.properties.sessionID ?? lineage.sessionID
  const messageID = part?.messageID ?? input.properties.messageID
  const partID = part?.id ?? input.properties.partID
  const payload = input.properties as Record<string, unknown>

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
    payload: payload as Record<string, unknown>,
    flags: recordFlags(),
  }
}

export async function appendActivityRecord(logDir: string, record: ActivityRecord) {
  await fs.mkdir(logDir, { recursive: true })
  const filePath = path.join(logDir, `${record.sessionID}.jsonl`)
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8")
  return filePath
}

export async function ActivityViewerPlugin(_ctx: Record<string, unknown> = {}) {
  const sessionParents: SessionParentMap = {}
  const sessionTitles: Record<string, string | undefined> = {}
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
      // session.created / session.updated / session.deleted — properties.info.id
      if (event.type === "session.created" || event.type === "session.updated" || event.type === "session.deleted") {
        const info = event.properties?.info
        const sessionID = info?.id
        if (!sessionID) return

        sessionParents[sessionID] = info?.parentID

        // skip session.updated when title hasn't changed — these are noisy heartbeat-style updates
        if (event.type === "session.updated") {
          const newTitle = info?.title
          if (newTitle === sessionTitles[sessionID]) return
          sessionTitles[sessionID] = newTitle
        }

        const lineage = resolveSessionLineage(sessionID, sessionParents)
        await appendActivityRecord(logDir, mapSessionEvent({ type: event.type, sessionID, info }, lineage))
        return
      }

      // session.status / session.idle / session.error / session.compacted /
      // session.deleted / session.diff — properties.sessionID directly
      if (event.type.startsWith("session.")) {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return

        const lineage = resolveSessionLineage(sessionID, sessionParents)
        await appendActivityRecord(
          logDir,
          mapSessionEvent({ type: event.type, sessionID, properties: event.properties ?? {} }, lineage),
        )
        return
      }

      if (event.type === "message.updated" || event.type === "message.removed") {
        const info = event.properties?.info
        const sessionID = info?.sessionID ?? event.properties?.sessionID
        if (!sessionID) return

        const lineage = resolveSessionLineage(sessionID, sessionParents)

        if (event.type === "message.updated") {
          await appendActivityRecord(logDir, mapMessageEvent({ type: event.type, info }, lineage))
        } else {
          // message.removed: { sessionID, messageID }
          const payload = event.properties as Record<string, unknown>
          await appendActivityRecord(logDir, {
            id: recordID(),
            ts: Date.now(),
            sessionID,
            parentSessionID: lineage.parentSessionID,
            rootSessionID: lineage.rootSessionID,
            forkDepth: lineage.forkDepth,
            kind: "message",
            type: "message.removed",
            actor: "system",
            target: event.properties?.messageID ? `message:${event.properties.messageID}` : "message",
            direction: "internal",
            summary: "message.removed",
            refs: { messageID: event.properties?.messageID },
            rawPayload: payload,
            payload,
            flags: recordFlags(),
          })
        }
        return
      }

      if (event.type === "message.part.updated" || event.type === "message.part.removed") {
        const sessionID = event.properties?.part?.sessionID ?? event.properties?.sessionID
        if (!sessionID) return

        const lineage = resolveSessionLineage(sessionID, sessionParents)
        await appendActivityRecord(logDir, mapMessagePartEvent({ type: event.type, properties: event.properties ?? {} }, lineage))
        return
      }

      // command.executed — shell command results
      if (event.type === "command.executed") {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return

        const lineage = resolveSessionLineage(sessionID, sessionParents)
        const payload = event.properties as Record<string, unknown>
        await appendActivityRecord(logDir, {
          id: recordID(),
          ts: Date.now(),
          sessionID,
          parentSessionID: lineage.parentSessionID,
          rootSessionID: lineage.rootSessionID,
          forkDepth: lineage.forkDepth,
          kind: "tool",
          type: "command.executed",
          actor: "agent:build",
          target: `command:${event.properties?.name ?? "unknown"}`,
          direction: "outbound",
          summary: `command ${event.properties?.name ?? "unknown"} ${event.properties?.arguments ?? ""}`.trim(),
          refs: { messageID: event.properties?.messageID },
          rawPayload: payload,
          payload,
          flags: recordFlags(),
        })
        return
      }

      // permission.updated / permission.replied
      if (event.type === "permission.updated" || event.type === "permission.replied") {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return

        const lineage = resolveSessionLineage(sessionID, sessionParents)
        const payload = event.properties as Record<string, unknown>
        await appendActivityRecord(logDir, {
          id: recordID(),
          ts: Date.now(),
          sessionID,
          parentSessionID: lineage.parentSessionID,
          rootSessionID: lineage.rootSessionID,
          forkDepth: lineage.forkDepth,
          kind: "system",
          type: event.type,
          actor: event.type === "permission.replied" ? "user" : "system",
          target: "permission",
          direction: event.type === "permission.replied" ? "inbound" : "internal",
          summary: event.type === "permission.replied"
            ? `permission ${event.properties?.response ?? "replied"}`
            : `permission requested`,
          refs: { messageID: event.properties?.messageID },
          rawPayload: payload,
          payload,
          flags: recordFlags(),
        })
        return
      }

      // todo.updated
      if (event.type === "todo.updated") {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return

        const lineage = resolveSessionLineage(sessionID, sessionParents)
        const payload = event.properties as Record<string, unknown>
        await appendActivityRecord(logDir, {
          id: recordID(),
          ts: Date.now(),
          sessionID,
          parentSessionID: lineage.parentSessionID,
          rootSessionID: lineage.rootSessionID,
          forkDepth: lineage.forkDepth,
          kind: "system",
          type: "todo.updated",
          actor: "agent:build",
          target: "todo",
          direction: "internal",
          summary: `todo.updated ${Array.isArray(event.properties?.todos) ? `(${event.properties.todos.length} items)` : ""}`.trim(),
          refs: {},
          rawPayload: payload,
          payload,
          flags: recordFlags(),
        })
        return
      }
    },
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string; args: unknown },
      output: { title: string; output: string; metadata?: unknown },
    ) => {
      const lineage = resolveSessionLineage(input.sessionID, sessionParents)
      await appendActivityRecord(
        logDir,
        mapToolEvent(
          { ...input, type: "tool.execute.after", title: output.title, output: output.output, metadata: output.metadata },
          lineage,
        ),
      )
    },
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: unknown },
    ) => {
      const lineage = resolveSessionLineage(input.sessionID, sessionParents)
      await appendActivityRecord(logDir, mapToolEvent({ ...input, type: "tool.execute.before", args: output.args }, lineage))
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
