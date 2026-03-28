import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { App } from "../../src/web/App"

class MockEventSource {
  static instances: MockEventSource[] = []

  listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>()
  url: string

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    const current = this.listeners.get(type) ?? []
    current.push(listener)
    this.listeners.set(type, current)
  }

  dispatch(type: string, data: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
    })

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }

  close() {}
}

describe("App", () => {
  beforeEach(() => {
    MockEventSource.instances = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.endsWith("/api/overview")) {
          return {
            ok: true,
            json: async () => ({
              totalTokens: 0,
              totalCost: 0,
              totalSessions: 0,
              totalMessages: 0,
            }),
          }
        }

        if (input.endsWith("/api/records")) {
          return {
            ok: true,
            json: async () => [],
          }
        }

        return {
          ok: true,
          json: async () => [],
        }
      }),
    )
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test("renders live updates pushed from the service stream", async () => {
    render(<App />)

    expect(screen.getByText("Activity Viewer")).toBeTruthy()
    expect(screen.getByLabelText("Usage Overview")).toBeTruthy()
    expect(screen.getByLabelText("Session Tree")).toBeTruthy()
    expect(screen.getByLabelText("Timeline")).toBeTruthy()
    expect(screen.getByLabelText("Detail")).toBeTruthy()

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1)
    })

    MockEventSource.instances[0]?.dispatch("snapshot", {
      overview: {
        totalTokens: 150,
        totalCost: 0.15,
        totalSessions: 2,
        totalMessages: 2,
      },
      sessions: [
        {
          sessionID: "root",
          rootSessionID: "root",
          forkDepth: 0,
          selfTotals: { tokens: 100, cost: 0.1, messages: 1 },
          subtreeTotals: { tokens: 150, cost: 0.15, messages: 2 },
        },
        {
          sessionID: "child",
          parentSessionID: "root",
          rootSessionID: "root",
          forkDepth: 1,
          selfTotals: { tokens: 50, cost: 0.05, messages: 1 },
          subtreeTotals: { tokens: 50, cost: 0.05, messages: 1 },
        },
      ],
      records: [
        {
          id: "evt_1",
          type: "tool.execute.after",
          actor: "agent:build",
          target: "tool:bash",
          summary: "Executed bash",
          payload: { title: "ls", outputPreview: "README.md" },
          usage: { total: 84 },
        },
      ],
    })

    await waitFor(() => {
      expect(screen.getByText("150")).toBeTruthy()
      expect(screen.getByText("Root Session")).toBeTruthy()
      expect(screen.getByText("Fork #1")).toBeTruthy()
      expect(screen.getByText("Executed bash")).toBeTruthy()
      expect(screen.getByText("agent:build")).toBeTruthy()
    })
  })
})
