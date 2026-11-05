// A tiny stdio MCP server used as the target in tests.
// FIXTURE_MODE changes how it misbehaves:
//   hang      "add" never answers, to exercise the timeout path
//   nolist    tools/list returns a protocol error
//   paged     tools/list splits the tools over two pages (nextCursor)
//   protocol  every tools/call throws a protocol error instead of returning a result
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const mode = process.env.FIXTURE_MODE;
const server = new McpServer({ name: "fixture", version: "1.0.0" });

server.registerTool(
  "add",
  { description: "Add two numbers", inputSchema: { a: z.number(), b: z.number() } },
  async ({ a, b }) => {
    if (mode === "hang") await new Promise(() => undefined);
    return { content: [{ type: "text", text: String(a + b) }] };
  },
);

server.registerTool("fail", { description: "Always reports a tool error", inputSchema: {} }, async () => ({
  isError: true,
  content: [{ type: "text", text: "nope" }],
}));

server.registerTool("image", { description: "Returns no text block", inputSchema: {} }, async () => ({
  content: [{ type: "image", data: "AAAA", mimeType: "image/png" }],
}));

server.registerTool(
  "getenv",
  { description: "Reads an environment variable", inputSchema: { name: z.string() } },
  async ({ name }) => ({ content: [{ type: "text", text: process.env[name] ?? "<unset>" }] }),
);

server.registerTool("cwd", { description: "Reports the working directory", inputSchema: {} }, async () => ({
  content: [{ type: "text", text: process.cwd() }],
}));

const def = (name: string) => ({ name, description: name, inputSchema: { type: "object" as const } });

if (mode === "nolist") {
  server.server.setRequestHandler(ListToolsRequestSchema, async () => {
    throw new McpError(ErrorCode.InternalError, "list exploded");
  });
}
if (mode === "paged") {
  server.server.setRequestHandler(ListToolsRequestSchema, async (req) =>
    req.params?.cursor ? { tools: [def("fail")] } : { tools: [def("add")], nextCursor: "page2" },
  );
}
if (mode === "protocol") {
  server.server.setRequestHandler(CallToolRequestSchema, async () => {
    throw new McpError(ErrorCode.InternalError, "kaboom");
  });
}

await server.connect(new StdioServerTransport());
