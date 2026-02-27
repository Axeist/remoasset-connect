import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const POLL_INTERVAL_MS = 60_000; // 1 minute
const INITIAL_DELAY_MS = 5_000;
const DUE_SOON_MINUTES = 15;

type NotifPrefs = {
  task_due?: boolean;
  follow_up?: boolean;
};

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem('remoasset_notif_prefs');
    return raw ? (JSON.parse(raw) as NotifPrefs) : {};
  } catch {
    return {};
  }
}

export function useTaskAndFollowUpNotificationPoller() {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const notifiedTaskIdsRef = useRef<Set<string>>(new Set());
  const notifiedFollowUpIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!mountedRef.current) return;

      try {
        const prefs = loadNotifPrefs();

        const now = new Date();
        const nowISO = now.toISOString();
        const soon = new Date(now.getTime() + DUE_SOON_MINUTES * 60_000).toISOString();
        // Small grace window backwards so we still catch items that just became due
        const gracePast = new Date(now.getTime() - 10 * 60_000).toISOString();

        const promises: Promise<unknown>[] = [];

        // Tasks due soon
        if (prefs.task_due ?? true) {
          promises.push(
            (async () => {
              const { data, error } = await supabase
                .from('tasks')
                .select('id, title, due_date')
                .eq('assignee_id', user.id)
                .eq('is_completed', false)
                .not('due_date', 'is', null)
                .gte('due_date', gracePast)
                .lte('due_date', soon);

              if (error || !data) return;

              for (const t of data as { id: string; title: string | null; due_date: string }[]) {
                if (notifiedTaskIdsRef.current.has(t.id)) continue;
                notifiedTaskIdsRef.current.add(t.id);
                await supabase.from('notifications').insert({
                  user_id: user.id,
                  title: 'Task due soon',
                  message: t.title ? `${t.title} is due soon.` : 'A task is due soon.',
                  type: 'task',
                });
              }
            })()
          );
        }

        // Follow-ups due soon
        if (prefs.follow_up ?? true) {
          promises.push(
            (async () => {
              const { data, error } = await supabase
                .from('follow_ups')
                .select('id, scheduled_at, notes')
                .eq('user_id', user.id)
                .eq('is_completed', false)
                .gte('scheduled_at', gracePast)
                .lte('scheduled_at', soon);

              if (error || !data) return;

              for (const f of data as { id: string; scheduled_at: string; notes: string | null }[]) {
                if (notifiedFollowUpIdsRef.current.has(f.id)) continue;
                notifiedFollowUpIdsRef.current.add(f.id);
                const when =
                  new Date(f.scheduled_at) <= new Date(nowISO)
                    ? 'now'
                    : 'soon';
                await supabase.from('notifications').insert({
                  user_id: user.id,
                  title: 'Follow-up due',
                  message: f.notes ? `Follow-up "${f.notes}" is due ${when}.` : `A follow-up is due ${when}.`,
                  type: 'follow_up',
                });
              }
            })()
          );
        }

        if (promises.length > 0) {
          await Promise.allSettled(promises);
        }
      } catch {
        // ignore transient errors
      }

      if (mountedRef.current) {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    timeoutId = setTimeout(poll, INITIAL_DELAY_MS);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [user?.id]);
}

