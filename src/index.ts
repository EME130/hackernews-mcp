#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { HNClient } from "./hn-client.js";

const client = new HNClient();

const server = new McpServer({
  name: "hackernews",
  version: "1.0.0",
});

// ── Read tools ──

server.tool(
  "hn_get_item",
  "Get a HackerNews item (story, comment, poll, job) by ID",
  { id: z.number().int().positive().describe("The item ID") },
  async ({ id }) => {
    try {
      const item = await client.getItem(id);
      return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  },
);

server.tool(
  "hn_get_user",
  "Get a HackerNews user profile by username",
  { username: z.string().describe("The username to look up") },
  async ({ username }) => {
    try {
      const user = await client.getUser(username);
      return { content: [{ type: "text", text: JSON.stringify(user, null, 2) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  },
);

server.tool(
  "hn_get_stories",
  "Get story IDs from a HackerNews feed (top, new, best, ask, show, job)",
  {
    type: z
      .enum(["top", "new", "best", "ask", "show", "job"])
      .default("top")
      .describe("The story feed type"),
    limit: z
      .number()
      .int()
      .positive()
      .max(500)
      .default(30)
      .describe("Max number of story IDs to return"),
  },
  async ({ type, limit }) => {
    try {
      const ids = await client.getStories(type);
      const sliced = ids.slice(0, limit);
      return { content: [{ type: "text", text: JSON.stringify(sliced) }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  },
);

// ── Write tools ──

server.tool(
  "hn_login",
  "Log in to HackerNews. Uses params or HN_USERNAME/HN_PASSWORD env vars.",
  {
    username: z
      .string()
      .optional()
      .describe("HN username (falls back to HN_USERNAME env var)"),
    password: z
      .string()
      .optional()
      .describe("HN password (falls back to HN_PASSWORD env var)"),
  },
  async ({ username, password }) => {
    try {
      const user = username || process.env.HN_USERNAME;
      const pass = password || process.env.HN_PASSWORD;
      if (!user || !pass) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Username and password required. Pass them as params or set HN_USERNAME/HN_PASSWORD env vars.",
            },
          ],
        };
      }
      const result = await client.login(user, pass);
      return { content: [{ type: "text", text: result }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  },
);

server.tool(
  "hn_submit_story",
  "Submit a story to HackerNews. Provide a URL for a link post, or text for an Ask HN.",
  {
    title: z.string().describe("Story title"),
    url: z.string().url().optional().describe("URL for a link post"),
    text: z.string().optional().describe("Body text for an Ask HN / text post"),
  },
  async ({ title, url, text }) => {
    try {
      const result = await client.submitStory(title, url, text);
      return { content: [{ type: "text", text: result }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  },
);

server.tool(
  "hn_comment",
  "Post a comment on a HackerNews story or reply to another comment",
  {
    parent_id: z.number().int().positive().describe("ID of the story or comment to reply to"),
    text: z.string().describe("Comment text"),
  },
  async ({ parent_id, text }) => {
    try {
      const result = await client.comment(parent_id, text);
      return { content: [{ type: "text", text: result }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  },
);

server.tool(
  "hn_upvote",
  "Upvote a HackerNews story or comment",
  { id: z.number().int().positive().describe("ID of the item to upvote") },
  async ({ id }) => {
    try {
      const result = await client.upvote(id);
      return { content: [{ type: "text", text: result }] };
    } catch (e: unknown) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  },
);

// ── Start server ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HackerNews MCP server running on stdio");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
