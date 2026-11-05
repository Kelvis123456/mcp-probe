import { readFileSync } from "node:fs";
import path from "node:path";

export const REPO = "https://github.com/Kelvis123456/mcp-probe";
export const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

const root = process.cwd();
const read = (...p: string[]) => readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n");

// Both come straight from the repo's examples/ folder, so the page cannot drift from them.
export const probeYaml = read("..", "examples", "everything.probe.yaml").trimEnd();
const reportMd = read("..", "examples", "report.md");
// Saved console output of the same probe with one golden value changed (see content/README note in the page).
const failingRun = read("content", "failing-run.txt").trimEnd();
const passingRun = read("content", "passing-run.txt").trimEnd();

export type Row = { ok: boolean; name: string; ms: number; detail: string };

/** Parses the markdown table that `mcp-probe --md` writes. */
export function parseReport(md: string): Row[] {
  return md
    .split("\n")
    .filter((l) => /^\| (\*\*)?(pass|fail)/.test(l))
    .map((l) => {
      const [result, name, ms, detail] = l
        .split("|")
        .slice(1, 5)
        .map((c) => c.trim());
      return { ok: result === "pass", name, ms: Number(ms), detail: detail ?? "" };
    });
}

export const reportRows = parseReport(reportMd);

/** Parses the console output: PASS/FAIL lines, indented detail lines, then the summary. */
export function parseConsole(txt: string) {
  const lines = txt.split("\n");
  const rows: { ok: boolean; name: string; ms: string; detail?: string }[] = [];
  let summary = "";
  for (const line of lines) {
    const m = line.match(/^(PASS|FAIL)\s+(.*) \((\d+) ms\)$/);
    if (m) rows.push({ ok: m[1] === "PASS", name: m[2], ms: m[3] });
    else if (/^\s+\S/.test(line) && rows.length) rows[rows.length - 1].detail = line.trim();
    else if (line.trim()) summary = line.trim();
  }
  return { rows, summary };
}

export const failing = parseConsole(failingRun);
export const passing = parseConsole(passingRun);
