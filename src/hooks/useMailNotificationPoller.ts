import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useGmail } from '@/hooks/useGmail';

const POLL_INTERVAL_MS = 120000; // 2 minutes
const MAX_LEADS = 20;
const THREADS_PER_LEAD = 8;
const MAX_THREADS_TO_CHECK = 25;

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // ignore
  }
}

export function useMailNotificationPoller() {
  const { user, role } = useAuth();
  const gmail = useGmail();
  const lastStateRef = useRef<Map<string, number>>(new Map());
  const hasSeededRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!user?.id || !gmail.isConnected) return;

    const isAdmin = role === 'admin';
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!mountedRef.current) return;
      try {
        let q = supabase
          .from('leads')
          .select('id, company_name, email, owner_id')
          .not('email', 'is', null);
        if (!isAdmin) q = q.eq('owner_id', user.id);
        const { data: leadList } = await q.limit(MAX_LEADS);
        const leads = (leadList || []).filter((l: { email?: string }) => l.email?.trim()) as { id: string; company_name: string; email: string; owner_id: string | null }[];
        if (leads.length === 0) return;

        const threadIdToLead = new Map<string, { leadId: string; leadName: string; ownerId: string | null }>();
        const allThreadIds: string[] = [];

        for (const lead of leads) {
          try {
            const list = await gmail.listThreads(lead.email.trim(), THREADS_PER_LEAD);
            for (const t of list) {
              if (!threadIdToLead.has(t.id)) {
                threadIdToLead.set(t.id, {
                  leadId: lead.id,
                  leadName: lead.company_name,
                  ownerId: lead.owner_id,
                });
                allThreadIds.push(t.id);
              }
            }
          } catch {
            // skip
          }
        }

        const toFetch = allThreadIds.slice(0, MAX_THREADS_TO_CHECK);
        const lastState = lastStateRef.current;
        const isFirstRun = !hasSeededRef.current;

        for (let i = 0; i < toFetch.length; i += 10) {
          const batch = toFetch.slice(i, i + 10);
          const results = await Promise.allSettled(batch.map((id) => gmail.getThread(id, 'metadata')));
          for (let j = 0; j < results.length; j++) {
            const r = results[j];
            const threadId = batch[j];
            const meta = threadIdToLead.get(threadId);
            if (r.status !== 'fulfilled' || !meta) continue;
            const thread = r.value;
            const messageCount = thread.messages?.length ?? 0;
            const prev = lastState.get(threadId) ?? 0;
            lastState.set(threadId, messageCount);
            if (isFirstRun) continue;

            if (prev > 0 && messageCount > prev) {
              const notifyUserId = meta.ownerId || user.id;
              await supabase.from('notifications').insert({
                user_id: notifyUserId,
                title: 'New email',
                message: `${meta.leadName}: new reply in thread`,
                type: 'email',
                metadata: { threadId, leadId: meta.leadId },
              });
              if (notifyUserId === user.id) playNotificationSound();
            } else if (prev === 0 && messageCount > 0) {
              const notifyUserId = meta.ownerId || user.id;
              await supabase.from('notifications').insert({
                user_id: notifyUserId,
                title: 'New email',
                message: `New conversation with ${meta.leadName}`,
                type: 'email',
                metadata: { threadId, leadId: meta.leadId },
              });
              if (notifyUserId === user.id) playNotificationSound();
            }
          }
        }
        if (isFirstRun) hasSeededRef.current = true;
      } catch {
        // ignore
      }
      if (mountedRef.current) timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timeoutId = setTimeout(poll, 15000);
    return () => clearTimeout(timeoutId);
  }, [user?.id, role, gmail.isConnected, gmail.listThreads, gmail.getThread]);
}
