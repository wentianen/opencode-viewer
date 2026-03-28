import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { WEB_DIST_DIR } from "./src/build/layout"

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: WEB_DIST_DIR,
    emptyOutDir: false,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
})
