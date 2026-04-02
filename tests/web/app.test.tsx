import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
    const { container } = render(<App />)

    expect(screen.getByText("Activity Viewer")).toBeTruthy()
    expect(container.querySelector(".hero-strip .overview-strip")).toBeTruthy()
    expect(screen.getByLabelText("Usage Overview")).toBeTruthy()
    expect(screen.getByLabelText("Session List")).toBeTruthy()
    expect(screen.getByLabelText("Timeline")).toBeTruthy()
    expect(screen.getByLabelText("Detail")).toBeTruthy()
    expect(screen.queryByText("Cost")).toBeNull()
    expect(container.querySelector(".session-list.panel-scroll-region")).toBeTruthy()
    expect(container.querySelector(".timeline-list.panel-scroll-region")).toBeTruthy()

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1)
    })

    MockEventSource.instances[0]?.dispatch("snapshot", {
      overview: {
        totalTokens: 1250000,
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
          id: "evt_prompt_root",
          sessionID: "root",
          rootSessionID: "root",
          kind: "chat",
          type: "chat.message",
          actor: "user",
          target: "agent:build",
          summary: "Summarize logs",
          payload: { role: "user", text: "Summarize logs" },
          usage: { total: 5 },
        },
        {
          id: "evt_prompt_child",
          sessionID: "child",
          rootSessionID: "root",
          kind: "chat",
          type: "chat.message",
          actor: "user",
          target: "agent:build",
          summary: "Check fork error",
          payload: { role: "user", text: "Check fork error" },
          usage: { total: 3 },
        },
        {
          id: "evt_1",
          sessionID: "child",
          rootSessionID: "root",
          kind: "tool",
          type: "tool.execute.after",
          actor: "agent:build",
          target: "tool:bash",
          summary: "Executed bash",
          rawPayload: { title: "ls", outputPreview: "README.md", token: "secret-value" },
          payload: { title: "ls", outputPreview: "README.md", token: "[REDACTED]" },
          usage: { total: 1234 },
        },
        {
          id: "evt_2",
          sessionID: "root",
          rootSessionID: "root",
          kind: "message",
          type: "message.updated",
          actor: "assistant",
          target: "model:gpt-5.4",
          summary: "Assistant replied",
          rawPayload: { role: "assistant", text: "full raw answer" },
          payload: { role: "assistant", text: "full raw answer" },
          usage: { total: 1250 },
        },
      ],
    })

    const tree = screen.getByLabelText("Session List")
    const timeline = screen.getByLabelText("Timeline")
    const detail = screen.getByLabelText("Detail")

    await waitFor(() => {
      expect(screen.getByText("1.3M")).toBeTruthy()
      expect(screen.getByTitle("1,250,000 tokens")).toBeTruthy()
      expect(screen.getByText("$0.15")).toBeTruthy()
      expect(screen.getByText("Cost")).toBeTruthy()
      expect(within(tree).getByText("Summarize logs")).toBeTruthy()
      expect(within(tree).getByText("Check fork error")).toBeTruthy()
      expect(screen.getByText("1.3K")).toBeTruthy()
      expect(screen.getByTitle("1,255 tokens")).toBeTruthy()
      expect(within(timeline).getByText("Summarize logs")).toBeTruthy()
      expect(within(timeline).getAllByText("build").length).toBeGreaterThan(0)
    })

    const rootSession = within(tree).getByText("Summarize logs").closest("button")
    const childSession = within(tree).getByText("Check fork error").closest("button")

    expect(rootSession?.className).toContain("is-selected")
    expect(childSession?.className).not.toContain("is-selected")
    expect(detail.textContent).toContain("Summarize logs")
    expect(within(timeline).queryByText("Check fork error")).toBeNull()
    expect(within(timeline).queryByText("bash — ls")).toBeNull()

    expect(screen.getByRole("button", { name: /^All\b/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /^chat\b/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /^message\b/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^tool\b/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Raw" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Sanitized" })).toBeNull()
    expect(screen.queryByText(/secret-value/)).toBeNull()
    expect(screen.queryByText(/\[REDACTED\]/)).toBeNull()

    fireEvent.click(childSession as HTMLButtonElement)

    await waitFor(() => {
      expect(childSession?.className).toContain("is-selected")
      expect(rootSession?.className).not.toContain("is-selected")
      expect(detail.textContent).toContain("Check fork error")
      expect(within(timeline).getByText("Check fork error")).toBeTruthy()
      expect(within(tree).getByText("1.2K")).toBeTruthy()
      expect(within(tree).getByTitle("1,237 tokens")).toBeTruthy()
      expect(screen.getByRole("button", { name: /^tool\b/ })).toBeTruthy()
      expect(screen.queryByRole("button", { name: /^message\b/ })).toBeNull()
    })

    fireEvent.click(screen.getByRole("button", { name: /^tool\b/ }))

    await waitFor(() => {
      expect(within(timeline).getByText("bash — ls")).toBeTruthy()
      expect(within(timeline).getByText("1.2K tok")).toBeTruthy()
      expect(within(timeline).getByTitle("1,234 tokens")).toBeTruthy()
    })

    fireEvent.click(within(timeline).getByText("bash — ls"))

    await waitFor(() => {
      expect(childSession?.className).toContain("is-selected")
      expect(detail.textContent).toContain("secret-value")
    })

    fireEvent.click(screen.getByRole("button", { name: /^chat\b/ }))

    await waitFor(() => {
      expect(within(timeline).getByText("Check fork error")).toBeTruthy()
      expect(within(timeline).queryByText("Summarize logs")).toBeNull()
      expect(within(timeline).queryByText("gpt-5.4")).toBeNull()
      expect(within(timeline).queryByText("bash — ls")).toBeNull()
    })

    fireEvent.click(rootSession as HTMLButtonElement)

    await waitFor(() => {
      expect(rootSession?.className).toContain("is-selected")
      expect(screen.getByRole("button", { name: /^message\b/ })).toBeTruthy()
      expect(screen.queryByRole("button", { name: /^tool\b/ })).toBeNull()
    })

    fireEvent.click(screen.getByRole("button", { name: /^message\b/ }))

    await waitFor(() => {
      expect(within(timeline).queryByText("bash — ls")).toBeNull()
      expect(within(timeline).getAllByText("gpt-5.4").length).toBeGreaterThan(0)
    })
  })
})
