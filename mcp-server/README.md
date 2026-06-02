# RemoAsset Connect MCP Server

> **New to this?** Read **[START_HERE.md](./START_HERE.md)** — step-by-step beginner guide.  
> Quick setup: `node scripts/setup-claude-mcp.mjs` from the repo root.

Connect **Claude Desktop**, **Claude Cowork**, or **Cursor** to your RemoAsset Connect CRM via MCP (Model Context Protocol).

This server exposes tools for leads/vendors, activities, tasks, follow-ups, documents, notifications, clients, and client fulfillment requests — everything available through the RemoAsset REST API.

## Prerequisites

1. **RemoAsset Connect** deployed with the `api` Edge Function live
2. An **API key** (`ra_…`) — create one in the app:
   - **Admin → API Keys**, or
   - **Developer → API Keys**
3. **Node.js 18+**

## Quick setup

### 1. Build the MCP server

```bash
cd mcp-server
npm install
npm run build
```

Or from the repo root:

```bash
npm run mcp:install
npm run mcp:build
```

### 2. Create an API key

In RemoAsset Connect (Admin or Developer page), create an API key and copy the full `ra_…` value. You only see it once.

Your API base URL is:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/api
```

(Replace `YOUR_PROJECT_REF` with your Supabase project ref — same as `VITE_SUPABASE_URL` + `/functions/v1/api`.)

### 3. Configure Claude Desktop / Cowork

Edit your MCP config file:

| Platform | Config file |
|----------|-------------|
| **macOS Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows Claude Desktop** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Claude Cowork** | Same MCP config as Claude Desktop (Settings → MCP / Connectors) |

Add this block (update paths and credentials):

```json
{
  "mcpServers": {
    "remoasset-connect": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/remoasset-connect/mcp-server/dist/index.js"
      ],
      "env": {
        "REMOASSET_API_URL": "https://YOUR_PROJECT_REF.supabase.co/functions/v1/api",
        "REMOASSET_API_KEY": "ra_YOUR_API_KEY_HERE"
      }
    }
  }
}
```

See `claude-desktop-config.example.json` for a copy-paste template.

Restart Claude after saving.

### 4. Configure Cursor

**Option A — project-level:** copy `cursor-mcp.example.json` to `.cursor/mcp.json` in this repo and fill in your paths/keys.

**Option B — global:** Cursor Settings → MCP → Add server with the same `command`, `args`, and `env` as above.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REMOASSET_API_URL` | Yes | REST API base URL ending in `/functions/v1/api` |
| `REMOASSET_API_KEY` | Yes | API key from Admin/Developer (`ra_…`) |

## Available tools

| Tool | Description |
|------|-------------|
| `remoasset_api_info` | API catalog and endpoint list |
| `remoasset_request` | Generic REST call (any method/path) |
| `remoasset_list_statuses` | Pipeline statuses |
| `remoasset_list_countries` | Countries |
| `remoasset_list_team` | Team members (for owner/assignee) |
| `remoasset_search_leads` | Search/list leads & vendors |
| `remoasset_get_lead` | Get lead by ID |
| `remoasset_create_lead` | Create lead/vendor |
| `remoasset_update_lead` | Update lead |
| `remoasset_delete_lead` | Delete lead |
| `remoasset_bulk_update_leads` | Bulk status/owner/country update |
| `remoasset_list_activities` | List activities |
| `remoasset_log_activity` | Log call/email/meeting/etc. |
| `remoasset_list_tasks` | List tasks |
| `remoasset_create_task` | Create task |
| `remoasset_update_task` | Update task |
| `remoasset_list_follow_ups` | List follow-ups |
| `remoasset_schedule_follow_up` | Schedule follow-up |
| `remoasset_list_documents` | List lead documents |
| `remoasset_list_notifications` | List notifications |
| `remoasset_send_notification` | Send notification |
| `remoasset_search_clients` | Search clients |
| `remoasset_get_client` | Get client |
| `remoasset_create_client` | Create client |
| `remoasset_update_client` | Update client |
| `remoasset_list_client_requests` | List fulfillment orders |
| `remoasset_create_client_request` | Create fulfillment order |
| `remoasset_update_client_request` | Update fulfillment order |

## Example prompts for Claude

- *"Search for leads in Germany with status Qualified"*
- *"Log an email activity on lead {id} — discussed pricing"*
- *"List all open tasks due this week"*
- *"Create a follow-up for tomorrow on lead {id}"*
- *"Show me all pending client requests"*
- *"Bulk assign these 5 leads to {owner name}"*

## Deploy API changes

If you added the MCP server before clients endpoints existed, redeploy the API function:

```bash
supabase functions deploy api
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Invalid API key` | Regenerate key in Admin; check `REMOASSET_API_KEY` has no extra spaces |
| `REMOASSET_API_URL is required` | Set full URL including `/functions/v1/api` |
| Server not showing in Claude | Restart Claude; verify absolute path to `dist/index.js` |
| `Unknown resource: clients` | Redeploy `api` Edge Function with latest code |
| Tool returns 401 | API key revoked or wrong project URL |

## Security notes

- Treat `REMOASSET_API_KEY` like a password — it has full CRM access via service role
- Use scoped/expiring keys from Admin when possible
- Never commit API keys to git

## Development

```bash
cd mcp-server
REMOASSET_API_URL=... REMOASSET_API_KEY=... npm run dev
```

Logs go to **stderr** only (stdio transport uses stdout for protocol messages).
