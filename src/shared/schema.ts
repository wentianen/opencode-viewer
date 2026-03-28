import { z } from "zod"

const NonNegativeNumber = z.number().finite().nonnegative()

export const UsageSchema = z.object({
  total: NonNegativeNumber,
  input: NonNegativeNumber,
  output: NonNegativeNumber,
  reasoning: NonNegativeNumber,
  cacheRead: NonNegativeNumber,
  cacheWrite: NonNegativeNumber,
  cost: NonNegativeNumber,
})

export const ActivityRecordSchema = z.object({
  id: z.string(),
  ts: NonNegativeNumber,
  sessionID: z.string(),
  parentSessionID: z.string().optional(),
  rootSessionID: z.string(),
  forkDepth: z.number().int().nonnegative(),
  kind: z.enum(["session", "message", "tool", "chat", "system"]),
  type: z.string(),
  actor: z.string(),
  target: z.string(),
  direction: z.enum(["inbound", "outbound", "internal"]),
  summary: z.string(),
  refs: z.record(z.string(), z.string().optional()),
  payload: z.record(z.string(), z.unknown()),
  flags: z.object({
    truncated: z.boolean(),
    redacted: z.boolean(),
    error: z.boolean(),
  }),
  usage: UsageSchema.optional(),
})

export const SessionAggregateSchema = z.object({
  sessionID: z.string(),
  parentSessionID: z.string().optional(),
  rootSessionID: z.string(),
  forkDepth: z.number().int().nonnegative(),
  selfTotals: z.object({
    tokens: NonNegativeNumber,
    cost: NonNegativeNumber,
    messages: NonNegativeNumber,
  }),
  subtreeTotals: z.object({
    tokens: NonNegativeNumber,
    cost: NonNegativeNumber,
    messages: NonNegativeNumber,
  }),
})

export type Usage = z.infer<typeof UsageSchema>
export type ActivityRecord = z.infer<typeof ActivityRecordSchema>
export type SessionAggregate = z.infer<typeof SessionAggregateSchema>
