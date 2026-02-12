# HackerNews MCP Server

An MCP server that lets Claude read and interact with [Hacker News](https://news.ycombinator.com). Reads use the official Firebase API; writes (posting, commenting, voting) go through the HN web interface with cookie-based auth.

## Tools

| Tool | Description | Auth |
|------|-------------|------|
| `hn_get_item` | Get a story, comment, poll, or job by ID | No |
| `hn_get_user` | Get a user profile by username | No |
| `hn_get_stories` | Get story IDs from a feed (top/new/best/ask/show/job) | No |
| `hn_login` | Log in to HackerNews | — |
| `hn_submit_story` | Submit a link or text post | Yes |
| `hn_comment` | Reply to a story or comment | Yes |
| `hn_upvote` | Upvote an item | Yes |

## Setup

```bash
npm install
npm run build
```

### Claude Code

```bash
claude mcp add hackernews node /path/to/hackernews-mcp/build/index.js
```

### Claude Desktop

Add to your config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hackernews": {
      "command": "node",
      "args": ["/path/to/hackernews-mcp/build/index.js"]
    }
  }
}
```

## Authentication

Write tools require logging in first via `hn_login`. You can either:

- Pass `username` and `password` as tool parameters
- Set `HN_USERNAME` and `HN_PASSWORD` environment variables

```json
{
  "mcpServers": {
    "hackernews": {
      "command": "node",
      "args": ["/path/to/hackernews-mcp/build/index.js"],
      "env": {
        "HN_USERNAME": "your_username",
        "HN_PASSWORD": "your_password"
      }
    }
  }
}
```

## License

MIT
