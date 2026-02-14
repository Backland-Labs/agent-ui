import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    env: {
      LOG_LEVEL: "silent",
    },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "db/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/app/api/**", "db/**"],
      exclude: [
        "src/lib/hooks/**",
        "src/lib/agents/index.ts",
        "src/lib/agents/types.ts",
        "db/migrate.ts",
        "**/__tests__/**",
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 75,
        lines: 85,
      },
    },
  },
});
