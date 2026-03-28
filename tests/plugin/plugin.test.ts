import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"
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
    expect(record.payload).toEqual({
      title: "ls",
      outputPreview: "README.md",
    })
  })

  test("captures tool.execute.before with sanitized args for clearer request tracing", () => {
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
    expect(record.payload).toEqual({
      title: "run bash",
      args: {
        command: "echo hello",
        token: "[REDACTED]",
      },
    })
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
  })
})

describe("mapMessageEvent", () => {
  test("maps assistant message usage and message refs into an activity record", () => {
    const record = mapMessageEvent(
      {
        type: "message.updated",
        info: {
          id: "msg_1",
          sessionID: "ses_root",
          role: "assistant",
          agent: "build",
          modelID: "gpt-5.4",
          providerID: "openai",
          time: { created: 1 },
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
  test("maps message.part.updated into a message activity record with part refs", () => {
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
    expect(record.refs).toEqual({
      messageID: "msg_1",
      partID: "part_1",
    })
    expect(record.summary).toContain("message.part.updated")
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
    const startInProcessViewerService = vi.fn().mockResolvedValue(true)
    const plugin = await ActivityViewerPlugin({
      startInProcessViewerService,
    })

    expect(startInProcessViewerService).toHaveBeenCalledTimes(1)
    expect(plugin).toHaveProperty("event")
  })

  test("does not start the in-process viewer service more than once", async () => {
    const startInProcessViewerService = vi.fn().mockResolvedValue(true)

    await ActivityViewerPlugin({
      startInProcessViewerService,
    })
    await ActivityViewerPlugin({
      startInProcessViewerService,
    })

    expect(startInProcessViewerService).toHaveBeenCalledTimes(1)
  })

  test("silently degrades when the in-process viewer service fails to start", async () => {
    const startInProcessViewerService = vi.fn().mockRejectedValue(new Error("port busy"))

    await expect(
      ActivityViewerPlugin({
        startInProcessViewerService,
      }),
    ).resolves.toHaveProperty("event")
    expect(startInProcessViewerService).toHaveBeenCalledTimes(1)
  })
})
