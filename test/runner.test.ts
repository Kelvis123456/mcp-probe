import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { fileURLToPath } from "node:url";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSpec, type Spec } from "../src/spec.js";
import { runProbe } from "../src/runner.js";
import { toMarkdown } from "../src/report.js";

const fixture = fileURLToPath(new URL("./fixture-server.ts", import.meta.url));

function spec(over: Partial<Spec> = {}, env?: Record<string, string>): Spec {
  return {
    server: { command: process.execPath, args: [fixture], env, timeoutMs: 15000 },
    tools: { require: [] },
    calls: [],
    ...over,
  };
}

const byName = (results: Awaited<ReturnType<typeof runProbe>>, part: string) => {
  const r = results.find((x) => x.name.includes(part));
  if (!r) throw new Error(`no check named like "${part}"`);
  return r;
};

describe("runProbe", () => {
  it("passes every built-in check and the declared calls on a healthy server", async () => {
    const results = await runProbe(
      spec({
        tools: { require: ["add", "fail"] },
        calls: [
          { name: "adds", tool: "add", args: { a: 2, b: 3 }, expect: { equals: "5" } },
          { name: "reports its own failure", tool: "fail", args: {}, expect: { error: true, text: { contains: "nope" } } },
          { name: "rejects a string for a number", tool: "add", args: { a: "x", b: 1 }, expect: { error: true } },
        ],
      }),
    );
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(results.length).toBeGreaterThanOrEqual(8);
  });

  it("fails a golden output that differs and a required tool that is missing", async () => {
    const results = await runProbe(
      spec({
        tools: { require: ["add", "multiply"] },
        calls: [{ name: "wrong golden", tool: "add", args: { a: 1, b: 1 }, expect: { equals: "3" } }],
      }),
    );
    expect(byName(results, "required tools").ok).toBe(false);
    expect(byName(results, "required tools").detail).toContain("multiply");
    expect(byName(results, "wrong golden").detail).toContain("differs from golden");
  });

  it("fails a call that succeeds when the spec expects an error", async () => {
    const results = await runProbe(
      spec({ calls: [{ name: "should fail", tool: "add", args: { a: 1, b: 1 }, expect: { error: true } }] }),
    );
    expect(byName(results, "should fail").ok).toBe(false);
  });

  it("reports a hanging tool as a timeout, not as a clean failure", async () => {
    const results = await runProbe(
      spec(
        { server: { command: process.execPath, args: [fixture], env: { FIXTURE_MODE: "hang" }, timeoutMs: 6000 },
          calls: [{ name: "hangs", tool: "add", args: { a: 1, b: 1 }, expect: { error: true } }] },
      ),
    );
    expect(byName(results, "hangs").ok).toBe(false);
    expect(byName(results, "hangs").detail).toContain("timed out");
  });

  it("stops after a failed handshake instead of throwing", async () => {
    const results = await runProbe(
      spec({ server: { command: process.execPath, args: ["-e", "process.exit(1)"], timeoutMs: 1500 } }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(false);
  });
});

const inMode = (mode: string, over: Partial<Spec> = {}) =>
  spec({ ...over, server: { command: process.execPath, args: [fixture], env: { FIXTURE_MODE: mode }, timeoutMs: 15000 } });

describe("runProbe findings", () => {
  it("does not hand the parent environment to the server, only what the probe lists", async () => {
    process.env.MCP_PROBE_PARENT_SECRET = "leaked";
    try {
      const results = await runProbe(
        spec(
          {
            calls: [
              { name: "parent var", tool: "getenv", args: { name: "MCP_PROBE_PARENT_SECRET" }, expect: { equals: "<unset>" } },
              { name: "listed var", tool: "getenv", args: { name: "LISTED" }, expect: { equals: "yes" } },
            ],
          },
          { LISTED: "yes" },
        ),
      );
      expect(results.filter((r) => !r.ok)).toEqual([]);
    } finally {
      delete process.env.MCP_PROBE_PARENT_SECRET;
    }
  });

  it("passes its own timeout to every SDK request so the 60 s default cannot fire first", async () => {
    const seen: unknown[] = [];
    const spies = (["callTool", "listTools", "ping", "connect"] as const).map((name) => {
      const orig = Client.prototype[name] as (...a: unknown[]) => Promise<unknown>;
      const idx = name === "callTool" ? 2 : name === "ping" ? 0 : 1; // options position: callTool(params, schema, options), others (arg, options)
      return vi.spyOn(Client.prototype, name as "ping").mockImplementation(function (this: Client, ...a: unknown[]) {
        seen.push([name, (a[idx] as { timeout?: number } | undefined)?.timeout]);
        return orig.apply(this, a) as never;
      } as never);
    });
    try {
      await runProbe(spec({ calls: [{ name: "adds", tool: "add", args: { a: 1, b: 1 }, expect: {} }] }));
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
    for (const name of ["callTool", "listTools", "ping", "connect"]) {
      expect(seen).toContainEqual([name, 15000]);
    }
  });

  it("fails a declared call whose tool is not in tools/list, even with expect.error", async () => {
    const results = await runProbe(spec({ calls: [{ name: "typo", tool: "ad", args: {}, expect: { error: true } }] }));
    expect(byName(results, "typo").ok).toBe(false);
    expect(byName(results, "typo").detail).toContain('"ad" is not in tools/list');
  });

  it("fails the checks that depend on tools/list when it errors", async () => {
    const results = await runProbe(
      inMode("nolist", {
        tools: { require: ["add"] },
        calls: [{ name: "adds", tool: "add", args: { a: 1, b: 1 }, expect: {} }],
      }),
    );
    expect(byName(results, "tools/list").ok).toBe(false);
    expect(byName(results, "description and an object").ok).toBe(false);
    expect(byName(results, "required tools").ok).toBe(false);
    expect(byName(results, "adds").ok).toBe(false);
    expect(byName(results, "adds").detail).toContain("tools/list failed");
  });

  it("follows nextCursor so tools on later pages are seen", async () => {
    const results = await runProbe(
      inMode("paged", {
        tools: { require: ["add", "fail"] },
        calls: [{ name: "adds", tool: "add", args: { a: 1, b: 2 }, expect: { equals: "3" } }],
      }),
    );
    expect(results.filter((r) => !r.ok)).toEqual([]);
  });

  it("fails equals and contains when the result has no text block, including equals empty string", async () => {
    const results = await runProbe(
      spec({
        calls: [
          { name: "empty equals", tool: "image", args: {}, expect: { equals: "" } },
          { name: "contains", tool: "image", args: {}, expect: { text: { contains: "" } } },
          { name: "matches", tool: "image", args: {}, expect: { text: { matches: ".*" } } },
          { name: "no text asserted", tool: "image", args: {}, expect: {} },
        ],
      }),
    );
    for (const n of ["empty equals", "contains", "matches"]) {
      expect(byName(results, n).ok).toBe(false);
      expect(byName(results, n).detail).toContain("no text block");
    }
    expect(byName(results, "no text asserted").ok).toBe(true);
  });

  it("passes contains and matches on a successful call and fails them when wrong", async () => {
    const results = await runProbe(
      spec({
        calls: [
          { name: "contains ok", tool: "add", args: { a: 20, b: 22 }, expect: { text: { contains: "42" } } },
          { name: "matches ok", tool: "add", args: { a: 20, b: 22 }, expect: { text: { matches: "^[0-9]+$" } } },
          { name: "contains bad", tool: "add", args: { a: 1, b: 1 }, expect: { text: { contains: "42" } } },
          { name: "matches bad", tool: "add", args: { a: 1, b: 1 }, expect: { text: { matches: "^4" } } },
        ],
      }),
    );
    expect(byName(results, "contains ok").ok).toBe(true);
    expect(byName(results, "matches ok").ok).toBe(true);
    expect(byName(results, "contains bad").detail).toContain("does not contain");
    expect(byName(results, "matches bad").detail).toContain("does not match");
  });

  it("treats a thrown protocol error as a failed call: ok for expect.error, a failure otherwise", async () => {
    const results = await runProbe(
      inMode("protocol", {
        calls: [
          { name: "expected", tool: "add", args: { a: 1, b: 1 }, expect: { error: true, text: { contains: "kaboom" } } },
          { name: "unexpected", tool: "add", args: { a: 1, b: 1 }, expect: {} },
        ],
      }),
    );
    expect(byName(results, "expected").ok).toBe(true);
    expect(byName(results, "unexpected").ok).toBe(false);
    expect(byName(results, "unexpected").detail).toContain("kaboom");
  });

  it("runs the server in the cwd from the probe", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "probe-cwd-")));
    try {
      const results = await runProbe(
        spec({
          server: { command: process.execPath, args: [fixture], cwd: dir, timeoutMs: 15000 },
          calls: [{ name: "where", tool: "cwd", args: {}, expect: { equals: dir } }],
        }),
      );
      expect(byName(results, "where").ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("loadSpec", () => {
  it("applies defaults", () => {
    const s = loadSpec("server:\n  command: node\n");
    expect(s.server.timeoutMs).toBe(5000);
    expect(s.calls).toEqual([]);
  });

  it("names the field that is wrong", () => {
    expect(() => loadSpec("server:\n  args: []\n")).toThrow(/server\.command/);
  });
});

describe("toMarkdown", () => {
  it("escapes pipes so a detail cannot break the table", () => {
    const md = toMarkdown([{ name: "x", ok: false, detail: "a|b", ms: 1 }]);
    expect(md).toContain("a\\|b");
  });
});
