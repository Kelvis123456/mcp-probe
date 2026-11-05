import { parse } from "yaml";
import { resolve } from "node:path";
import { z } from "zod";

// The pattern comes from the probe file the user runs on their own machine, the same
// trust level as the server command in that file, so ReDoS here is not an attack surface.
function isValidRegex(pattern: string): boolean {
  try {
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

const expectSchema = z
  .strictObject({
    // true: the call must fail (protocol error or isError result). Otherwise it must succeed.
    error: z.boolean().optional(),
    text: z
      .strictObject({
        contains: z.string().optional(),
        matches: z.string().refine(isValidRegex, { error: (iss) => `invalid regular expression ${JSON.stringify(iss.input)}` }).optional(),
      })
      .optional(),
    // exact text of the first text block, for golden outputs
    equals: z.string().optional(),
  })
  .default({});

const callSchema = z.strictObject({
  name: z.string(),
  tool: z.string(),
  args: z.record(z.string(), z.unknown()).default({}),
  expect: expectSchema,
});

export const specSchema = z.strictObject({
  server: z.strictObject({
    command: z.string(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    timeoutMs: z.number().int().positive().default(5000),
  }),
  tools: z.strictObject({ require: z.array(z.string()).default([]) }).default({ require: [] }),
  calls: z.array(callSchema).default([]),
});

export type Spec = z.infer<typeof specSchema>;
export type CallSpec = z.infer<typeof callSchema>;

// baseDir is the directory of the probe file; a relative server.cwd is resolved against it.
export function loadSpec(yamlText: string, baseDir?: string): Spec {
  const parsed = specSchema.safeParse(parse(yamlText));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid probe file:\n  ${issues.join("\n  ")}`);
  }
  const spec = parsed.data;
  if (baseDir && spec.server.cwd) spec.server.cwd = resolve(baseDir, spec.server.cwd);
  return spec;
}
