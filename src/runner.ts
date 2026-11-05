import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { CallSpec, Spec } from "./spec.js";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
  ms: number;
}

type CallOutcome = { failed: boolean; text: string | undefined };

class TimeoutError extends Error {}

// The SDK has its own 60000 ms default per request, so every request gets the probe's
// timeout explicitly, and the SDK's RequestTimeout is mapped to our TimeoutError.
async function request<T>(what: string, ms: number, fn: (opts: { timeout: number }) => Promise<T>): Promise<T> {
  try {
    return await fn({ timeout: ms });
  } catch (err) {
    if (err instanceof McpError && err.code === ErrorCode.RequestTimeout) {
      throw new TimeoutError(`${what} timed out after ${ms} ms`);
    }
    throw err;
  }
}

// A tool can fail two ways: a protocol error (thrown) or a result with isError.
// Both count as "the call failed" for expect.error. A timeout is never a clean failure.
async function callTool(client: Client, tool: string, args: Record<string, unknown>, ms: number): Promise<CallOutcome> {
  try {
    const res = await request(`call ${tool}`, ms, (opts) =>
      client.callTool({ name: tool, arguments: args }, undefined, opts),
    );
    const blocks = Array.isArray(res.content) ? res.content : [];
    const first = blocks.find((b) => b.type === "text");
    return { failed: res.isError === true, text: first && "text" in first ? String(first.text) : undefined };
  } catch (err) {
    if (err instanceof TimeoutError) throw err;
    return { failed: true, text: err instanceof Error ? err.message : String(err) };
  }
}

type Tool = Awaited<ReturnType<Client["listTools"]>>["tools"][number];

// Follows nextCursor; the page cap stops a server that never ends the list.
async function listAllTools(client: Client, ms: number): Promise<Tool[]> {
  const tools: Tool[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const res = await request("tools/list", ms, (opts) => client.listTools(cursor ? { cursor } : {}, opts));
    tools.push(...res.tools);
    if (!res.nextCursor) return tools;
    cursor = res.nextCursor;
  }
  throw new Error("tools/list did not end after 100 pages");
}

function checkExpect(call: CallSpec, out: CallOutcome): string | undefined {
  const { error, text, equals } = call.expect;
  const wantFail = error === true;
  if (out.failed !== wantFail) {
    return wantFail ? "expected the call to fail, but it succeeded" : `expected success, got failure: ${out.text ?? "(no text)"}`;
  }
  if (out.text === undefined && (text?.contains !== undefined || text?.matches !== undefined || equals !== undefined)) {
    return "expected a text block to compare, but the result has no text block";
  }
  const got = out.text ?? "";
  if (text?.contains !== undefined && !got.includes(text.contains)) {
    return `text does not contain ${JSON.stringify(text.contains)} (got ${JSON.stringify(got)})`;
  }
  // The pattern comes from the probe file the user runs on their own machine, the same
  // trust level as the server command in that file, so ReDoS here is not an attack surface.
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  if (text?.matches !== undefined && !new RegExp(text.matches).test(got)) {
    return `text does not match /${text.matches}/ (got ${JSON.stringify(got)})`;
  }
  if (equals !== undefined && got !== equals) {
    return `text differs from golden (expected ${JSON.stringify(equals)}, got ${JSON.stringify(out.text)})`;
  }
  return undefined;
}

export async function runProbe(spec: Spec): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const ms = spec.server.timeoutMs;

  async function check(name: string, fn: () => Promise<string | undefined>) {
    const start = performance.now();
    let detail: string | undefined;
    try {
      detail = await fn();
    } catch (err) {
      detail = err instanceof Error ? err.message : String(err);
    }
    results.push({ name, ok: detail === undefined, detail, ms: Math.round(performance.now() - start) });
  }

  const client = new Client({ name: "mcp-probe", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: spec.server.command,
    args: spec.server.args,
    // the SDK merges this over its own safe default environment; the rest of process.env stays out
    env: spec.server.env,
    cwd: spec.server.cwd,
    stderr: "ignore",
  });

  let connected = false;
  await check("initialize handshake", async () => {
    await request("initialize", ms, (opts) => client.connect(transport, opts));
    connected = true;
    return undefined;
  });
  if (!connected) {
    await transport.close().catch(() => undefined);
    return results;
  }

  let tools: Tool[] = [];
  let listError: string | undefined;
  await check("tools/list answers", async () => {
    try {
      tools = await listAllTools(client, ms);
    } catch (err) {
      listError = err instanceof Error ? err.message : String(err);
      throw err;
    }
    return undefined;
  });
  // Checks that read the tool list must fail, not pass on an empty list, when tools/list failed.
  const needList = () => (listError ? `tools/list failed (${listError}), so this cannot be checked` : undefined);

  await check("every tool has a description and an object input schema", async () => {
    const skip = needList();
    if (skip) return skip;
    const bad = tools.flatMap((t) => {
      const problems: string[] = [];
      if (!t.description?.trim()) problems.push("no description");
      if (t.inputSchema?.type !== "object") problems.push("inputSchema is not type object");
      return problems.length ? [`${t.name}: ${problems.join(", ")}`] : [];
    });
    return bad.length ? bad.join("; ") : undefined;
  });

  if (spec.tools.require.length) {
    await check(`required tools exist (${spec.tools.require.join(", ")})`, async () => {
      const skip = needList();
      if (skip) return skip;
      const have = new Set(tools.map((t) => t.name));
      const missing = spec.tools.require.filter((n) => !have.has(n));
      return missing.length ? `missing: ${missing.join(", ")}` : undefined;
    });
  }

  await check("unknown tool is rejected, not ignored", async () => {
    const out = await callTool(client, "__mcp_probe_no_such_tool__", {}, ms);
    return out.failed ? undefined : "server accepted a call to a tool that does not exist";
  });

  for (const call of spec.calls) {
    await check(`call: ${call.name}`, async () => {
      // An unknown tool would also "fail", which would satisfy expect.error on a typo.
      const skip = needList();
      if (skip) return skip;
      if (!tools.some((t) => t.name === call.tool)) return `tool ${JSON.stringify(call.tool)} is not in tools/list`;
      return checkExpect(call, await callTool(client, call.tool, call.args, ms));
    });
  }

  await check("server still responds after all calls", async () => {
    await request("ping", ms, (opts) => client.ping(opts));
    return undefined;
  });

  await client.close().catch(() => undefined);
  return results;
}
