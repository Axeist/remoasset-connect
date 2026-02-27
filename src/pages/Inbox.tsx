import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useInboxThreads, type InboxThreadItem } from '@/hooks/useInboxThreads';
import { useGmail, parseGmailMessage, gmailThreadUrl } from '@/hooks/useGmail';
import { cn } from '@/lib/utils';
import {
  Inbox as InboxIcon,
  RefreshCw,
  Star,
  Mail,
  ExternalLink,
  User,
  ChevronRight,
  AlertCircle,
  Send,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import type { ParsedGmailMessage } from '@/hooks/useGmail';

function formatEmailDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function extractName(fromStr: string): string {
  const match = fromStr.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  const emailMatch = fromStr.match(/([^@\s]+)@/);
  if (emailMatch) return emailMatch[1];
  return fromStr;
}

function extractEmail(fromStr: string): string {
  const match = fromStr.match(/<([^>]+)>/);
  if (match) return match[1];
  return fromStr.trim();
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Inbox() {
  const { toast } = useToast();
  const { threads, loading, error, refresh, isConnected } = useInboxThreads();
  const gmail = useGmail();

  const [selected, setSelected] = useState<InboxThreadItem | null>(null);
  const [messages, setMessages] = useState<ParsedGmailMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  const [unread, setUnread] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [togglingStar, setTogglingStar] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const starredRef = useRef(starred);
  starredRef.current = starred;
  const unreadRef = useRef(unread);
  unreadRef.current = unread;

  const openThread = useCallback(
    async (item: InboxThreadItem) => {
      setSelected(item);
      setLoadingThread(true);
      try {
        const thread = await gmail.getThread(item.threadId, 'full');
        const parsed = (thread.messages || []).map(parseGmailMessage);
        setMessages(parsed);
        setStarred((s) => ({ ...s, [item.threadId]: item.starred }));
        setUnread((u) => ({ ...u, [item.threadId]: item.unread }));
      } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : 'Failed to load thread' });
      } finally {
        setLoadingThread(false);
      }
    },
    [gmail, toast]
  );

  const toggleStar = useCallback(
    async (threadId: string) => {
      const current = starredRef.current[threadId];
      setTogglingStar(threadId);
      try {
        await gmail.modifyThread(threadId, current ? { removeLabelIds: ['STARRED'] } : { addLabelIds: ['STARRED'] });
        setStarred((s) => ({ ...s, [threadId]: !current }));
      } catch {
        toast({ variant: 'destructive', title: 'Failed to update star' });
      } finally {
        setTogglingStar(null);
      }
    },
    [gmail, toast]
  );

  const markAsRead = useCallback(
    async (threadId: string) => {
      setMarkingRead(threadId);
      try {
        await gmail.modifyThread(threadId, { removeLabelIds: ['UNREAD'] });
        setUnread((u) => ({ ...u, [threadId]: false }));
      } catch {
        toast({ variant: 'destructive', title: 'Failed to mark as read' });
      } finally {
        setMarkingRead(null);
      }
    },
    [gmail, toast]
  );

  const filteredThreads = threads.filter((t) => {
    if (filter === 'unread') return unread[t.threadId] ?? t.unread;
    if (filter === 'starred') return starred[t.threadId] ?? t.starred;
    return true;
  });

  if (!isConnected) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Gmail not connected</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Connect Google in Admin → Integrations to see your lead emails in Inbox.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-7rem)] rounded-xl border bg-card overflow-hidden">
        {/* Gmail-style toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <Button variant="ghost" size="icon" onClick={refresh} disabled={loading} className="shrink-0">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <div className="flex gap-1 shrink-0">
            {(['all', 'unread', 'starred'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(f)}
                className="capitalize"
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Thread list - Gmail left panel */}
          <div
            className={cn(
              'border-r bg-background flex flex-col w-full sm:w-[380px] shrink-0',
              selected && 'hidden sm:flex'
            )}
          >
            {error && (
              <div className="p-3 flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={refresh} className="ml-auto">Retry</Button>
              </div>
            )}
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center px-4">
                <InboxIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {filter !== 'all' ? `No ${filter} threads` : 'No lead emails yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filter === 'all' ? 'Emails with your leads will appear here.' : 'Try "All".'}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-border">
                {filteredThreads.map((t) => {
                  const isUnread = unread[t.threadId] ?? t.unread;
                  const isStarred = starred[t.threadId] ?? t.starred;
                  const isSelected = selected?.threadId === t.threadId;
                  return (
                    <button
                      key={t.threadId}
                      type="button"
                      onClick={() => openThread(t)}
                      className={cn(
                        'w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-muted/60 transition-colors group',
                        isSelected && 'bg-primary/10 hover:bg-primary/15',
                        isUnread && 'bg-muted/30'
                      )}
                    >
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleStar(t.threadId); }}
                          className="p-0.5 rounded hover:bg-muted"
                          title={isStarred ? 'Unstar' : 'Star'}
                        >
                          {togglingStar === t.threadId ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Star
                              className={cn('h-4 w-4', isStarred ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/50 group-hover:text-amber-500')}
                            />
                          )}
                        </button>
                        <span className={cn('w-2 h-2 rounded-full shrink-0 mt-1.5', isUnread ? 'bg-primary' : 'bg-transparent')} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('text-sm truncate', isUnread && 'font-semibold')}>
                            {t.leadName}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            {formatEmailDate(t.date)}
                          </span>
                        </div>
                        <p className={cn('text-sm truncate mt-0.5', isUnread && 'font-semibold')}>{t.subject}</p>
                        {t.snippet && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.snippet}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-2 opacity-0 group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Thread detail - Gmail right panel */}
          <div
            className={cn(
              'flex-1 flex flex-col min-w-0 bg-card',
              !selected && 'hidden sm:flex sm:items-center sm:justify-center'
            )}
          >
            {!selected ? (
              <div className="hidden sm:flex flex-col items-center justify-center text-center p-8">
                <InboxIcon className="h-14 w-14 text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">Select a conversation</p>
              </div>
            ) : (
              <>
                <div className="border-b px-4 py-3 flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sm:hidden shrink-0"
                    onClick={() => setSelected(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold truncate">{selected.subject}</h2>
                    <p className="text-xs text-muted-foreground truncate">{selected.leadName} · {selected.messageCount} messages</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => (unread[selected.threadId] ?? selected.unread) && markAsRead(selected.threadId)}
                      disabled={!(unread[selected.threadId] ?? selected.unread) || markingRead === selected.threadId}
                    >
                      {markingRead === selected.threadId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Mark read
                    </Button>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                      <Link to={`/leads/${selected.leadId}?tab=emails&thread=${selected.threadId}`}>
                        <User className="h-3.5 w-3.5" />
                        View lead
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                      <a href={gmailThreadUrl(selected.threadId)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Gmail
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loadingThread ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3">
                          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-16 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const fromEmail = extractEmail(msg.from);
                      const isFromLead = fromEmail.toLowerCase() === selected.leadEmail.toLowerCase();
                      const name = extractName(msg.from);
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex gap-3 rounded-lg p-3',
                            isFromLead ? 'bg-orange-500/5 dark:bg-orange-500/10' : 'bg-muted/30'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                              isFromLead ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' : 'bg-primary/10 text-primary'
                            )}
                          >
                            {getInitials(name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-sm font-medium">{name}</span>
                              <span className="text-xs text-muted-foreground">{formatEmailDate(msg.date)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">To: {msg.to}</p>
                            <div className="mt-2 text-sm prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap">
                              {msg.body?.slice(0, 2000) || msg.snippet || '(No content)'}
                              {(msg.body?.length ?? 0) > 2000 && '…'}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
