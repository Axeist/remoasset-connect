import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useGmail } from '@/hooks/useGmail';

const POLL_INTERVAL_MS = 30_000;       // 30 seconds – near real-time
const INITIAL_DELAY_MS = 3_000;        // 3 seconds after mount
const MAX_LEADS = 30;
const LEAD_CACHE_MS = 5 * 60_000;     // refresh lead list every 5 minutes
const HISTORY_ID_KEY = 'gmail_poll_history_id';

function getStoredHistoryId(): string | null {
  return localStorage.getItem(HISTORY_ID_KEY);
}

function setStoredHistoryId(id: string) {
  localStorage.setItem(HISTORY_ID_KEY, id);
}

function clearStoredHistoryId() {
  localStorage.removeItem(HISTORY_ID_KEY);
}

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

type LeadEntry = { leadId: string; leadName: string; ownerId: string | null };

type NotifPrefs = {
  email_reply?: boolean;
  sound?: boolean;
};

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem('remoasset_notif_prefs');
    return raw ? (JSON.parse(raw) as NotifPrefs) : {};
  } catch {
    return {};
  }
}

export function useMailNotificationPoller() {
  const { user, role } = useAuth();
  const gmail = useGmail();
  const mountedRef = useRef(true);
  const leadMapRef = useRef<Map<string, LeadEntry>>(new Map());
  const lastLeadFetchRef = useRef<number>(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refreshLeads = useCallback(async () => {
    if (!user?.id) return;
    const now = Date.now();
    if (now - lastLeadFetchRef.current < LEAD_CACHE_MS) return;
    lastLeadFetchRef.current = now;

    const isAdmin = role === 'admin';
    let q = supabase
      .from('leads')
      .select('id, company_name, email, owner_id')
      .not('email', 'is', null);
    if (!isAdmin) q = q.eq('owner_id', user.id);
    const { data } = await q.limit(MAX_LEADS);

    const map = new Map<string, LeadEntry>();
    for (const l of (data || []) as { id: string; company_name: string; email: string; owner_id: string | null }[]) {
      if (l.email?.trim()) {
        map.set(l.email.trim().toLowerCase(), {
          leadId: l.id,
          leadName: l.company_name,
          ownerId: l.owner_id,
        });
      }
    }
    leadMapRef.current = map;
  }, [user?.id, role]);

  useEffect(() => {
    if (!user?.id || !gmail.isConnected) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!mountedRef.current) return;

      try {
        const prefs = loadNotifPrefs();

        await refreshLeads();

        const storedHistoryId = getStoredHistoryId();

        if (!storedHistoryId) {
          // First run – seed the historyId, don't fire notifications for past messages
          const profile = await gmail.getProfile();
          if (profile?.historyId) setStoredHistoryId(profile.historyId);
          if (mountedRef.current) timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        // Incremental check: only fetch what changed since last poll
        let historyRes;
        try {
          historyRes = await gmail.listHistory(storedHistoryId);
        } catch (err) {
          // historyId expired (404/400) – reseed silently
          if (err instanceof Error) {
            clearStoredHistoryId();
          }
          if (mountedRef.current) timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        // Always advance the cursor even if no new messages
        if (historyRes.historyId) setStoredHistoryId(historyRes.historyId);

        if (!historyRes.history || historyRes.history.length === 0) {
          if (mountedRef.current) timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        // Collect message IDs that landed in INBOX
        const inboxMessages = new Map<string, string>(); // messageId → threadId
        for (const item of historyRes.history) {
          for (const added of item.messagesAdded || []) {
            const msg = added.message;
            if (msg.labelIds?.includes('INBOX')) {
              inboxMessages.set(msg.id, msg.threadId);
            }
          }
        }

        if (inboxMessages.size === 0) {
          if (mountedRef.current) timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        // Fetch metadata (From + Subject) for each new INBOX message
        const messageIds = Array.from(inboxMessages.keys()).slice(0, 10);
        const metaResults = await Promise.allSettled(
          messageIds.map((id) => gmail.getMessage(id))
        );

        const leadMap = leadMapRef.current;

        for (let i = 0; i < metaResults.length; i++) {
          const result = metaResults[i];
          if (result.status !== 'fulfilled') continue;

          const msg = result.value;
          const headers = msg.payload?.headers || [];
          const fromVal = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
          const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '(No subject)';

          // Extract bare email from "Name <email>" or plain email
          const emailMatch = fromVal.match(/<([^>]+)>/) ?? fromVal.match(/(\S+@\S+)/);
          const fromEmail = (emailMatch ? emailMatch[1] : fromVal).toLowerCase().trim();

          const lead = leadMap.get(fromEmail);
          if (!lead) continue; // not from a known lead – skip

          const threadId = inboxMessages.get(msg.id) ?? msg.threadId;
          const notifyUserId = lead.ownerId || user.id;

          // Respect notification preferences – skip creating in-app alerts if disabled
          if (prefs.email_reply ?? true) {
            await supabase.from('notifications').insert({
              user_id: notifyUserId,
              title: `New email from ${lead.leadName}`,
              message: `"${subject}"`,
              type: 'email',
              metadata: { threadId, leadId: lead.leadId, messageId: msg.id },
            });
          }

          if ((prefs.sound ?? true) && notifyUserId === user.id) playNotificationSound();
        }
      } catch {
        // ignore transient errors
      }

      if (mountedRef.current) timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timeoutId = setTimeout(poll, INITIAL_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [user?.id, role, gmail.isConnected, gmail.getProfile, gmail.listHistory, gmail.getMessage, refreshLeads]);
}
