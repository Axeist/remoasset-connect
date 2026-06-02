# Connect Claude to RemoAsset Connect (Beginner Guide)

Use Claude Desktop or Claude Cowork to manage your CRM — leads, vendors, tasks, clients, pricing, and more — by talking to it in plain English.

---

## Step 1 — Install Node.js (one time)

1. Go to **https://nodejs.org**
2. Download the **LTS** version and install it
3. Open **Terminal** and run: `node --version` — you should see v18 or higher

---

## Step 2 — Create an API key in RemoAsset

1. Log into **RemoAsset Connect** in your browser
2. Go to **Admin → API Keys** (or **Developer → API Keys**)
3. Click **Create API Key**, give it a name like `Claude`
4. **Copy the full key** — it starts with `ra_` and is only shown once

---

## Step 3 — Run the setup script (one time)

Open Terminal, go to this project folder, and run:

```bash
cd /Users/axeist/remoasset-connect
node scripts/setup-claude-mcp.mjs
```

The script will:
- Install and build the MCP connector
- Ask for your Supabase URL (auto-read from `.env` if present)
- Ask for your API key
- Configure **Claude Desktop** and **Cursor** automatically

---

## Step 4 — Deploy the API (one time)

If you haven't already, deploy the REST API so Claude can reach your data:

```bash
supabase functions deploy api
```

---

## Step 5 — Restart Claude

1. **Quit Claude completely** (Cmd+Q on Mac)
2. Open Claude again
3. You should see **remoasset-connect** in the MCP / connectors area

---

## Step 6 — Test it

Ask Claude:

> **Use remoasset_help — what can you do in RemoAsset Connect?**

Then try:

| What you want | Example prompt |
|---------------|----------------|
| Find leads | "Search for leads in Germany with status Qualified" |
| Add activity | "Log an email on lead {company name} — sent pricing sheet" |
| Tasks | "List my open tasks due this week" |
| Follow-up | "Schedule a follow-up tomorrow for lead {id}" |
| Clients | "List all clients and their pending orders" |
| Transfer | "Transfer lead {company} to {team member name}" |
| Pricing | "Show device pricing for vendor {name}" |

---

## What works through Claude

| App area | Via Claude? |
|----------|-------------|
| Leads & vendors | ✅ Full CRUD, search, bulk update |
| Pipeline / statuses | ✅ |
| Activities (calls, emails, meetings, NDA, etc.) | ✅ |
| Tasks | ✅ |
| Follow-ups | ✅ |
| Documents (list/metadata) | ✅ List; file upload still in app |
| Notifications | ✅ |
| Clients & fulfillment orders | ✅ |
| Device pricing | ✅ |
| Warehouse pricing | ✅ |
| Lead transfers | ✅ |
| Team / countries / statuses | ✅ |

## What still needs the web app

| Feature | Why |
|---------|-----|
| Gmail inbox | Needs Google login in browser |
| Vendor AI agent | Separate AI chat in app |
| Upload PDF/documents | File storage upload in app |
| Invite/ban users | Admin security UI |

For anything not listed above, Claude can use **`remoasset_request`** to call any API endpoint directly.

---

## Troubleshooting

**"npm not found"** → Install Node.js from nodejs.org, restart Terminal, run setup again.

**"Invalid API key"** → Create a new key in Admin; paste the full `ra_…` key with no spaces.

**Claude doesn't show tools** → Quit Claude fully (Cmd+Q), reopen. Check config exists at:
`~/Library/Application Support/Claude/claude_desktop_config.json`

**"Unknown resource: clients"** → Run `supabase functions deploy api`

**Need to re-run setup?** → `node scripts/setup-claude-mcp.mjs` again

---

## Files created by setup

| File | Purpose |
|------|---------|
| `mcp-server/dist/index.js` | The connector Claude runs |
| `mcp-server/.env` | Your API URL + key (don't commit) |
| `.cursor/mcp.json` | Cursor MCP config |
| Claude config (outside repo) | Claude Desktop / Cowork config |

Technical details: see `mcp-server/README.md`
