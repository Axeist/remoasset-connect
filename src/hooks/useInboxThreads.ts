import { useCallback, useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useGmail } from '@/hooks/useGmail';
import { parseGmailMessage } from '@/hooks/useGmail';

export interface InboxLead {
  id: string;
  company_name: string;
  email: string | null;
  owner_id: string | null;
}

export interface InboxThreadItem {
  threadId: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  starred: boolean;
  messageCount: number;
  from: string;
}

const THREADS_PER_LEAD = 6;
const MAX_LEADS = 12;
const MAX_MERGED_THREADS = 30;
const MAX_METADATA_PARALLEL = 15;

// ─── Module-level cache ───────────────────────────────────────────────────────
// Lives for the entire browser-tab session. When the user navigates away from
// Inbox and comes back the cached threads are shown immediately (no blank flash)
// while a background re-fetch runs to pick up any new messages.
let _cachedThreads: InboxThreadItem[] = [];
let _cacheUserId: string | null = null;
// ─────────────────────────────────────────────────────────────────────────────

export function useInboxThreads() {
  const { user, role, loading: authLoading } = useAuth();
  const gmail = useGmail();
  const [leads, setLeads] = useState<InboxLead[]>([]);

  // Initialise from the module-level cache so threads are visible immediately
  // on every re-navigation without waiting for a fresh API round-trip.
  const [threads, setThreads] = useState<InboxThreadItem[]>(() =>
    user?.id && _cacheUserId === user.id && _cachedThreads.length > 0
      ? _cachedThreads
      : []
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const hasCompletedInitialFetchRef = useRef(false);
  // Prevents two concurrent fetches from racing (useEffect re-fire during refresh)
  const isFetchingRef = useRef(false);

  const isAdmin = role === 'admin';

  // Write through to the module-level cache whenever we update threads
  const applyThreads = useCallback((fresh: InboxThreadItem[]) => {
    _cachedThreads = fresh;
    _cacheUserId = user?.id ?? null;
    setThreads(fresh);
  }, [user?.id]);

  const fetchLeads = useCallback(async (): Promise<InboxLead[]> => {
    if (!user?.id) return [];
    let q = supabase
      .from('leads')
      .select('id, company_name, email, owner_id')
      .not('email', 'is', null);
    if (!isAdmin) q = q.eq('owner_id', user.id);
    const { data, error: e } = await q.limit(MAX_LEADS);
    if (e) throw new Error(e.message);
    const list = (data || []).filter((l: InboxLead) => l.email?.trim()) as InboxLead[];
    setLeads(list);
    return list;
  }, [user?.id, isAdmin]);

  const fetchThreads = useCallback(async () => {
    if (!gmail.isConnected || !user?.id) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const leadList = await fetchLeads();
      if (leadList.length === 0) {
        // Only clear the list if we had nothing before (first load with no leads)
        setThreads((prev) => (prev.length === 0 ? [] : prev));
        return;
      }

      const threadIdToLead = new Map<string, { leadId: string; leadName: string; leadEmail: string }>();
      const allThreadIds: string[] = [];

      const listResults = await Promise.allSettled(
        leadList.map((lead) => gmail.listThreads(lead.email!.trim(), THREADS_PER_LEAD))
      );

      // If every listThreads call failed Gmail is unreachable – keep what we have
      const anyListSucceeded = listResults.some((r) => r.status === 'fulfilled');
      if (!anyListSucceeded) {
        setError('Could not reach Gmail. Showing cached results.');
        return;
      }

      for (let i = 0; i < listResults.length; i++) {
        const result = listResults[i];
        const lead = leadList[i];
        if (result.status !== 'fulfilled' || !lead?.email?.trim()) continue;
        const email = lead.email.trim();
        for (const t of result.value) {
          if (!threadIdToLead.has(t.id)) {
            threadIdToLead.set(t.id, {
              leadId: lead.id,
              leadName: lead.company_name,
              leadEmail: email,
            });
            allThreadIds.push(t.id);
          }
        }
      }

      const toFetch = allThreadIds.slice(0, MAX_MERGED_THREADS);
      const results: InboxThreadItem[] = [];

      for (let i = 0; i < toFetch.length; i += MAX_METADATA_PARALLEL) {
        const batch = toFetch.slice(i, i + MAX_METADATA_PARALLEL);
        const settled = await Promise.allSettled(
          batch.map((id) => gmail.getThread(id, 'metadata'))
        );
        for (let j = 0; j < settled.length; j++) {
          const s = settled[j];
          const threadId = batch[j];
          const meta = threadIdToLead.get(threadId);
          if (s.status !== 'fulfilled' || !meta) continue;
          const thread = s.value;
          const msgs = thread.messages || [];
          if (msgs.length === 0) continue;
          const last = msgs[msgs.length - 1];
          const parsed = parseGmailMessage(last);
          const unread = msgs.some((m) => m.labelIds?.includes('UNREAD'));
          const starred = msgs.some((m) => m.labelIds?.includes('STARRED'));
          const first = parseGmailMessage(msgs[0]);
          results.push({
            threadId,
            leadId: meta.leadId,
            leadName: meta.leadName,
            leadEmail: meta.leadEmail,
            subject: first.subject || '(No subject)',
            snippet: thread.snippet || parsed.snippet || '',
            date: parsed.date,
            unread,
            starred,
            messageCount: msgs.length,
            from: parsed.from,
          });
        }
      }

      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Only update (and write to cache) when we actually got results back.
      // An empty result on a refresh most likely means an API failure – keep what's showing.
      if (results.length > 0) {
        applyThreads(results);
      } else {
        setThreads((prev) => (prev.length > 0 ? prev : []));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
      // Keep existing threads visible on error
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      hasCompletedInitialFetchRef.current = true;
    }
  }, [gmail.isConnected, gmail.listThreads, gmail.getThread, user?.id, fetchLeads, applyThreads]);

  // useLayoutEffect runs before paint so we set loading and start fetch before user sees empty state
  useLayoutEffect(() => {
    if (gmail.isConnected && user?.id && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      setLoading(true);
      fetchThreads();
    }
    return () => {
      hasFetchedRef.current = false;
    };
  }, [gmail.isConnected, user?.id, fetchThreads]);

  const refresh = useCallback(() => {
    hasFetchedRef.current = false;
    fetchThreads();
  }, [fetchThreads]);

  // When mail poller detects new email, it dispatches a DOM event.
  // Listen for it and refetch inbox threads so new mail appears without reload.
  useEffect(() => {
    const handler = () => {
      refresh();
    };
    window.addEventListener('remoasset-inbox-new-email', handler);
    return () => {
      window.removeEventListener('remoasset-inbox-new-email', handler);
    };
  }, [refresh]);

  // Show skeletons when we have no threads: auth still loading, or we're fetching, or waiting for first fetch
  const showAsLoading =
    threads.length === 0 &&
    (authLoading ||
      loading ||
      (gmail.isConnected && !!user?.id && !error && !hasCompletedInitialFetchRef.current));

  return {
    threads,
    leads,
    loading,
    showAsLoading,
    error,
    refresh,
    refetch: fetchThreads,
    isConnected: gmail.isConnected,
  };
}
