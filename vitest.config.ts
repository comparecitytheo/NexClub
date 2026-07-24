import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Unit tests don't process CSS; skip the project's PostCSS/Tailwind pipeline.
  css: { postcss: { plugins: [] } },
  // Match Next.js's automatic JSX runtime so components can be rendered in tests
  // (via react-dom/server) without importing React. No effect on logic-only suites.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
