# mcp-probe

A command-line tool that runs scripted checks against an MCP server over stdio and exits non-zero when something breaks. I wrote it because I kept shipping MCP tools (see [dominican-tools-mcp](https://github.com/Kelvis123456/dominican-tools-mcp)) and had no cheap way to notice that a refactor changed a tool's output or stopped rejecting bad input.

You describe the server and the calls you care about in a YAML file. The tool starts the server, talks to it like a client would, and prints a pass/fail line per check.

## Run it

```bash
npm ci && npm run build
node dist/cli.js examples/everything.probe.yaml --md report.md --json report.json
```

Exit code is 0 when every check passes, 1 when a check fails, 2 when the probe file is invalid or the tool itself crashed.

## What it checks

Always, with no configuration:

- the `initialize` handshake completes within the timeout
- `tools/list` answers
- every tool has a non-empty description and an `inputSchema` of type `object`
- calling a tool that does not exist fails instead of being accepted
- if `tools/list` fails, the checks that need the list (schemas, required tools, declared calls) fail too instead of passing on an empty list. Pagination is followed, up to 100 pages
- the server still answers `ping` after all the calls

From your probe file:

- required tools exist
- each call either succeeds or fails, as you declare, and optionally its first text block must contain a string, match a regex, or equal a golden value. A call whose `tool` is not in `tools/list` fails whatever `expect` says, so a typo cannot pass as an expected error. If the result has no text block at all, `equals`, `contains` and `matches` fail

```yaml
server:
  command: node
  args: [dist/server.js]
  timeoutMs: 5000
tools:
  require: [add]
calls:
  - name: adds two numbers
    tool: add
    args: { a: 2, b: 3 }
    expect: { equals: "5" }
  - name: rejects a string
    tool: add
    args: { a: "x", b: 1 }
    expect: { error: true }
```

Probe files are strict: an unknown key (`expect: { eror: true }`, `contains` outside `text:`) is an error that names the key, and a `matches` pattern that is not a valid regex fails when the file is loaded. A relative `server.cwd` is resolved against the directory of the probe file; `args` are passed as written, so a relative script path there is relative to `cwd` (or to wherever you run the tool if `cwd` is not set). The server only gets the SDK's small default environment (`PATH`, `HOME` and similar) plus what you list under `server.env`; the rest of your shell environment is not passed on.

A call that never answers is reported as a timeout. It is not treated as an expected failure, because a hung tool is exactly the thing you want the probe to catch.

## A real run

[`examples/everything.probe.yaml`](examples/everything.probe.yaml) probes the official reference server (`@modelcontextprotocol/server-everything`, pinned to 2.2.1). All 11 checks pass; the output is in [`examples/report.md`](examples/report.md). That result says the reference server behaves the way the probe expects. It is not a claim that the probe finds bugs in it.

## Limits

- stdio transport only. No HTTP or SSE servers yet.
- Tools only. Resources, prompts and sampling are not probed.
- Golden values are compared against the first text block only. Other text blocks and `structuredContent` are not looked at.
- Not published to npm. Clone the repo to use it.
- It checks behavior, not protocol conformance in the strict sense: it does not validate every message against the spec's JSON schema.

## Tests

`npm test` starts a small real MCP server (`test/fixture-server.ts`) and runs the probe against it. The fixture has modes for a server that hangs, one whose `tools/list` errors, one that pages its tool list, and one that throws protocol errors on every call. There are also tests for a server that exits during the handshake, the CLI exit codes (0, 1, 2) and the `--json` / `--md` files, and the environment and `cwd` the server receives.

Design decisions are in [docs/decisions.md](docs/decisions.md).
