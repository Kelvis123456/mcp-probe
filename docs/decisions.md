# Decisions

## 2026-11-04: YAML probe files instead of a test framework plugin

Alternatives: a Vitest/Jest plugin where you write checks in TypeScript, or a Python library.
Why YAML: the people who maintain an MCP server may not write TypeScript, and a declarative file is easy to diff when a tool's behavior changes on purpose. The cost is that anything beyond "call, then compare text" needs a code change in the tool. I accepted that for the first version.

## 2026-11-04: A timeout is a failure, even when the spec expects an error

A tool that hangs and a tool that returns an error look the same to a naive client that only waits for "no success". I made the timeout its own error type so that `expect: { error: true }` cannot be satisfied by a hang. There is a test for it.

## 2026-11-04: A failed call means either a thrown protocol error or `isError: true`

The SDK turns bad arguments into a protocol error for some servers and into an `isError` result for others. Requiring one specific shape would make the probe fail on servers that are correct. `expect.error` accepts both.

## 2026-11-04: stdio only, tools only

Alternatives: also support Streamable HTTP and probe resources and prompts.
Why not: stdio covers the servers I write and the reference servers, and each extra transport doubles the test fixtures. I would rather ship one thing that is tested than three that are not.

## 2026-11-04: The example pins the reference server

`examples/package.json` pins `@modelcontextprotocol/server-everything` to 2.2.1 with `ignore-scripts=true`, so the example result is reproducible and installing it cannot run install scripts.
