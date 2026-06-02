import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RemoAssetApiClient } from './api-client.js';
import { formatJson } from './api-client.js';

const paginationSchema = {
  limit: z.number().int().min(1).max(100).optional().describe('Page size (max 100, default 50)'),
  offset: z.number().int().min(0).optional().describe('Pagination offset'),
};

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: formatJson(data) }] };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true as const };
}

export function registerRemoAssetTools(server: McpServer, api: RemoAssetApiClient) {
  server.tool(
    'remoasset_help',
    'START HERE — explains everything Claude can do in RemoAsset Connect and which tool to use for each app feature.',
    {},
    async () => {
      return textResult({
        overview: 'RemoAsset Connect MCP — control your CRM from Claude. Vendors are leads with vendor_types.',
        app_features: {
          leads_and_vendors: 'remoasset_search_leads, remoasset_get_lead, remoasset_create_lead, remoasset_update_lead, remoasset_delete_lead, remoasset_bulk_update_leads',
          pipeline: 'Use remoasset_search_leads with status_id from remoasset_list_statuses',
          activities: 'remoasset_list_activities, remoasset_log_activity',
          tasks: 'remoasset_list_tasks, remoasset_create_task, remoasset_update_task',
          follow_ups: 'remoasset_list_follow_ups, remoasset_schedule_follow_up',
          documents: 'remoasset_list_documents (metadata; file upload still via app)',
          notifications: 'remoasset_list_notifications, remoasset_send_notification',
          clients: 'remoasset_search_clients, remoasset_get_client, remoasset_create_client, remoasset_update_client',
          client_orders: 'remoasset_list_client_requests, remoasset_create_client_request, remoasset_update_client_request',
          device_pricing: 'remoasset_list_device_pricing, remoasset_create_device_pricing, remoasset_update_device_pricing',
          warehouse_pricing: 'remoasset_list_warehouse_pricing, remoasset_create_warehouse_pricing, remoasset_update_warehouse_pricing',
          transfer_lead: 'remoasset_transfer_lead',
          reference_data: 'remoasset_list_statuses, remoasset_list_countries, remoasset_list_team, remoasset_list_profiles',
          anything_else: 'remoasset_request — call any REST endpoint directly',
        },
        not_available_via_mcp: [
          'Gmail inbox (requires Google OAuth in browser)',
          'Vendor AI agent chat (use app UI)',
          'User invite/ban (admin user management UI)',
          'File upload to storage (use app; then reference via documents API)',
        ],
        tips: [
          'Always call remoasset_list_statuses first when filtering by pipeline stage',
          'Use remoasset_list_team to get user_id for owner/assignee fields',
          'vendor_types: new_device, refurbished, rental, warehouse, itad',
        ],
      });
    }
  );

  server.tool(
    'remoasset_api_info',
    'Get RemoAsset Connect API catalog — lists all available REST endpoints and auth requirements.',
    {},
    async () => {
      try {
        return textResult(await api.request('GET', '/'));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_request',
    'Call any RemoAsset Connect REST API endpoint. Use remoasset_api_info first to discover paths. Paths start with / (e.g. /leads, /tasks/:id).',
    {
      method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']).describe('HTTP method'),
      path: z.string().describe('API path, e.g. /leads or /leads/uuid-here or /leads/bulk'),
      query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Query parameters as key-value pairs'),
      body: z.record(z.unknown()).optional().describe('JSON request body for POST/PATCH'),
    },
    async ({ method, path, query, body }) => {
      try {
        return textResult(await api.request(method, path, { query, body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ─── Reference data ───────────────────────────────────────────────────────

  server.tool('remoasset_list_statuses', 'List all lead pipeline statuses (id, name, color, sort_order).', {}, async () => {
    try {
      return textResult(await api.request('GET', '/statuses'));
    } catch (error) {
      return toolError(error);
    }
  });

  server.tool('remoasset_list_countries', 'List all countries (id, name, code, region).', {}, async () => {
    try {
      return textResult(await api.request('GET', '/countries'));
    } catch (error) {
      return toolError(error);
    }
  });

  server.tool('remoasset_list_team', 'List team members with user_id, role, and full_name for owner/assignee assignment.', {}, async () => {
    try {
      return textResult(await api.request('GET', '/team'));
    } catch (error) {
      return toolError(error);
    }
  });

  server.tool('remoasset_list_profiles', 'List user profiles (user_id, full_name, designation, phone).', paginationSchema, async ({ limit }) => {
    try {
      return textResult(await api.request('GET', '/profiles', { query: { limit } }));
    } catch (error) {
      return toolError(error);
    }
  });

  // ─── Leads (vendors are leads with vendor_types) ──────────────────────────

  server.tool(
    'remoasset_search_leads',
    'Search and list leads/vendors. Supports text search, status, and owner filters.',
    {
      search: z.string().optional().describe('Search company, contact name, or email'),
      status_id: z.string().uuid().optional(),
      owner_id: z.string().uuid().optional(),
      ...paginationSchema,
    },
    async ({ search, status_id, owner_id, limit, offset }) => {
      try {
        return textResult(await api.request('GET', '/leads', {
          query: { search, q: search, status_id, owner_id, limit, offset },
        }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool('remoasset_get_lead', 'Get a single lead by ID with all fields.', {
    id: z.string().uuid(),
  }, async ({ id }) => {
    try {
      return textResult(await api.request('GET', `/leads/${id}`));
    } catch (error) {
      return toolError(error);
    }
  });

  server.tool(
    'remoasset_create_lead',
    'Create a new lead/vendor. Required: company_name, website, status_id, vendor_types (array).',
    {
      body: z.record(z.unknown()).describe('Lead fields — see API docs for full schema'),
    },
    async ({ body }) => {
      try {
        return textResult(await api.request('POST', '/leads', { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_update_lead',
    'Update a lead by ID. Pass only fields to change.',
    {
      id: z.string().uuid(),
      body: z.record(z.unknown()),
    },
    async ({ id, body }) => {
      try {
        return textResult(await api.request('PATCH', `/leads/${id}`, { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool('remoasset_delete_lead', 'Permanently delete a lead and all associated data.', {
    id: z.string().uuid(),
  }, async ({ id }) => {
    try {
      return textResult(await api.request('DELETE', `/leads/${id}`));
    } catch (error) {
      return toolError(error);
    }
  });

  server.tool(
    'remoasset_bulk_update_leads',
    'Bulk update leads — change status, owner, or served countries for multiple leads at once.',
    {
      lead_ids: z.array(z.string().uuid()).min(1),
      status_id: z.string().uuid().optional(),
      owner_id: z.string().uuid().nullable().optional(),
      country_ids: z.array(z.string().uuid()).optional(),
    },
    async ({ lead_ids, status_id, owner_id, country_ids }) => {
      try {
        return textResult(await api.request('PATCH', '/leads/bulk', {
          body: { lead_ids, status_id, owner_id, country_ids },
        }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ─── Activities ───────────────────────────────────────────────────────────

  server.tool(
    'remoasset_list_activities',
    'List lead activities (calls, emails, meetings, notes, NDA, etc.).',
    {
      lead_id: z.string().uuid().optional(),
      ...paginationSchema,
    },
    async ({ lead_id, limit, offset }) => {
      try {
        return textResult(await api.request('GET', '/activities', { query: { lead_id, limit, offset } }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_log_activity',
    'Log a new activity on a lead. Required: lead_id, user_id, activity_type, description.',
    {
      body: z.object({
        lead_id: z.string().uuid(),
        user_id: z.string().uuid(),
        activity_type: z.enum(['call', 'email', 'meeting', 'note', 'whatsapp', 'linkedin', 'nda', 'quotation']),
        description: z.string(),
        attachments: z.array(z.record(z.unknown())).optional(),
      }).passthrough(),
    },
    async ({ body }) => {
      try {
        return textResult(await api.request('POST', '/activities', { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ─── Tasks ────────────────────────────────────────────────────────────────

  server.tool(
    'remoasset_list_tasks',
    'List tasks with optional filters by assignee, lead, or completion status.',
    {
      assignee_id: z.string().uuid().optional(),
      lead_id: z.string().uuid().optional(),
      is_completed: z.boolean().optional(),
      ...paginationSchema,
    },
    async ({ assignee_id, lead_id, is_completed, limit, offset }) => {
      try {
        return textResult(await api.request('GET', '/tasks', {
          query: { assignee_id, lead_id, is_completed, limit, offset },
        }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_create_task',
    'Create a task. Required: title, assignee_id. Optional: lead_id, due_date, priority, description.',
    {
      body: z.record(z.unknown()),
    },
    async ({ body }) => {
      try {
        return textResult(await api.request('POST', '/tasks', { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_update_task',
    'Update a task (e.g. mark complete, change due date).',
    {
      id: z.string().uuid(),
      body: z.record(z.unknown()),
    },
    async ({ id, body }) => {
      try {
        return textResult(await api.request('PATCH', `/tasks/${id}`, { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ─── Follow-ups ───────────────────────────────────────────────────────────

  server.tool(
    'remoasset_list_follow_ups',
    'List scheduled follow-ups for leads.',
    {
      lead_id: z.string().uuid().optional(),
      user_id: z.string().uuid().optional(),
      ...paginationSchema,
    },
    async ({ lead_id, user_id, limit, offset }) => {
      try {
        return textResult(await api.request('GET', '/follow_ups', { query: { lead_id, user_id, limit, offset } }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_schedule_follow_up',
    'Schedule a follow-up reminder. Required: lead_id, user_id, scheduled_at.',
    {
      body: z.record(z.unknown()),
    },
    async ({ body }) => {
      try {
        return textResult(await api.request('POST', '/follow_ups', { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ─── Documents ────────────────────────────────────────────────────────────

  server.tool(
    'remoasset_list_documents',
    'List documents attached to a lead (NDA, pricing, quotations).',
    {
      lead_id: z.string().uuid(),
      ...paginationSchema,
    },
    async ({ lead_id, limit, offset }) => {
      try {
        return textResult(await api.request('GET', '/documents', { query: { lead_id, limit, offset } }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ─── Notifications ────────────────────────────────────────────────────────

  server.tool(
    'remoasset_list_notifications',
    'List in-app notifications for a user.',
    {
      user_id: z.string().uuid(),
      ...paginationSchema,
    },
    async ({ user_id, limit, offset }) => {
      try {
        return textResult(await api.request('GET', '/notifications', { query: { user_id, limit, offset } }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_send_notification',
    'Send an in-app notification to a user.',
    {
      user_id: z.string().uuid(),
      title: z.string(),
      message: z.string(),
      type: z.string().optional(),
    },
    async ({ user_id, title, message, type }) => {
      try {
        return textResult(await api.request('POST', '/notifications', {
          body: { user_id, title, message, type: type ?? 'info' },
        }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ─── Clients ──────────────────────────────────────────────────────────────

  server.tool(
    'remoasset_search_clients',
    'Search and list client organizations RemoAsset serves.',
    {
      search: z.string().optional(),
      ...paginationSchema,
    },
    async ({ search, limit, offset }) => {
      try {
        return textResult(await api.request('GET', '/clients', { query: { search, q: search, limit, offset } }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool('remoasset_get_client', 'Get a client organization by ID.', {
    id: z.string().uuid(),
  }, async ({ id }) => {
    try {
      return textResult(await api.request('GET', `/clients/${id}`));
    } catch (error) {
      return toolError(error);
    }
  });

  server.tool(
    'remoasset_create_client',
    'Create a client organization. Required: name.',
    { body: z.record(z.unknown()) },
    async ({ body }) => {
      try {
        return textResult(await api.request('POST', '/clients', { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_update_client',
    'Update a client organization.',
    { id: z.string().uuid(), body: z.record(z.unknown()) },
    async ({ id, body }) => {
      try {
        return textResult(await api.request('PATCH', `/clients/${id}`, { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ─── Client requests (fulfillment orders) ─────────────────────────────────

  server.tool(
    'remoasset_list_client_requests',
    'List laptop fulfillment orders tracked per client.',
    {
      client_id: z.string().uuid().optional(),
      status: z.enum(['pending', 'vendor_allocated', 'ordered', 'in_transit', 'fulfilled', 'cancelled']).optional(),
      ...paginationSchema,
    },
    async ({ client_id, status, limit, offset }) => {
      try {
        return textResult(await api.request('GET', '/client_requests', { query: { client_id, status, limit, offset } }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_create_client_request',
    'Create a client fulfillment request. Required: client_id, brand, device_model, quantity, processor, display_size, ram, storage.',
    { body: z.record(z.unknown()) },
    async ({ body }) => {
      try {
        return textResult(await api.request('POST', '/client_requests', { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_update_client_request',
    'Update a client request (status, vendor allocation, pricing, shipping date, etc.).',
    { id: z.string().uuid(), body: z.record(z.unknown()) },
    async ({ id, body }) => {
      try {
        return textResult(await api.request('PATCH', `/client_requests/${id}`, { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ─── Device pricing (Vendors → Device Pricing) ────────────────────────────

  server.tool(
    'remoasset_list_device_pricing',
    'List vendor device/laptop pricing quotes (RFP pricing tab).',
    {
      vendor_id: z.string().uuid().optional(),
      country_id: z.string().uuid().optional(),
      brand: z.string().optional(),
      ...paginationSchema,
    },
    async ({ vendor_id, country_id, brand, limit, offset }) => {
      try {
        return textResult(await api.request('GET', '/device_pricing', { query: { vendor_id, country_id, brand, limit, offset } }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_create_device_pricing',
    'Add vendor device pricing. Required: vendor_id, country_id, brand, device_model, processor, display_size, ram, storage, price_usd, quantity.',
    { body: z.record(z.unknown()) },
    async ({ body }) => {
      try {
        return textResult(await api.request('POST', '/device_pricing', { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_update_device_pricing',
    'Update vendor device pricing row.',
    { id: z.string().uuid(), body: z.record(z.unknown()) },
    async ({ id, body }) => {
      try {
        return textResult(await api.request('PATCH', `/device_pricing/${id}`, { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ─── Warehouse pricing (Vendors → Warehouse Pricing) ──────────────────────

  server.tool(
    'remoasset_list_warehouse_pricing',
    'List warehouse partner service pricing (storage, QC, shipping, etc.).',
    {
      vendor_id: z.string().uuid().optional(),
      country_id: z.string().uuid().optional(),
      ...paginationSchema,
    },
    async ({ vendor_id, country_id, limit, offset }) => {
      try {
        return textResult(await api.request('GET', '/warehouse_pricing', { query: { vendor_id, country_id, limit, offset } }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_create_warehouse_pricing',
    'Add warehouse vendor pricing for a country.',
    { body: z.record(z.unknown()) },
    async ({ body }) => {
      try {
        return textResult(await api.request('POST', '/warehouse_pricing', { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_update_warehouse_pricing',
    'Update warehouse vendor pricing.',
    { id: z.string().uuid(), body: z.record(z.unknown()) },
    async ({ id, body }) => {
      try {
        return textResult(await api.request('PATCH', `/warehouse_pricing/${id}`, { body }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ─── Lead transfers ───────────────────────────────────────────────────────

  server.tool(
    'remoasset_transfer_lead',
    'Transfer a lead to a new owner. Updates owner, logs transfer record, and creates activity.',
    {
      lead_id: z.string().uuid(),
      to_user_id: z.string().uuid().describe('New owner user_id from remoasset_list_team'),
      transferred_by: z.string().uuid().describe('User performing the transfer'),
      notes: z.string().optional(),
    },
    async ({ lead_id, to_user_id, transferred_by, notes }) => {
      try {
        return textResult(await api.request('POST', '/lead_transfers', {
          body: { lead_id, to_user_id, transferred_by, notes },
        }));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'remoasset_list_lead_transfers',
    'List lead ownership transfer history.',
    {
      lead_id: z.string().uuid().optional(),
      ...paginationSchema,
    },
    async ({ lead_id, limit, offset }) => {
      try {
        return textResult(await api.request('GET', '/lead_transfers', { query: { lead_id, limit, offset } }));
      } catch (error) {
        return toolError(error);
      }
    }
  );
}
