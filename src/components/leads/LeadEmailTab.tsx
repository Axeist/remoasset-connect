import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useGmail } from '@/hooks/useGmail';
import { cn } from '@/lib/utils';
import {
  Mail,
  Send,
  ArrowLeft,
  RefreshCw,
  Inbox,
  ChevronRight,
  Reply,
  ExternalLink,
  AlertCircle,
  Loader2,
  MailPlus,
} from 'lucide-react';

interface ParsedMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  references: string;
  body: string;
}

interface ThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  date: string;
  messageCount: number;
}

function formatEmailDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    const isThisYear = d.getFullYear() === now.getFullYear();
    if (isThisYear) {
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

export function LeadEmailTab({
  leadEmail,
  leadCompanyName,
  leadContactName,
}: {
  leadEmail?: string | null;
  leadCompanyName?: string;
  leadContactName?: string | null;
}) {
  const { toast } = useToast();
  const gmail = useGmail();
  const gmailRef = useRef(gmail);
  gmailRef.current = gmail;
  const [view, setView] = useState<'list' | 'thread' | 'compose'>('list');

  // Thread list state
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  // Thread view state
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ParsedMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  // Reply state
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Compose state
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sendingCompose, setSendingCompose] = useState(false);

  const fetchThreadList = useCallback(async () => {
    const g = gmailRef.current;
    if (!leadEmail?.trim() || !g.isConnected) return;
    setLoadingThreads(true);
    setThreadError(null);
    try {
      const threadRefs = await g.listThreadsForContact(leadEmail.trim());
      if (threadRefs.length === 0) {
        setThreads([]);
        setLoadingThreads(false);
        return;
      }
      const summaries: ThreadSummary[] = [];
      // Fetch sequentially to avoid rate-limiting on Gmail API
      for (const ref of threadRefs.slice(0, 20)) {
        try {
          const thread = await g.getThread(ref.id);
          const msgIds = thread.messages?.map((m) => m.id) || [];
          if (msgIds.length === 0) continue;
          const firstMsg = await g.getMessage(msgIds[0]);
          const lastMsg = msgIds.length > 1
            ? await g.getMessage(msgIds[msgIds.length - 1])
            : firstMsg;
          const first = g.parseMessage(firstMsg);
          const last = g.parseMessage(lastMsg);
          summaries.push({
            id: ref.id,
            subject: first.subject || '(No subject)',
            snippet: thread.snippet || last.body?.slice(0, 120).replace(/\n/g, ' ') || '',
            from: last.from,
            date: last.date,
            messageCount: msgIds.length,
          });
        } catch {
          // skip threads that fail
        }
      }
      setThreads(summaries);
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : 'Failed to load emails');
    } finally {
      setLoadingThreads(false);
    }
  }, [leadEmail]);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (gmail.isConnected && leadEmail?.trim() && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchThreadList();
    }
  }, [gmail.isConnected, leadEmail, fetchThreadList]);

  const openThread = async (threadId: string) => {
    const g = gmailRef.current;
    setActiveThreadId(threadId);
    setView('thread');
    setReplyOpen(false);
    setReplyBody('');
    setLoadingThread(true);
    try {
      const thread = await g.getThread(threadId);
      const msgIds = thread.messages?.map((m) => m.id) || [];
      const parsed: ParsedMessage[] = [];
      for (const id of msgIds) {
        const msg = await g.getMessage(id);
        const p = g.parseMessage(msg);
        parsed.push({ id, threadId, ...p });
      }
      setThreadMessages(parsed);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : 'Failed to load thread' });
      setView('list');
    } finally {
      setLoadingThread(false);
    }
  };

  const handleReply = async () => {
    const g = gmailRef.current;
    if (!replyBody.trim() || threadMessages.length === 0) return;
    const lastMsg = threadMessages[threadMessages.length - 1];
    const replyTo = extractEmail(lastMsg.from) === extractEmail(leadEmail ?? '')
      ? leadEmail!.trim()
      : extractEmail(lastMsg.from);

    setSendingReply(true);
    try {
      await g.replyEmail({
        to: replyTo,
        subject: lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`,
        body: replyBody.trim(),
        threadId: lastMsg.threadId,
        messageId: lastMsg.messageId,
        references: lastMsg.references || lastMsg.messageId,
      });
      toast({ title: 'Reply sent' });
      setReplyBody('');
      setReplyOpen(false);
      await openThread(lastMsg.threadId);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to send', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setSendingReply(false);
    }
  };

  const handleCompose = async () => {
    const g = gmailRef.current;
    if (!composeBody.trim() || !leadEmail?.trim()) return;
    setSendingCompose(true);
    try {
      await g.sendEmail({
        to: leadEmail.trim(),
        subject: composeSubject.trim() || '(No subject)',
        body: composeBody.trim(),
      });
      toast({ title: 'Email sent' });
      setComposeSubject('');
      setComposeBody('');
      setView('list');
      hasFetchedRef.current = false;
      fetchThreadList();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to send', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setSendingCompose(false);
    }
  };

  if (!gmail.isConnected) {
    return (
      <Card className="card-shadow">
        <CardContent className="py-12 text-center space-y-3">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">Gmail not connected</p>
          <p className="text-sm text-muted-foreground">
            Connect Google in Admin Panel → Integrations to send and read emails.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!leadEmail?.trim()) {
    return (
      <Card className="card-shadow">
        <CardContent className="py-12 text-center space-y-3">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">No email address</p>
          <p className="text-sm text-muted-foreground">
            Add an email to this lead to view and send emails.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ─── Compose view ───
  if (view === 'compose') {
    return (
      <Card className="card-shadow">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <Button variant="ghost" size="icon" onClick={() => setView('list')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle className="text-lg">New email</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              To: {leadContactName ? `${leadContactName} <${leadEmail}>` : leadEmail}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Subject</Label>
            <Input
              placeholder={leadCompanyName ? `Re: ${leadCompanyName}` : 'Subject'}
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Message</Label>
            <Textarea
              placeholder="Write your email..."
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              rows={10}
              className="resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCompose}
              disabled={sendingCompose || !composeBody.trim()}
              className="gap-2"
            >
              {sendingCompose ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send email
            </Button>
            <Button variant="ghost" onClick={() => setView('list')}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Thread detail view ───
  if (view === 'thread' && activeThreadId) {
    return (
      <Card className="card-shadow">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setView('list'); setActiveThreadId(null); setThreadMessages([]); }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg truncate">
              {threadMessages[0]?.subject || 'Thread'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {threadMessages.length} message{threadMessages.length !== 1 ? 's' : ''} with {leadEmail}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          {loadingThread ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {threadMessages.map((msg, idx) => {
                const isFromLead = extractEmail(msg.from).toLowerCase() === leadEmail.toLowerCase();
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'rounded-lg border p-4 space-y-2',
                      isFromLead
                        ? 'bg-muted/40 border-border'
                        : 'bg-primary/[0.03] border-primary/10'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {extractName(msg.from)}
                          {isFromLead && (
                            <Badge variant="secondary" className="ml-2 text-[10px] py-0 px-1.5 font-normal">
                              Lead
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          To: {msg.to}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatEmailDate(msg.date)}
                      </span>
                    </div>
                    <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                      {msg.body}
                    </pre>
                    {idx === threadMessages.length - 1 && !replyOpen && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground hover:text-foreground mt-1"
                        onClick={() => setReplyOpen(true)}
                      >
                        <Reply className="h-3.5 w-3.5" />
                        Reply
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Reply form */}
          {replyOpen && (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.02] p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Reply className="h-4 w-4" />
                Replying to {leadContactName || extractName(threadMessages[threadMessages.length - 1]?.from || '')}
              </div>
              <Textarea
                placeholder="Write your reply..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={5}
                className="resize-none"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={sendingReply || !replyBody.trim()}
                  className="gap-1.5"
                >
                  {sendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send reply
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setReplyOpen(false); setReplyBody(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ─── Thread list view ───
  return (
    <Card className="card-shadow">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Emails</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Conversations with {leadEmail}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { hasFetchedRef.current = false; fetchThreadList(); }}
            disabled={loadingThreads}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loadingThreads && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => { setView('compose'); setComposeSubject(''); setComposeBody(''); }}
            className="gap-1.5"
          >
            <MailPlus className="h-3.5 w-3.5" />
            Compose
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingThreads ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 items-center">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : threadError ? (
          <div className="text-center py-8 space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive/50" />
            <p className="text-sm text-destructive">{threadError}</p>
            <Button variant="outline" size="sm" onClick={() => { hasFetchedRef.current = false; fetchThreadList(); }}>
              Retry
            </Button>
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No emails yet</p>
            <p className="text-sm text-muted-foreground">
              Send the first email to {leadContactName || leadEmail}.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setView('compose'); setComposeSubject(''); setComposeBody(''); }}
              className="gap-1.5"
            >
              <MailPlus className="h-3.5 w-3.5" />
              Compose email
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border -mx-6">
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                className="w-full flex items-start gap-3 px-6 py-3.5 text-left hover:bg-muted/50 transition-colors group"
                onClick={() => openThread(t.id)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate text-foreground">
                      {t.subject}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatEmailDate(t.date)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {extractName(t.from)}
                    {t.messageCount > 1 && (
                      <span className="text-muted-foreground/60 ml-1">({t.messageCount})</span>
                    )}
                  </p>
                  {t.snippet && (
                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">
                      {t.snippet}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
