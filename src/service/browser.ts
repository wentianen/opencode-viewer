import { spawn } from "node:child_process"

function commandForPlatform(url: string) {
  switch (process.platform) {
    case "darwin":
      return { command: "open", args: [url] }
    case "win32":
      return { command: "cmd", args: ["/c", "start", "", url] }
    default:
      return { command: "xdg-open", args: [url] }
  }
}

export async function openBrowser(url: string): Promise<boolean> {
  const { command, args } = commandForPlatform(url)

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
