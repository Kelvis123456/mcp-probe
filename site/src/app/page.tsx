import { Console, Figure, ReportTable, Yaml } from "@/components/blocks";
import { REPO, SITE_URL, failing, passing, probeYaml, reportRows } from "@/lib/content";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  name: "mcp-probe",
  description:
    "Command-line tool that runs scripted checks against an MCP server over stdio and exits non-zero when something breaks.",
  codeRepository: REPO,
  programmingLanguage: "TypeScript",
  runtimePlatform: "Node.js 20 or newer",
  license: "https://opensource.org/license/mit",
  url: SITE_URL,
  author: { "@type": "Person", name: "Kelvis123456", url: "https://github.com/Kelvis123456" },
};

const always = [
  ["initialize", "The handshake completes within the timeout."],
  [
    "tools/list",
    "The server answers it. Pagination is followed, up to 100 pages. If it fails, the checks that need the list fail too instead of passing on an empty one.",
  ],
  ["tool metadata", "Every tool has a non-empty description and an input schema of type object."],
  ["unknown tool", "Calling a tool that does not exist fails instead of being accepted."],
  ["ping", "The server still answers after all the calls have run."],
];

const fromFile = [
  ["require", "The tools you list exist."],
  [
    "calls",
    "Each call succeeds or fails, as you declare. Optionally its first text block must contain a string, match a regex, or equal a golden value. A call to a tool that is not in tools/list fails whatever you expect, so a typo cannot pass as an expected error. If the result has no text block, equals, contains and matches fail.",
  ],
  [
    "strict files",
    "An unknown key in the probe file is an error that names the key. A matches pattern that is not a valid regex fails when the file is loaded.",
  ],
  [
    "environment",
    "The server only gets the SDK's small default environment plus what you list under server.env. A relative server.cwd is resolved against the probe file's directory.",
  ],
  ["CLI flags", "Unknown or incomplete flags exit with code 2 instead of being ignored."],
];

const limits = [
  ["stdio only.", "No HTTP or SSE servers yet."],
  ["Tools only.", "Resources, prompts and sampling are not probed."],
  [
    "Golden values compare the first text block.",
    "Other text blocks and structuredContent are not looked at.",
  ],
  ["Not on npm.", "Clone the repo to use it."],
  [
    "Behavior, not strict conformance.",
    "It does not validate every message against the spec's JSON schema.",
  ],
];

const exitCodes = [
  ["0", "Every check passes."],
  ["1", "A check fails."],
  ["2", "The probe file is invalid, or the tool itself crashed."],
];

const wrap = "mx-auto w-full max-w-[72rem] px-5 sm:px-8";

export default function Home() {
  return (
    <>
      <header className="border-b border-rule">
        <div className={`${wrap} flex h-16 items-center justify-between`}>
          <span className="font-mono text-base font-semibold">mcp-probe</span>
          <a href={REPO} className="link font-mono text-sm">
            View on GitHub
          </a>
        </div>
      </header>

      <main id="main">
        <section
          className={`${wrap} grid gap-10 pb-16 pt-12 md:pb-24 md:pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-14`}
        >
          <div className="min-w-0">
            <h1
              className="rise font-mono text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl"
              style={{ "--i": 0 } as React.CSSProperties}
            >
              Scripted checks for MCP servers
            </h1>
            <p
              className="rise mt-6 max-w-[34rem] text-lg"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              Write the calls you care about in YAML. mcp-probe runs them against your server and
              exits non-zero on failure.
            </p>
            <div
              className="rise mt-8 flex flex-wrap gap-3"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              <a href={REPO} className="btn btn-solid">
                View on GitHub
              </a>
              <a href="#run" className="btn btn-line">
                See a real run
              </a>
            </div>
            <pre
              className="code rise mt-10 whitespace-pre-wrap border-l-2 border-ink pl-4 [overflow-wrap:anywhere]"
              style={{ "--i": 3 } as React.CSSProperties}
              aria-label="Install and run commands"
            >
              {`git clone ${REPO}\ncd mcp-probe && npm ci && npm run build\nnode dist/cli.js examples/everything.probe.yaml`}
            </pre>
          </div>
          <div className="rise min-w-0 self-end" style={{ "--i": 4 } as React.CSSProperties}>
            <Figure caption="Output of that last command">
              <Console
                rows={passing.rows}
                summary={passing.summary}
                label="Console output, all checks passing"
              />
            </Figure>
          </div>
        </section>

        <section className="border-t border-rule py-16 md:py-24">
          <div className={wrap}>
            <h2 className="max-w-[40rem] font-mono text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              A refactor can change a tool without failing anything
            </h2>
            <div className="mt-6 max-w-[40rem] space-y-4 md:ml-[8%]">
              <p>
                An MCP tool can start returning different text after a refactor, or stop rejecting
                bad input. Nothing breaks until a client trips on it.
              </p>
              <p>
                I wrote mcp-probe after shipping a few MCP tools with no cheap way to notice that.
                You describe the server and the calls you care about once. The tool starts the
                server, talks to it the way a client would, and prints a pass or fail line per
                check.
              </p>
            </div>
          </div>
        </section>

        <section id="run" className="border-t border-rule py-16 md:py-24">
          <div className={wrap}>
            <h2 className="max-w-[40rem] font-mono text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              Declare the calls, read the report
            </h2>
            <p className="mt-6 max-w-[40rem]">
              Both files below are unedited copies from the repo&rsquo;s{" "}
              <code className="font-mono text-[0.9em]">examples/</code> folder. The probe targets
              the official reference server, pinned to 2.2.1, and all 11 checks pass.
            </p>
            <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
              <Figure caption="examples/everything.probe.yaml">
                <Yaml source={probeYaml} />
              </Figure>
              <Figure caption="examples/report.md">
                <ReportTable rows={reportRows} />
              </Figure>
            </div>
            <p className="mt-8 max-w-[40rem] text-muted">
              That result says the reference server behaves the way the probe expects. It is not a
              claim that the probe finds bugs in it.
            </p>
          </div>
        </section>

        <section className="border-t border-rule py-16 md:py-24">
          <div className={wrap}>
            <h2 className="max-w-[40rem] font-mono text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              A changed expectation turns one line red
            </h2>
            <p className="mt-6 max-w-[40rem]">
              To see a failure, I changed the first golden value in that probe from{" "}
              <code className="font-mono text-[0.9em]">Echo: hello</code> to{" "}
              <code className="font-mono text-[0.9em]">Hello: hello</code> and ran it again. This is
              the real output. The process exited with code 1.
            </p>
            <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
              <Figure caption="Same probe, one golden value changed">
                <Console
                  rows={failing.rows}
                  summary={failing.summary}
                  label="Console output, one check failing"
                />
              </Figure>
              <div className="min-w-0">
                <h3 className="font-mono text-base font-semibold">Exit codes</h3>
                <dl className="mt-4 space-y-3">
                  {exitCodes.map(([code, text]) => (
                    <div key={code} className="grid grid-cols-[2rem_1fr] gap-2">
                      <dt className="font-mono font-semibold">{code}</dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-8">
                  A call that never answers is reported as a timeout. It does not count as an
                  expected failure, because a hung tool is exactly what you want the probe to catch.
                </p>
                <p className="mt-4">
                  <code className="font-mono text-[0.9em]">expect: {"{ error: true }"}</code>{" "}
                  accepts both a thrown protocol error and a result with{" "}
                  <code className="font-mono text-[0.9em]">isError: true</code>, since correct
                  servers do either.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-rule py-16 md:py-24">
          <div className={wrap}>
            <h2 className="max-w-[40rem] font-mono text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              What it checks
            </h2>
            <div className="mt-10 grid gap-12 md:grid-cols-2 md:gap-16">
              <div>
                <h3 className="font-mono text-base font-semibold">Always, with no configuration</h3>
                <dl className="mt-5 space-y-4">
                  {always.map(([k, v]) => (
                    <div key={k} className="grid gap-x-4 sm:grid-cols-[10rem_1fr]">
                      <dt className="font-mono text-[0.9375rem] font-medium">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <h3 className="font-mono text-base font-semibold">From your probe file</h3>
                <dl className="mt-5 space-y-4">
                  {fromFile.map(([k, v]) => (
                    <div key={k} className="grid gap-x-4 sm:grid-cols-[10rem_1fr]">
                      <dt className="font-mono text-[0.9375rem] font-medium">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-ink bg-panel py-16 md:py-24">
          <div className={wrap}>
            <h2 className="max-w-[40rem] font-mono text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              What it does not do
            </h2>
            <ul className="mt-10 max-w-[48rem] space-y-5">
              {limits.map(([lead, rest]) => (
                <li key={lead} className="text-xl leading-snug sm:text-2xl">
                  <strong className="font-semibold">{lead}</strong>{" "}
                  <span className="text-muted">{rest}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-rule py-16 md:py-24">
          <div className={wrap}>
            <h2 className="max-w-[40rem] font-mono text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              Tested, and audited once
            </h2>
            <div className="mt-6 max-w-[40rem] space-y-4">
              <p>
                The suite has 32 tests in 3 files. It starts a small real MCP server and runs the
                probe against it, including a server that hangs, one whose tools/list errors, one
                that pages its tool list, and one that throws protocol errors on every call.
              </p>
              <p>
                An independent audit found checks that could pass when they should fail: probe files
                that silently dropped unknown keys, typo&rsquo;d tool names satisfying an expected
                error, timeouts counted as expected failures, and the whole shell environment
                leaking into the server. All four are fixed. The reasoning is in{" "}
                <a href={`${REPO}/blob/main/docs/decisions.md`} className="link">
                  docs/decisions.md
                </a>
                . An audit is not a guarantee that no others remain.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink">
        <div
          className={`${wrap} flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div>
            <p className="font-mono text-base font-semibold">mcp-probe</p>
            <p className="mt-1 text-muted">
              MIT license. Built with Node 20 or newer and TypeScript.
            </p>
          </div>
          <a href={REPO} className="btn btn-solid self-start sm:self-auto">
            View on GitHub
          </a>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }}
      />
    </>
  );
}
