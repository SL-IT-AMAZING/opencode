import { defineConfig } from "vitest/config"
import solidPlugin from "vite-plugin-solid"

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      thresholds: {
        perFile: true,
        lines: 100,
        statements: 100,
        branches: 100,
        functions: 100,
      },
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.*", "src/**/*.stories.*", "src/**/types.ts", "src/**/index.ts"],
    },
  },
  resolve: {
    conditions: ["development", "browser"],
  },
})
