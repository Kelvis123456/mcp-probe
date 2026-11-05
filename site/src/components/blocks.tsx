import type { ReactNode } from "react";
import type { Row } from "@/lib/content";

/** Plain-text YAML coloring: comments muted, keys bold. No hues. */
export function Yaml({ source }: { source: string }) {
  return (
    <pre className="code whitespace-pre-wrap [overflow-wrap:anywhere]" aria-label="Probe file">
      {source.split("\n").map((line, i) => {
        if (line.trimStart().startsWith("#")) {
          return (
            <span key={i} className="block text-muted">
              {line || " "}
            </span>
          );
        }
        const m = line.match(/^(\s*(?:- )?)([\w-]+)(:)(.*)$/);
        return (
          <span key={i} className="block">
            {m ? (
              <>
                {m[1]}
                <b className="font-semibold">{m[2]}</b>
                {m[3]}
                {m[4]}
              </>
            ) : (
              line || " "
            )}
          </span>
        );
      })}
    </pre>
  );
}

type ConsoleRow = { ok: boolean; name: string; ms: string; detail?: string };

/** The tool's own console output, as styled text. The failing line is the only colored thing. */
export function Console({
  rows,
  summary,
  label,
}: {
  rows: ConsoleRow[];
  summary: string;
  label: string;
}) {
  return (
    <pre className="code" aria-label={label}>
      {rows.map((r, i) => (
        <span
          key={i}
          className="block whitespace-pre-wrap pl-[6ch] -indent-[6ch] [overflow-wrap:anywhere]"
        >
          <span className={r.ok ? "text-muted" : "font-bold text-fail"}>
            {r.ok ? "PASS" : "FAIL"}
          </span>
          {"  "}
          <span className={r.ok ? "" : "font-semibold text-fail"}>{r.name}</span>{" "}
          <span className="text-muted">({r.ms} ms)</span>
          {r.detail && <span className="block indent-0 text-fail">{r.detail}</span>}
        </span>
      ))}
      <span className="mt-3 block font-semibold">{summary}</span>
    </pre>
  );
}

/** The markdown report from examples/report.md, as an HTML table. */
export function ReportTable({ rows }: { rows: Row[] }) {
  const hasDetail = rows.some((r) => r.detail);
  return (
    <div className="overflow-x-auto">
      <table className="code w-full border-collapse text-left">
        <caption className="sr-only">Report written by mcp-probe for the reference server</caption>
        <thead>
          <tr className="border-b border-ink">
            <th scope="col" className="py-2 pr-4 font-semibold">
              Result
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Check
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              ms
            </th>
            {hasDetail && (
              <th scope="col" className="py-2 pl-4 font-semibold">
                Detail
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className={r.ok ? "" : "text-fail"}>
              <td className="py-1.5 pr-4 align-top font-semibold">{r.ok ? "pass" : "fail"}</td>
              <td className="py-1.5 pr-4 align-top">{r.name}</td>
              <td className="py-1.5 text-right align-top">{r.ms}</td>
              {hasDetail && <td className="py-1.5 pl-4 align-top">{r.detail}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A block of code with a plain caption above it, no window chrome. */
export function Figure({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 font-mono text-[0.8125rem] text-muted">{caption}</figcaption>
      <div className="border border-ink bg-panel p-4 sm:p-5">{children}</div>
    </figure>
  );
}
