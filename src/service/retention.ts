export type RetentionFile = {
  sessionID: string
  bytes: number
  updatedAt: number
  active: boolean
}

export function selectRetentionCandidates(files: RetentionFile[], maxFiles: number): RetentionFile[] {
  if (files.length <= maxFiles) return []

  return files
    .filter((file) => !file.active)
    .sort((left, right) => left.updatedAt - right.updatedAt)
    .slice(0, files.length - maxFiles)
}
