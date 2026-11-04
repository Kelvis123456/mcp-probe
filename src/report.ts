import type { CheckResult } from "./runner.js";

export function toConsole(results: CheckResult[]): string {
  const lines = results.map((r) => `${r.ok ? "PASS" : "FAIL"}  ${r.name} (${r.ms} ms)${r.ok ? "" : `\n      ${r.detail}`}`);
  const failed = results.filter((r) => !r.ok).length;
  lines.push("", failed ? `${failed} of ${results.length} checks failed` : `All ${results.length} checks passed`);
  return lines.join("\n");
}

export function toMarkdown(results: CheckResult[], title = "MCP probe report"): string {
  const rows = results.map(
    (r) => `| ${r.ok ? "pass" : "**fail**"} | ${r.name} | ${r.ms} | ${r.ok ? "" : (r.detail ?? "").replace(/\|/g, "\\|")} |`,
  );
  return [`# ${title}`, "", "| Result | Check | ms | Detail |", "| --- | --- | ---: | --- |", ...rows, ""].join("\n");
}
