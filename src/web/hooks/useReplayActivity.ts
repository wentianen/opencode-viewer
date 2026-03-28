export function useReplayActivity() {
  return {
    sessions: [],
    records: [],
    overview: {
      totalTokens: 0,
      totalCost: 0,
      totalSessions: 0,
      totalMessages: 0,
    },
  }
}
