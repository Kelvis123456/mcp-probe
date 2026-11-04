// A tiny stdio MCP server used as the target in tests.
// FIXTURE_MODE=hang makes "add" never answer, to exercise the timeout path.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "fixture", version: "1.0.0" });

server.registerTool(
  "add",
  { description: "Add two numbers", inputSchema: { a: z.number(), b: z.number() } },
  async ({ a, b }) => {
    if (process.env.FIXTURE_MODE === "hang") await new Promise(() => undefined);
    return { content: [{ type: "text", text: String(a + b) }] };
  },
);

server.registerTool("fail", { description: "Always reports a tool error", inputSchema: {} }, async () => ({
  isError: true,
  content: [{ type: "text", text: "nope" }],
}));

await server.connect(new StdioServerTransport());
