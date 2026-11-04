import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadSpec, type Spec } from "../src/spec.js";
import { runProbe } from "../src/runner.js";
import { toMarkdown } from "../src/report.js";

const fixture = fileURLToPath(new URL("./fixture-server.ts", import.meta.url));

function spec(over: Partial<Spec> = {}, env?: Record<string, string>): Spec {
  return {
    server: { command: process.execPath, args: [fixture], env, timeoutMs: 3000 },
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
        { server: { command: process.execPath, args: [fixture], env: { FIXTURE_MODE: "hang" }, timeoutMs: 1500 },
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
