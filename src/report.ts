import type { CheckResult } from "./runner.js";

export function toConsole(results: CheckResult[]): string {
  const lines = results.map((r) => `${r.ok ? "PASS" : "FAIL"}  ${r.name} (${r.ms} ms)${r.ok ? "" : `\n      ${r.detail}`}`);
  const failed = results.filter((r) => !r.ok).length;
  lines.push("", failed ? `${failed} of ${results.length} checks failed` : `All ${results.length} checks passed`);
  return lines.join("\n");
}

// A table cell must stay on one line and cannot contain a bare pipe.
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\r\n|\r|\n/g, "<br>");

export function toMarkdown(results: CheckResult[], title = "MCP probe report"): string {
  const rows = results.map(
    (r) => `| ${r.ok ? "pass" : "**fail**"} | ${cell(r.name)} | ${r.ms} | ${r.ok ? "" : cell(r.detail ?? "")} |`,
  );
  return [`# ${title}`, "", "| Result | Check | ms | Detail |", "| --- | --- | ---: | --- |", ...rows, ""].join("\n");
}
