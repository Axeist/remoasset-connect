import { useCallback, useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useGmail } from '@/hooks/useGmail';
import { parseGmailMessage, type ParsedGmailMessage } from '@/hooks/useGmail';

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

const THREADS_PER_LEAD = 12;
const MAX_LEADS = 25;
const MAX_MERGED_THREADS = 80;
const METADATA_BATCH = 15;

export function useInboxThreads() {
  const { user, role } = useAuth();
  const gmail = useGmail();
  const [leads, setLeads] = useState<InboxLead[]>([]);
  const [threads, setThreads] = useState<InboxThreadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const isAdmin = role === 'admin';

  const fetchLeads = useCallback(async (): Promise<InboxLead[]> => {
    if (!user?.id) return [];
    let q = supabase
      .from('leads')
      .select('id, company_name, email, owner_id')
      .not('email', 'is', null);
    if (!isAdmin) {
      q = q.eq('owner_id', user.id);
    }
    const { data, error: e } = await q.limit(MAX_LEADS);
    if (e) throw new Error(e.message);
    const list = (data || []).filter((l: InboxLead) => l.email?.trim()) as InboxLead[];
    setLeads(list);
    return list;
  }, [user?.id, isAdmin]);

  const fetchThreads = useCallback(async () => {
    if (!gmail.isConnected || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const leadList = await fetchLeads();
      if (leadList.length === 0) {
        setThreads([]);
        return;
      }

      const threadIdToLead = new Map<string, { leadId: string; leadName: string; leadEmail: string }>();
      const allThreadIds: string[] = [];

      for (const lead of leadList) {
        const email = lead.email!.trim();
        try {
          const list = await gmail.listThreads(email, THREADS_PER_LEAD);
          for (const t of list) {
            if (!threadIdToLead.has(t.id)) {
              threadIdToLead.set(t.id, {
                leadId: lead.id,
                leadName: lead.company_name,
                leadEmail: email,
              });
              allThreadIds.push(t.id);
            }
          }
        } catch {
          // skip this lead
        }
      }

      const toFetch = allThreadIds.slice(0, MAX_MERGED_THREADS);
      const results: InboxThreadItem[] = [];

      for (let i = 0; i < toFetch.length; i += METADATA_BATCH) {
        const batch = toFetch.slice(i, i + METADATA_BATCH);
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

      results.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return db - da;
      });
      setThreads(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [gmail.isConnected, gmail.listThreads, gmail.getThread, user?.id, fetchLeads, isAdmin]);

  useEffect(() => {
    if (gmail.isConnected && user?.id && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchThreads();
    }
  }, [gmail.isConnected, user?.id, fetchThreads]);

  const refresh = useCallback(() => {
    hasFetchedRef.current = false;
    fetchThreads();
  }, [fetchThreads]);

  return {
    threads,
    leads,
    loading,
    error,
    refresh,
    refetch: fetchThreads,
    isConnected: gmail.isConnected,
  };
}
