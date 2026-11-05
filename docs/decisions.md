# Decisions

## 2026-11-04: YAML probe files instead of a test framework plugin

Alternatives: a Vitest/Jest plugin where you write checks in TypeScript, or a Python library.
Why YAML: the people who maintain an MCP server may not write TypeScript, and a declarative file is easy to diff when a tool's behavior changes on purpose. The cost is that anything beyond "call, then compare text" needs a code change in the tool. I accepted that for the first version.

## 2026-11-04: A timeout is a failure, even when the spec expects an error

A tool that hangs and a tool that returns an error look the same to a naive client that only waits for "no success". I made the timeout its own error type, and every SDK request is given the probe's `timeoutMs` explicitly (the SDK's own default is 60 s and would otherwise fire first for larger values). The SDK's RequestTimeout is mapped to that error. What is tested: a hanging `add` with `expect: { error: true }` fails with "timed out" (`reports a hanging tool as a timeout`), and a spy test checks that connect, tools/list, tools/call and ping all receive the timeout option. I did not test a real wait over 60 s.

## 2026-11-04: A failed call means either a thrown protocol error or `isError: true`

The SDK turns bad arguments into a protocol error for some servers and into an `isError` result for others. Requiring one specific shape would make the probe fail on servers that are correct. `expect.error` accepts both. The protocol-error half is tested with a fixture mode where every `tools/call` throws (`treats a thrown protocol error as a failed call`): it passes with `expect.error` and fails, with the message, without it. The `isError` half is covered by the `fail` tool.

## 2026-11-05: Strict probe files, and a declared call to an unknown tool always fails

An independent audit found that zod was silently dropping unknown keys, so `expect: { contains: "42" }` (missing `text:`) turned a check into a pass. All schema objects are strict now and the error names the key. For the same reason a call whose tool is not in `tools/list` fails even with `expect.error`, because an unknown tool also errors and a typo would satisfy it. `equals`/`contains`/`matches` fail when the result has no text block, so `equals: ""` cannot pass on an image-only result.

## 2026-11-05: The server gets only the SDK default environment plus `server.env`

Before, setting any `env` merged all of `process.env` into the server. The SDK already merges `env` over a small safe default, so I pass `env` as written. The cost is that a server that needs, say, an API key from your shell must have it listed in the probe file. There is a test that a parent variable is not visible.

## 2026-11-04: stdio only, tools only

Alternatives: also support Streamable HTTP and probe resources and prompts.
Why not: stdio covers the servers I write and the reference servers, and each extra transport doubles the test fixtures. I would rather ship one thing that is tested than three that are not.

## 2026-11-04: The example pins the reference server

`examples/package.json` pins `@modelcontextprotocol/server-everything` to 2.2.1 with `ignore-scripts=true`, so the example result is reproducible and installing it cannot run install scripts.
