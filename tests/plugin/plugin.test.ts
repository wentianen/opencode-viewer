import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { serve } from "@hono/node-server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { resolveRuntimeConfig, resolveStartConfig } from "../../src/plugin/config"
import { ensureService } from "../../src/plugin/service-launcher"
import { openBrowser } from "../../src/service/browser"

vi.mock("@hono/node-server", () => ({
  serve: vi.fn(),
}))

vi.mock("../../src/plugin/config", async () => {
  const actual = await vi.importActual<typeof import("../../src/plugin/config")>("../../src/plugin/config")
  return {
    ...actual,
    resolveRuntimeConfig: vi.fn(),
    resolveStartConfig: vi.fn(),
  }
})

vi.mock("../../src/plugin/service-launcher", async () => {
  const actual = await vi.importActual<typeof import("../../src/plugin/service-launcher")>("../../src/plugin/service-launcher")
  return {
    ...actual,
    ensureService: vi.fn(),
  }
})

vi.mock("../../src/service/browser", async () => {
  const actual = await vi.importActual<typeof import("../../src/service/browser")>("../../src/service/browser")
  return {
    ...actual,
    openBrowser: vi.fn(),
  }
})

import {
  ActivityViewerPlugin,
  appendActivityRecord,
  mapChatMessageEvent,
  mapMessageEvent,
  mapMessagePartEvent,
  mapSessionEvent,
  mapToolEvent,
  resetViewerServiceForTests,
} from "../../src/plugin/main"
import { resolveSessionLineage } from "../../src/plugin/session-lineage"

const mockedServe = vi.mocked(serve)
const mockedResolveRuntimeConfig = vi.mocked(resolveRuntimeConfig)
const mockedResolveStartConfig = vi.mocked(resolveStartConfig)
const mockedEnsureService = vi.mocked(ensureService)
const mockedOpenBrowser = vi.mocked(openBrowser)

beforeEach(() => {
  mockedServe.mockReset()
  mockedResolveRuntimeConfig.mockReset()
  mockedResolveStartConfig.mockReset()
  mockedEnsureService.mockReset()
  mockedOpenBrowser.mockReset()

  mockedResolveRuntimeConfig.mockResolvedValue({
    host: "127.0.0.1",
    port: 4310,
    logDir: "/tmp/activity-logs",
    openBrowser: true,
    url: "http://127.0.0.1:4310",
  })
  mockedResolveStartConfig.mockResolvedValue({
    host: "127.0.0.1",
    port: 4310,
    logDir: "/tmp/activity-logs",
    staticDir: "/tmp/opencode-viewer/dist/web",
    openBrowser: true,
    url: "http://127.0.0.1:4310",
  })
  mockedEnsureService.mockResolvedValue(false)
  mockedOpenBrowser.mockResolvedValue(true)
})

afterEach(() => {
  resetViewerServiceForTests()
  vi.restoreAllMocks()
})

describe("resolveSessionLineage", () => {
  test("derives rootSessionID and forkDepth from a parent map", () => {
    const lineage = resolveSessionLineage("ses_child", {
      ses_root: undefined,
      ses_child: "ses_root",
    })

    expect(lineage).toEqual({
      sessionID: "ses_child",
      parentSessionID: "ses_root",
      rootSessionID: "ses_root",
      forkDepth: 1,
    })
  })
})

describe("mapToolEvent", () => {
  test("creates an ActivityRecord-shaped tool event with refs and sanitized payload", () => {
    const record = mapToolEvent(
      {
        type: "tool.execute.after",
        tool: "bash",
        sessionID: "ses_root",
        callID: "call_1",
        messageID: "msg_1",
        title: "ls",
        output: "README.md",
        agent: "build",
      },
      {
        sessionID: "ses_root",
        parentSessionID: undefined,
        rootSessionID: "ses_root",
        forkDepth: 0,
      },
    )

    expect(record.kind).toBe("tool")
    expect(record.actor).toBe("agent:build")
    expect(record.target).toBe("tool:bash")
    expect(record.refs).toEqual({
      callID: "call_1",
      messageID: "msg_1",
    })
    expect(record.rawPayload).toEqual({
      title: "ls",
      outputPreview: "README.md",
    })
    expect(record.payload).toEqual({
      title: "ls",
      outputPreview: "README.md",
    })
  })

  test("captures tool.execute.before with full args for request tracing", () => {
    const record = mapToolEvent(
      {
        type: "tool.execute.before",
        tool: "bash",
        sessionID: "ses_root",
        callID: "call_2",
        messageID: "msg_2",
        agent: "build",
        title: "run bash",
        output: undefined,
        args: {
          command: "echo hello",
          token: "secret-value",
        },
      },
      {
        sessionID: "ses_root",
        parentSessionID: undefined,
        rootSessionID: "ses_root",
        forkDepth: 0,
      },
    )

    expect(record.type).toBe("tool.execute.before")
    expect(record.summary).toContain("preparing")
    expect(record.rawPayload).toEqual({
      title: "run bash",
      args: {
        command: "echo hello",
        token: "secret-value",
      },
    })
    expect(record.payload).toEqual({
      title: "run bash",
      args: {
        command: "echo hello",
        token: "secret-value",
      },
    })
    expect(record.flags.redacted).toBe(false)
  })
})

describe("mapSessionEvent", () => {
  test("creates a session activity record that preserves lineage", () => {
    const record = mapSessionEvent(
      {
        type: "session.created",
        info: {
          id: "ses_child",
          parentID: "ses_root",
          title: "Child session",
        },
      },
      {
        sessionID: "ses_child",
        parentSessionID: "ses_root",
        rootSessionID: "ses_root",
        forkDepth: 1,
      },
    )

    expect(record.kind).toBe("session")
    expect(record.parentSessionID).toBe("ses_root")
    expect(record.summary).toContain("Child session")
    expect(record.rawPayload).toEqual({
      id: "ses_child",
      parentID: "ses_root",
      title: "Child session",
    })
  })
})

describe("mapMessageEvent", () => {
  test("stores the full opencode message info without altering the payload", () => {
    const record = mapMessageEvent(
      {
        type: "message.updated",
        info: {
          id: "msg_1",
          sessionID: "ses_root",
          role: "assistant",
          agent: "build",
          parentID: "msg_user_1",
          modelID: "gpt-5.4",
          providerID: "openai",
          mode: "build",
          path: {
            cwd: "/tmp/demo",
            root: "/tmp",
          },
          summary: true,
          time: { created: 1, completed: 2 },
          error: {
            name: "APIError",
            data: {
              message: "request failed",
              responseHeaders: {
                authorization: "Bearer secret-token",
              },
            },
          },
          cost: 0.02,
          tokens: {
            total: 42,
            input: 20,
            output: 12,
            reasoning: 5,
            cache: { read: 5, write: 0 },
          },
        },
      },
      {
        sessionID: "ses_root",
        rootSessionID: "ses_root",
        forkDepth: 0,
      },
    )

    expect(record.kind).toBe("message")
    expect(record.actor).toBe("agent:build")
    expect(record.target).toBe("model:gpt-5.4")
    expect(record.refs).toEqual({ messageID: "msg_1" })
    expect(record.usage?.total).toBe(42)
    expect(record.rawPayload).toEqual({
      id: "msg_1",
      sessionID: "ses_root",
      role: "assistant",
      agent: "build",
      parentID: "msg_user_1",
      modelID: "gpt-5.4",
      providerID: "openai",
      mode: "build",
      path: {
        cwd: "/tmp/demo",
        root: "/tmp",
      },
      summary: true,
      time: { created: 1, completed: 2 },
      error: {
        name: "APIError",
        data: {
          message: "request failed",
          responseHeaders: {
            authorization: "Bearer secret-token",
          },
        },
      },
      cost: 0.02,
      tokens: {
        total: 42,
        input: 20,
        output: 12,
        reasoning: 5,
        cache: { read: 5, write: 0 },
      },
    })
    expect(record.payload).toEqual({
      id: "msg_1",
      sessionID: "ses_root",
      role: "assistant",
      agent: "build",
      parentID: "msg_user_1",
      modelID: "gpt-5.4",
      providerID: "openai",
      mode: "build",
      path: {
        cwd: "/tmp/demo",
        root: "/tmp",
      },
      summary: true,
      time: { created: 1, completed: 2 },
      error: {
        name: "APIError",
        data: {
          message: "request failed",
          responseHeaders: {
            authorization: "Bearer secret-token",
          },
        },
      },
      cost: 0.02,
      tokens: {
        total: 42,
        input: 20,
        output: 12,
        reasoning: 5,
        cache: { read: 5, write: 0 },
      },
    })
    expect(record.flags.redacted).toBe(false)
  })
})

describe("mapChatMessageEvent", () => {
  test("maps chat.message hook output into an inbound chat activity record", () => {
    const record = mapChatMessageEvent(
      {
        sessionID: "ses_root",
        messageID: "msg_user",
        agent: "build",
        model: {
          providerID: "openai",
          modelID: "gpt-5.4",
        },
      },
      {
        message: {
          role: "user",
        },
        parts: [
          { type: "text", text: "hello from user" },
        ],
      },
      {
        sessionID: "ses_root",
        rootSessionID: "ses_root",
        forkDepth: 0,
      },
    )

    expect(record.kind).toBe("chat")
    expect(record.actor).toBe("user")
    expect(record.target).toBe("agent:build")
    expect(record.summary).toContain("hello from user")
    expect(record.refs).toEqual({ messageID: "msg_user" })
  })
})

describe("mapMessagePartEvent", () => {
  test("maps message.part.updated into a message activity record and keeps payload untouched", () => {
    const record = mapMessagePartEvent(
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "part_1",
            sessionID: "ses_root",
            messageID: "msg_1",
            type: "text",
            text: "assistant output",
            metadata: {
              token: "secret-value",
            },
          },
          delta: " more text",
        },
      },
      {
        sessionID: "ses_root",
        rootSessionID: "ses_root",
        forkDepth: 0,
      },
    )

    expect(record.kind).toBe("message")
    expect(record.refs).toEqual({
      messageID: "msg_1",
      partID: "part_1",
    })
    expect(record.summary).toContain("message.part.updated")
    expect(record.rawPayload).toEqual({
      part: {
        id: "part_1",
        sessionID: "ses_root",
        messageID: "msg_1",
        type: "text",
        text: "assistant output",
        metadata: {
          token: "secret-value",
        },
      },
      delta: " more text",
    })
    expect(record.payload).toEqual({
      part: {
        id: "part_1",
        sessionID: "ses_root",
        messageID: "msg_1",
        type: "text",
        text: "assistant output",
        metadata: {
          token: "secret-value",
        },
      },
      delta: " more text",
    })
    expect(record.flags.redacted).toBe(false)
  })

  test("maps message.part.removed into a message activity record", () => {
    const record = mapMessagePartEvent(
      {
        type: "message.part.removed",
        properties: {
          sessionID: "ses_root",
          messageID: "msg_1",
          partID: "part_1",
        },
      },
      {
        sessionID: "ses_root",
        rootSessionID: "ses_root",
        forkDepth: 0,
      },
    )

    expect(record.kind).toBe("message")
    expect(record.refs).toEqual({
      messageID: "msg_1",
      partID: "part_1",
    })
    expect(record.summary).toContain("message.part.removed")
  })
})

describe("appendActivityRecord", () => {
  test("writes a jsonl record into the session log file", async () => {
    const logDir = await fs.mkdtemp(path.join(os.tmpdir(), "activity-viewer-plugin-"))
    const record = mapToolEvent(
      {
        type: "tool.execute.after",
        tool: "bash",
        sessionID: "ses_root",
        callID: "call_1",
      },
      {
        sessionID: "ses_root",
        rootSessionID: "ses_root",
        forkDepth: 0,
      },
    )

    const filePath = await appendActivityRecord(logDir, record)
    const written = await fs.readFile(filePath, "utf8")

    expect(filePath).toBe(path.join(logDir, "ses_root.jsonl"))
    expect(written.trim()).toContain('"sessionID":"ses_root"')
  })
})

describe("ActivityViewerPlugin service lifecycle", () => {
  test("starts the in-process viewer service once during plugin initialization", async () => {
    const plugin = await ActivityViewerPlugin({
      project: { root: "/tmp/demo-project" },
    })

    expect(mockedServe).toHaveBeenCalledTimes(1)
    expect(plugin).toHaveProperty("event")
  })

  test("does not start the in-process viewer service more than once", async () => {
    await ActivityViewerPlugin({
      project: { root: "/tmp/demo-project" },
    })
    await ActivityViewerPlugin({
      project: { root: "/tmp/demo-project" },
    })

    expect(mockedServe).toHaveBeenCalledTimes(1)
  })

  test("opens the browser once when this opencode process first starts the viewer successfully", async () => {
    await ActivityViewerPlugin({
      project: { root: "/tmp/demo-project" },
    })
    await ActivityViewerPlugin({
      project: { root: "/tmp/demo-project" },
    })

    expect(mockedServe).toHaveBeenCalledTimes(1)
    expect(mockedOpenBrowser).toHaveBeenCalledTimes(1)
  })

  test("silently degrades when the in-process viewer service fails to start", async () => {
    mockedResolveStartConfig.mockRejectedValueOnce(new Error("port busy"))

    await expect(
      ActivityViewerPlugin({
        project: { root: "/tmp/demo-project" },
      }),
    ).resolves.toHaveProperty("event")
    expect(mockedServe).not.toHaveBeenCalled()
  })

  test("accepts the opencode plugin context as its only argument", async () => {
    const plugin = await ActivityViewerPlugin({
      project: { root: "/tmp/demo-project" },
      directory: "/tmp/demo-project",
      worktree: "/tmp/demo-project",
    })

    expect(plugin).toHaveProperty("event")
  })
})
