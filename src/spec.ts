import { parse } from "yaml";
import { z } from "zod";

const expectSchema = z
  .object({
    // true: the call must fail (protocol error or isError result). Otherwise it must succeed.
    error: z.boolean().optional(),
    text: z.object({ contains: z.string().optional(), matches: z.string().optional() }).optional(),
    // exact text of the first text block, for golden outputs
    equals: z.string().optional(),
  })
  .default({});

const callSchema = z.object({
  name: z.string(),
  tool: z.string(),
  args: z.record(z.string(), z.unknown()).default({}),
  expect: expectSchema,
});

export const specSchema = z.object({
  server: z.object({
    command: z.string(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    timeoutMs: z.number().int().positive().default(5000),
  }),
  tools: z.object({ require: z.array(z.string()).default([]) }).default({ require: [] }),
  calls: z.array(callSchema).default([]),
});

export type Spec = z.infer<typeof specSchema>;
export type CallSpec = z.infer<typeof callSchema>;

export function loadSpec(yamlText: string): Spec {
  const parsed = specSchema.safeParse(parse(yamlText));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid probe file:\n  ${issues.join("\n  ")}`);
  }
  return parsed.data;
}
