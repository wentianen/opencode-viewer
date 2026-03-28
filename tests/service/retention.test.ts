import { describe, expect, test } from "vitest"
import { selectRetentionCandidates } from "../../src/service/retention"

describe("selectRetentionCandidates", () => {
  test("evicts the oldest inactive sessions first", () => {
    const candidates = selectRetentionCandidates(
      [
        { sessionID: "a", bytes: 10, updatedAt: 1, active: false },
        { sessionID: "b", bytes: 20, updatedAt: 2, active: false },
        { sessionID: "c", bytes: 30, updatedAt: 3, active: true },
      ],
      2,
    )

    expect(candidates).toEqual([{ sessionID: "a", bytes: 10, updatedAt: 1, active: false }])
  })
})
