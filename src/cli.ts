#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { loadSpec } from "./spec.js";
import { runProbe } from "./runner.js";
import { toConsole, toMarkdown } from "./report.js";

const [file, ...flags] = process.argv.slice(2);
if (!file || file === "--help") {
  console.log("Usage: mcp-probe <probe.yaml> [--json out.json] [--md out.md]");
  process.exit(file ? 0 : 2);
}
const flag = (name: string) => {
  const i = flags.indexOf(name);
  return i >= 0 ? flags[i + 1] : undefined;
};

try {
  const results = await runProbe(loadSpec(readFileSync(file, "utf8")));
  console.log(toConsole(results));
  const json = flag("--json");
  const md = flag("--md");
  if (json) writeFileSync(json, JSON.stringify(results, null, 2));
  if (md) writeFileSync(md, toMarkdown(results));
  process.exit(results.every((r) => r.ok) ? 0 : 1);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
}
