import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallSpec, Spec } from "./spec.js";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
  ms: number;
}

type CallOutcome = { failed: boolean; text: string };

class TimeoutError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${what} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

// A tool can fail two ways: a protocol error (thrown) or a result with isError.
// Both count as "the call failed" for expect.error. A timeout is never a clean failure.
async function callTool(client: Client, tool: string, args: Record<string, unknown>, ms: number): Promise<CallOutcome> {
  try {
    const res = await withTimeout(client.callTool({ name: tool, arguments: args }), ms, `call ${tool}`);
    const blocks = Array.isArray(res.content) ? res.content : [];
    const first = blocks.find((b) => b.type === "text");
    return { failed: res.isError === true, text: first && "text" in first ? String(first.text) : "" };
  } catch (err) {
    if (err instanceof TimeoutError) throw err;
    return { failed: true, text: err instanceof Error ? err.message : String(err) };
  }
}

function checkExpect(call: CallSpec, out: CallOutcome): string | undefined {
  const { error, text, equals } = call.expect;
  const wantFail = error === true;
  if (out.failed !== wantFail) {
    return wantFail ? "expected the call to fail, but it succeeded" : `expected success, got failure: ${out.text}`;
  }
  if (text?.contains !== undefined && !out.text.includes(text.contains)) {
    return `text does not contain ${JSON.stringify(text.contains)} (got ${JSON.stringify(out.text)})`;
  }
  if (text?.matches !== undefined && !new RegExp(text.matches).test(out.text)) {
    return `text does not match /${text.matches}/ (got ${JSON.stringify(out.text)})`;
  }
  if (equals !== undefined && out.text !== equals) {
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
    env: spec.server.env ? ({ ...process.env, ...spec.server.env } as Record<string, string>) : undefined,
    cwd: spec.server.cwd,
    stderr: "ignore",
  });

  let connected = false;
  await check("initialize handshake", async () => {
    await withTimeout(client.connect(transport), ms, "initialize");
    connected = true;
    return undefined;
  });
  if (!connected) {
    await transport.close().catch(() => undefined);
    return results;
  }

  let tools: Awaited<ReturnType<Client["listTools"]>>["tools"] = [];
  await check("tools/list answers", async () => {
    tools = (await withTimeout(client.listTools(), ms, "tools/list")).tools;
    return undefined;
  });

  await check("every tool has a description and an object input schema", async () => {
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
    await check(`call: ${call.name}`, async () => checkExpect(call, await callTool(client, call.tool, call.args, ms)));
  }

  await check("server still responds after all calls", async () => {
    await withTimeout(client.ping(), ms, "ping");
    return undefined;
  });

  await client.close().catch(() => undefined);
  return results;
}
