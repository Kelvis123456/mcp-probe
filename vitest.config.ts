import { defineConfig } from "vitest/config";

// each test spawns a real server; cold starts on Windows can take a few seconds
export default defineConfig({ test: { testTimeout: 30_000 } });
