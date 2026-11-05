import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixture = fileURLToPath(new URL("./fixture-server.ts", import.meta.url));
// Built under node_modules so the compiled CLI still resolves its dependencies,
// and so the test does not depend on `npm run build` having run first.
const outDir = join(root, "node_modules", ".cache", "mcp-probe-cli-test");
const cli = join(outDir, "cli.js");

beforeAll(() => {
  execFileSync(
    process.execPath,
    [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.build.json", "--outDir", outDir],
    { cwd: root },
  );
}, 120_000);

const q = (s: string) => JSON.stringify(s);

function probeFile(dir: string, calls: string, extraServer = "") {
  const file = join(dir, "x.probe.yaml");
  writeFileSync(
    file,
    `server:\n  command: ${q(process.execPath)}\n  args: [${q(fixture)}]\n  timeoutMs: 15000\n${extraServer}calls:\n${calls}`,
  );
  return file;
}

const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", cwd: root });

function withDir<T>(fn: (dir: string) => T): T {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "probe-cli-")));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const okCall = `  - name: adds\n    tool: add\n    args: { a: 1, b: 2 }\n    expect: { equals: "3" }\n`;
const badCall = `  - name: wrong golden\n    tool: add\n    args: { a: 1, b: 2 }\n    expect: { equals: "4" }\n`;

describe("cli", () => {
  it("exits 0 and writes the --json and --md files when everything passes", () =>
    withDir((dir) => {
      const json = join(dir, "r.json");
      const md = join(dir, "r.md");
      const res = run(probeFile(dir, okCall), "--json", json, "--md", md);
      expect(res.status).toBe(0);
      const parsed = JSON.parse(readFileSync(json, "utf8")) as { ok: boolean }[];
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed.every((r) => r.ok)).toBe(true);
      expect(readFileSync(md, "utf8")).toContain("| Result | Check | ms | Detail |");
    }));

  it("exits 1 when a check fails, and still writes the reports", () =>
    withDir((dir) => {
      const md = join(dir, "r.md");
      const res = run(probeFile(dir, badCall), "--md", md);
      expect(res.status).toBe(1);
      expect(res.stdout).toContain("FAIL  call: wrong golden");
      expect(readFileSync(md, "utf8")).toContain("**fail**");
    }));

  it("exits 2 on an invalid probe file and names the unknown key", () =>
    withDir((dir) => {
      const file = probeFile(dir, `  - name: a\n    tool: add\n    expect: { eror: true }\n`);
      const res = run(file);
      expect(res.status).toBe(2);
      expect(res.stderr).toContain("eror");
    }));

  it("exits 2 when the probe file does not exist", () => {
    expect(run(join(tmpdir(), "no-such-probe.yaml")).status).toBe(2);
  });

  it("exits 2 with usage for no arguments, an unknown flag, or a flag without a value", () =>
    withDir((dir) => {
      const file = probeFile(dir, okCall);
      const json = join(dir, "should-not-exist.json");
      for (const args of [[], [file, "--jsno", json], [file, "--json"], [file, "--json", "--md"], [file, "--md", "--json", json]]) {
        const res = run(...args);
        expect(res.status, args.join(" ")).toBe(2);
        expect(res.stdout + res.stderr).toContain("Usage:");
      }
      expect(existsSync(json)).toBe(false);
    }));

  it("--help prints usage and exits 0", () => {
    const res = run("--help");
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Usage:");
  });

  it("resolves server.cwd against the probe file, not the shell directory", () =>
    withDir((dir) => {
      mkdirSync(join(dir, "work"));
      const call = `  - name: where\n    tool: cwd\n    expect: { equals: ${q(join(dir, "work"))} }\n`;
      const res = run(probeFile(dir, call, "  cwd: work\n"));
      expect(res.stdout).toContain("PASS  call: where");
      expect(res.status).toBe(0);
    }));
});
