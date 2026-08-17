import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/supabasePaginate';

export function parseStatusIds(status: string): string[] {
  return status
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function applyStatusIdFilter<T extends { eq: (col: string, val: string) => T; in: (col: string, val: string[]) => T }>(
  query: T,
  status: string,
): T {
  const ids = parseStatusIds(status);
  if (ids.length === 1) return query.eq('status_id', ids[0]);
  if (ids.length > 1) return query.in('status_id', ids);
  return query;
}

export function isTerminalStatusName(name: string | null | undefined): boolean {
  const n = (name ?? '').toLowerCase();
  return n === 'won' || n === 'lost';
}

export async function leadIdsWithOpenNextStep(): Promise<Set<string>> {
  const [followUps, tasks] = await Promise.all([
    fetchAllPaginated<{ lead_id: string | null }>((from, to) =>
      supabase.from('follow_ups').select('lead_id').eq('is_completed', false).range(from, to)
    ),
    fetchAllPaginated<{ lead_id: string | null }>((from, to) =>
      supabase.from('tasks').select('lead_id').eq('is_completed', false).not('lead_id', 'is', null).range(from, to)
    ),
  ]);
  const ids = new Set<string>();
  for (const row of followUps) if (row.lead_id) ids.add(row.lead_id);
  for (const row of tasks) if (row.lead_id) ids.add(row.lead_id);
  return ids;
}

export async function leadIdsWithNoNextStep(): Promise<string[]> {
  const [{ data: statuses }, withNext, leads] = await Promise.all([
    supabase.from('lead_statuses').select('id, name'),
    leadIdsWithOpenNextStep(),
    fetchAllPaginated<{ id: string; status_id: string | null }>((from, to) =>
      supabase.from('leads').select('id, status_id').range(from, to)
    ),
  ]);
  const terminal = new Set(
    (statuses ?? []).filter((s) => isTerminalStatusName(s.name)).map((s) => s.id)
  );
  return leads
    .filter((l) => !terminal.has(l.status_id ?? '') && !withNext.has(l.id))
    .map((l) => l.id);
}
