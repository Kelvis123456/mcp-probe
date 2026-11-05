#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadSpec } from "./spec.js";
import { runProbe } from "./runner.js";
import { toConsole, toMarkdown } from "./report.js";

const usage = "Usage: mcp-probe <probe.yaml> [--json out.json] [--md out.md]";

function usageError(message: string): never {
  console.error(`${message}\n${usage}`);
  process.exit(2);
}

const argv = process.argv.slice(2);
if (argv[0] === "--help") {
  console.log(usage);
  process.exit(0);
}
const [file, ...flags] = argv;
if (!file || file.startsWith("--")) usageError("Missing probe file.");

const out: { "--json"?: string; "--md"?: string } = {};
for (let i = 0; i < flags.length; i += 2) {
  const name = flags[i];
  if (name !== "--json" && name !== "--md") usageError(`Unknown argument: ${name}`);
  const value = flags[i + 1];
  if (value === undefined || value.startsWith("--")) usageError(`${name} needs a file path.`);
  out[name] = value;
}

try {
  const spec = loadSpec(readFileSync(file, "utf8"), dirname(resolve(file)));
  const results = await runProbe(spec);
  console.log(toConsole(results));
  if (out["--json"]) writeFileSync(out["--json"], JSON.stringify(results, null, 2));
  if (out["--md"]) writeFileSync(out["--md"], toMarkdown(results));
  process.exit(results.every((r) => r.ok) ? 0 : 1);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
}
