#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApiClientFromEnv } from './api-client.js';
import { registerRemoAssetTools } from './tools.js';

async function main() {
  const api = createApiClientFromEnv();

  const server = new McpServer({
    name: 'remoasset-connect',
    version: '1.0.0',
  });

  registerRemoAssetTools(server, api);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('RemoAsset Connect MCP server running (stdio)');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
