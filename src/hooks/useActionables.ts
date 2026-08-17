import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { evaluateLeadSla, type LeadSlaResult } from '@/lib/leadSla';
import { fetchAllPaginated } from '@/lib/supabasePaginate';

export type ActionableKind = 'sla_breach' | 'sla_warning' | 'overdue_followup' | 'overdue_task';

export interface ActionableItem {
  id: string;
  kind: ActionableKind;
  severity: number;
  title: string;
  subtitle: string;
  leadId?: string;
  companyName?: string;
  email?: string | null;
  ownerName?: string | null;
  ownerId?: string | null;
  statusName?: string | null;
  statusColor?: string | null;
  sla?: LeadSlaResult | null;
}

export function useActionables() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const [items, setItems] = useState<ActionableItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      const nowIso = now.toISOString();

      const [breachIdsRes, warnIdsRes, followUpsRes, tasksRes, statusesRes] = await Promise.all([
        supabase.rpc('leads_matching_sla', { p_mode: 'breach' }),
        supabase.rpc('leads_matching_sla', { p_mode: 'warning' }),
        (() => {
          let q = supabase
            .from('follow_ups')
            .select('id, lead_id, scheduled_at, notes, user_id, is_completed')
            .eq('is_completed', false)
            .lt('scheduled_at', nowIso)
            .order('scheduled_at', { ascending: true })
            .limit(80);
          if (!isAdmin) q = q.eq('user_id', user.id);
          return q;
        })(),
        (() => {
          let q = supabase
            .from('tasks')
            .select('id, lead_id, title, due_date, assignee_id, is_completed')
            .eq('is_completed', false)
            .lt('due_date', nowIso)
            .order('due_date', { ascending: true })
            .limit(80);
          if (!isAdmin) q = q.eq('assignee_id', user.id);
          return q;
        })(),
        supabase.from('lead_statuses').select('id, name, color, sla_idle_days, sla_stage_days, sla_followup_intent'),
      ]);

      const breachIds = ((breachIdsRes.data ?? []) as { lead_id: string }[]).map((r) => r.lead_id);
      const warnIds = ((warnIdsRes.data ?? []) as { lead_id: string }[]).map((r) => r.lead_id);
      const followUps = followUpsRes.data ?? [];
      const tasks = tasksRes.data ?? [];
      const statuses = statusesRes.data ?? [];
      const statusById = Object.fromEntries(statuses.map((s) => [s.id, s]));

      const extraLeadIds = [
        ...followUps.map((f) => f.lead_id).filter(Boolean),
        ...tasks.map((t) => t.lead_id).filter(Boolean),
      ] as string[];
      const allLeadIds = [...new Set([...breachIds, ...warnIds, ...extraLeadIds])];

      let leads: {
        id: string;
        company_name: string;
        email: string | null;
        owner_id: string | null;
        status_id: string | null;
        last_activity_at: string | null;
        status_changed_at: string | null;
        created_at: string;
      }[] = [];

      if (allLeadIds.length > 0) {
        const CHUNK = 100;
        for (let i = 0; i < allLeadIds.length; i += CHUNK) {
          let q = supabase
            .from('leads')
            .select('id, company_name, email, owner_id, status_id, last_activity_at, status_changed_at, created_at')
            .in('id', allLeadIds.slice(i, i + CHUNK));
          if (!isAdmin) q = q.eq('owner_id', user.id);
          const { data } = await q;
          leads.push(...((data ?? []) as typeof leads));
        }
      } else if (!isAdmin) {
        leads = await fetchAllPaginated((from, to) =>
          supabase
            .from('leads')
            .select('id, company_name, email, owner_id, status_id, last_activity_at, status_changed_at, created_at')
            .eq('owner_id', user.id)
            .range(from, to)
        );
      }

      const ownerIds = [...new Set(leads.map((l) => l.owner_id).filter(Boolean))] as string[];
      let ownerMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ownerIds);
        ownerMap = (profiles ?? []).reduce((acc, p) => {
          acc[p.user_id] = p.full_name ?? 'Unknown';
          return acc;
        }, {} as Record<string, string>);
      }

      const leadById = Object.fromEntries(leads.map((l) => [l.id, l]));
      const next: ActionableItem[] = [];

      const pushLeadSla = (id: string, kind: ActionableKind, severity: number) => {
        const l = leadById[id];
        if (!l) return;
        const status = l.status_id ? statusById[l.status_id] : null;
        const sla = evaluateLeadSla({
          created_at: l.created_at,
          last_activity_at: l.last_activity_at,
          status_changed_at: l.status_changed_at,
          status: status ?? undefined,
        });
        next.push({
          id: `${kind}-${id}`,
          kind,
          severity,
          title: l.company_name,
          subtitle: sla.tooltip,
          leadId: l.id,
          companyName: l.company_name,
          email: l.email,
          ownerName: l.owner_id ? ownerMap[l.owner_id] ?? null : null,
          ownerId: l.owner_id,
          statusName: status?.name ?? null,
          statusColor: status?.color ?? null,
          sla,
        });
      };

      for (const id of breachIds) pushLeadSla(id, 'sla_breach', 0);
      for (const id of warnIds) {
        if (!breachIds.includes(id)) pushLeadSla(id, 'sla_warning', 1);
      }

      for (const f of followUps) {
        const l = f.lead_id ? leadById[f.lead_id] : undefined;
        next.push({
          id: `fu-${f.id}`,
          kind: 'overdue_followup',
          severity: 2,
          title: l?.company_name ?? 'Follow-up',
          subtitle: f.notes ? String(f.notes).slice(0, 80) : 'Overdue follow-up',
          leadId: f.lead_id ?? undefined,
          companyName: l?.company_name,
          email: l?.email,
          ownerName: l?.owner_id ? ownerMap[l.owner_id] ?? null : null,
          ownerId: l?.owner_id ?? null,
        });
      }

      for (const t of tasks) {
        const l = t.lead_id ? leadById[t.lead_id] : undefined;
        next.push({
          id: `task-${t.id}`,
          kind: 'overdue_task',
          severity: 3,
          title: t.title,
          subtitle: l?.company_name ?? 'Overdue task',
          leadId: t.lead_id ?? undefined,
          companyName: l?.company_name,
          email: l?.email,
          ownerName: l?.owner_id ? ownerMap[l.owner_id] ?? null : null,
          ownerId: l?.owner_id ?? null,
        });
      }

      next.sort((a, b) => a.severity - b.severity || a.title.localeCompare(b.title));
      setItems(next);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const slaBreachCount = items.filter((i) => i.kind === 'sla_breach').length;
  const count = items.length;
  const owners = [...new Map(
    items.filter((i) => i.ownerId).map((i) => [i.ownerId!, { id: i.ownerId!, name: i.ownerName ?? 'Unknown' }])
  ).values()];

  return { items, loading, refresh, count, slaBreachCount, isAdmin, owners };
}
