import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadSpec } from "../src/spec.js";

const base = "server:\n  command: node\n";

describe("loadSpec strictness", () => {
  it("rejects an unknown key in expect and names it", () => {
    expect(() => loadSpec(`${base}calls:\n  - name: a\n    tool: t\n    expect: { eror: true }\n`)).toThrow(/eror/);
  });

  it("rejects contains placed directly under expect", () => {
    expect(() => loadSpec(`${base}calls:\n  - name: a\n    tool: t\n    expect: { contains: "42" }\n`)).toThrow(
      /contains/,
    );
  });

  it("rejects an unknown key under server and under text", () => {
    expect(() => loadSpec("server:\n  command: node\n  timeout: 1000\n")).toThrow(/timeout/);
    expect(() =>
      loadSpec(`${base}calls:\n  - name: a\n    tool: t\n    expect: { text: { contain: x } }\n`),
    ).toThrow(/contain/);
  });

  it("rejects unknown top-level and tools keys", () => {
    expect(() => loadSpec(`${base}call: []\n`)).toThrow(/call/);
    expect(() => loadSpec(`${base}tools:\n  required: [a]\n`)).toThrow(/required/);
  });
});

describe("loadSpec regex", () => {
  it("fails at load time on a bad matches pattern, naming the pattern", () => {
    expect(() => loadSpec(`${base}calls:\n  - name: a\n    tool: t\n    expect: { text: { matches: "(" } }\n`)).toThrow(
      /invalid regular expression.*\(/i,
    );
  });
});

describe("loadSpec cwd", () => {
  it("resolves a relative cwd against the probe file directory", () => {
    const s = loadSpec(`${base}  cwd: work\n`, "/some/dir");
    expect(s.server.cwd).toBe(resolve("/some/dir", "work"));
  });

  it("leaves cwd alone when no base directory is given, and never touches args", () => {
    const s = loadSpec(`${base}  cwd: work\n  args: [dist/server.js]\n`);
    expect(s.server.cwd).toBe("work");
    expect(loadSpec(`${base}  args: [dist/server.js]\n`, "/some/dir").server.args).toEqual(["dist/server.js"]);
  });
});
