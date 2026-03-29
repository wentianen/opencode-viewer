import { describe, expect, test } from "vitest"
import { commandForPlatform } from "../../src/service/browser"

describe("commandForPlatform", () => {
  test("uses AppleScript open location on darwin for more reliable browser opening", () => {
    expect(commandForPlatform("darwin", "http://127.0.0.1:4310")).toEqual({
      command: "osascript",
      args: [
        "-e",
        'open location "http://127.0.0.1:4310"',
      ],
    })
  })

  test("uses cmd start on win32", () => {
    expect(commandForPlatform("win32", "http://127.0.0.1:4310")).toEqual({
      command: "cmd",
      args: ["/c", "start", "", "http://127.0.0.1:4310"],
    })
  })

  test("uses xdg-open on other platforms", () => {
    expect(commandForPlatform("linux", "http://127.0.0.1:4310")).toEqual({
      command: "xdg-open",
      args: ["http://127.0.0.1:4310"],
    })
  })
})
