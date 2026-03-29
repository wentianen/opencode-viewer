import { spawn } from "node:child_process"

function escapeForAppleScript(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')
}

export function commandForPlatform(platform: string, url: string) {
  switch (platform) {
    case "darwin":
      return {
        command: "osascript",
        args: ["-e", `open location "${escapeForAppleScript(url)}"`],
      }
    case "win32":
      return { command: "cmd", args: ["/c", "start", "", url] }
    default:
      return { command: "xdg-open", args: [url] }
  }
}

export async function openBrowser(url: string): Promise<boolean> {
  const { command, args } = commandForPlatform(process.platform, url)

  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      detached: true,
    })

    child.on("error", () => resolve(false))
    child.unref()
    resolve(true)
  })
}
