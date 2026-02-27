import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useGmail, fileToEmailAttachment } from '@/hooks/useGmail';
import { parseGmailMessage, type ParsedGmailMessage } from '@/hooks/useGmail';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { EmailTagInput } from '@/components/ui/email-tag-input';
import { RichTextEditor, htmlToPlainText } from '@/components/ui/rich-text-editor';
import { useEmailSignatures } from '@/hooks/useEmailSignatures';
import { EmailSignaturesDialog } from '@/components/leads/EmailSignaturesDialog';
import { cn } from '@/lib/utils';
import {
  Mail,
  Send,
  ArrowLeft,
  RefreshCw,
  Inbox,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Reply,
  AlertCircle,
  Loader2,
  MailPlus,
  Paperclip,
  X,
} from 'lucide-react';

// ─── Helpers ───

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

function formatFullDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
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

/**
 * Separate the original content from quoted text in an email body.
 * Detects "On ... wrote:" blocks and "> " prefixed lines.
 */
function splitQuotedText(body: string): { original: string; quoted: string } {
  const lines = body.split('\n');
  let splitIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    // "On Mon, Jan 1, 2026 at 10:00 AM ... wrote:"
    if (/^On\s.+wrote:\s*$/i.test(lines[i].trim())) {
      splitIdx = i;
      break;
    }
    // Gmail-style "---------- Forwarded message ----------"
    if (/^-{5,}\s*(Forwarded|Original)\s/i.test(lines[i].trim())) {
      splitIdx = i;
      break;
    }
  }

  if (splitIdx >= 0) {
    const original = lines.slice(0, splitIdx).join('\n').trimEnd();
    const quoted = lines.slice(splitIdx).join('\n');
    return { original, quoted };
  }

  // Check if there's a block of ">" quoted lines at the end
  let lastNonQuoted = lines.length - 1;
  while (lastNonQuoted >= 0 && (lines[lastNonQuoted].startsWith('>') || lines[lastNonQuoted].trim() === '')) {
    lastNonQuoted--;
  }
  if (lastNonQuoted < lines.length - 1 && lines.slice(lastNonQuoted + 1).some(l => l.startsWith('>'))) {
    const original = lines.slice(0, lastNonQuoted + 1).join('\n').trimEnd();
    const quoted = lines.slice(lastNonQuoted + 1).join('\n');
    return { original, quoted };
  }

  return { original: body, quoted: '' };
}

function parseEmailDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
  } catch {
    return undefined;
  }
}

function gmailThreadUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}

async function syncIncomingToActivityLog(params: {
  leadId: string;
  userId: string;
  leadEmail: string;
  threadData: { threadId: string; messages: ParsedGmailMessage[] }[];
}): Promise<number> {
  const normalizedLead = params.leadEmail.toLowerCase();

  const incoming: { msg: ParsedGmailMessage; threadId: string }[] = [];
  for (const thread of params.threadData) {
    for (const msg of thread.messages) {
      if (extractEmail(msg.from).toLowerCase() === normalizedLead) {
        incoming.push({ msg, threadId: thread.threadId });
      }
    }
  }
  if (incoming.length === 0) return 0;

  const { data: existing } = await supabase
    .from('lead_activities')
    .select('attachments')
    .eq('lead_id', params.leadId)
    .eq('activity_type', 'email');

  const loggedIds = new Set<string>();
  for (const row of existing || []) {
    for (const att of (row.attachments as { type: string; url: string }[]) || []) {
      if (att.type === 'gmail_ref') loggedIds.add(att.url);
    }
  }

  const toInsert = incoming.filter(({ msg }) => !loggedIds.has(msg.id));
  if (toInsert.length === 0) return 0;

  const rows = toInsert.map(({ msg, threadId }) => {
    const snippet = (msg.body || msg.snippet || '').slice(0, 200);
    const description = `Email from ${extractName(msg.from)}: ${msg.subject || '(No subject)'}${snippet ? `\n\n${snippet}${(msg.body || msg.snippet || '').length > 200 ? '…' : ''}` : ''}`;
    const row: Record<string, unknown> = {
      lead_id: params.leadId,
      user_id: params.userId,
      activity_type: 'email',
      description,
      attachments: [
        { type: 'url', url: gmailThreadUrl(threadId), name: 'View in Gmail' },
        { type: 'gmail_ref', url: msg.id, name: 'gmail_message_id' },
        { type: 'activity_source', url: 'automation', name: 'activity_source' },
      ],
    };
    const ts = parseEmailDate(msg.date);
    if (ts) row.created_at = ts;
    return row;
  });

  await supabase.from('lead_activities').insert(rows);
  return rows.length;
}

// ─── CC/BCC Toggle Component ───

function CcBccFields({
  cc, onCcChange, bcc, onBccChange,
}: {
  cc: string; onCcChange: (v: string) => void;
  bcc: string; onBccChange: (v: string) => void;
}) {
  const [showCc, setShowCc] = useState(!!cc);
  const [showBcc, setShowBcc] = useState(!!bcc);

  return (
    <div className="space-y-2">
      {!showCc && !showBcc && (
        <div className="flex gap-2 text-xs">
          <button type="button" className="text-primary hover:underline" onClick={() => setShowCc(true)}>Cc</button>
          <button type="button" className="text-primary hover:underline" onClick={() => setShowBcc(true)}>Bcc</button>
        </div>
      )}
      {showCc && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-8 shrink-0">Cc</Label>
          <EmailTagInput value={cc} onChange={onCcChange} placeholder="Add Cc recipients" className="flex-1" />
          {!showBcc && (
            <button type="button" className="text-xs text-primary hover:underline shrink-0" onClick={() => setShowBcc(true)}>Bcc</button>
          )}
        </div>
      )}
      {showBcc && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-8 shrink-0">Bcc</Label>
          <EmailTagInput value={bcc} onChange={onBccChange} placeholder="Add Bcc recipients" className="flex-1" />
          {!showCc && (
            <button type="button" className="text-xs text-primary hover:underline shrink-0" onClick={() => setShowCc(true)}>Cc</button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Message Bubble Component (Gmail-like) ───

function MessageBubble({
  msg,
  isFromLead,
  leadEmail,
  leadContactName,
  isLast,
  defaultCollapsed,
  onReply,
}: {
  msg: ParsedGmailMessage;
  isFromLead: boolean;
  leadEmail: string;
  leadContactName?: string | null;
  isLast: boolean;
  defaultCollapsed: boolean;
  onReply: () => void;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showQuoted, setShowQuoted] = useState(false);
  const { original, quoted } = splitQuotedText(msg.body);
  const senderName = extractName(msg.from);

  if (collapsed) {
    return (
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors rounded-lg"
        onClick={() => setCollapsed(false)}
      >
        <div className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
          isFromLead ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        )}>
          {getInitials(senderName)}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">{senderName}</span>
          <span className="text-xs text-muted-foreground ml-2">— {msg.snippet?.slice(0, 80) || '(empty)'}</span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{formatEmailDate(msg.date)}</span>
      </button>
    );
  }

  return (
    <div className={cn(
      'rounded-lg border p-4',
      isFromLead ? 'bg-muted/30 border-border' : 'bg-background border-border'
    )}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          isFromLead ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        )}>
          {getInitials(senderName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{senderName}</span>
            {isFromLead && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">Lead</Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatFullDate(msg.date)}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span>To: {msg.to}</span>
            {msg.cc && <span className="ml-2">Cc: {msg.cc}</span>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="pl-12">
        <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{original}</div>
        {quoted && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowQuoted(!showQuoted)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-0.5 transition-colors"
            >
              {showQuoted ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showQuoted ? 'Hide quoted text' : '...'}
            </button>
            {showQuoted && (
              <div className="mt-2 pl-3 border-l-2 border-muted-foreground/20 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {quoted}
              </div>
            )}
          </div>
        )}

        {/* Reply button on last message */}
        {isLast && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 mt-3"
            onClick={onReply}
          >
            <Reply className="h-3.5 w-3.5" />
            Reply
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Component ───

export function LeadEmailTab({
  leadId,
  leadEmail,
  leadCompanyName,
  leadContactName,
  onActivityLogged,
  openThreadId,
}: {
  leadId: string;
  leadEmail?: string | null;
  leadCompanyName?: string;
  leadContactName?: string | null;
  onActivityLogged?: () => void;
  /** If set, immediately open this thread (for cross-tab navigation) */
  openThreadId?: string | null;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const gmail = useGmail();
  const gmailRef = useRef(gmail);
  gmailRef.current = gmail;

  const userRef = useRef(user);
  userRef.current = user;
  const leadIdRef = useRef(leadId);
  leadIdRef.current = leadId;
  const onActivityLoggedRef = useRef(onActivityLogged);
  onActivityLoggedRef.current = onActivityLogged;

  const [view, setView] = useState<'list' | 'thread' | 'compose'>('list');

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ParsedGmailMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyCc, setReplyCc] = useState('');
  const [replyBcc, setReplyBcc] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeFiles, setComposeFiles] = useState<File[]>([]);
  const [sendingCompose, setSendingCompose] = useState(false);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const { signatures, add: addSig, update: updateSig, remove: removeSig, refresh: refreshSigs } = useEmailSignatures(user?.id);
  const [signaturesDialogOpen, setSignaturesDialogOpen] = useState(false);

  // ─── Log outgoing email activity with gmail_ref for dedup ───
  const logEmailActivity = useCallback(
    async (params: {
      subject: string;
      body: string;
      threadId: string;
      gmailMessageId: string;
      isReply?: boolean;
    }) => {
      if (!user?.id || !leadId) return;
      const label = params.isReply ? 'Reply to lead' : 'Email to lead';
      const preview = params.body.slice(0, 200);
      const description = `${label}: ${params.subject}${preview ? `\n\n${preview}${params.body.length > 200 ? '…' : ''}` : ''}`;
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'email',
        description,
        attachments: [
          { type: 'url', url: gmailThreadUrl(params.threadId), name: 'View in Gmail' },
          { type: 'gmail_ref', url: params.gmailMessageId, name: 'gmail_message_id' },
        ],
      });
      onActivityLogged?.();
    },
    [user?.id, leadId, onActivityLogged]
  );

  // ─── Fetch thread list + sync incoming ───
  const fetchThreadList = useCallback(async () => {
    const g = gmailRef.current;
    if (!leadEmail?.trim() || !g.isConnected) return;
    setLoadingThreads(true);
    setThreadError(null);
    try {
      const threadRefs = await g.listThreads(leadEmail.trim());
      if (threadRefs.length === 0) {
        setThreads([]);
        return;
      }

      const summaries: ThreadSummary[] = [];
      const allThreadData: { threadId: string; messages: ParsedGmailMessage[] }[] = [];

      for (const ref of threadRefs.slice(0, 20)) {
        try {
          const thread = await g.getThread(ref.id, 'metadata');
          const msgs = thread.messages || [];
          if (msgs.length === 0) continue;
          const parsed = msgs.map(parseGmailMessage);
          allThreadData.push({ threadId: ref.id, messages: parsed });

          const first = parsed[0];
          const last = parsed[parsed.length - 1];
          summaries.push({
            id: ref.id,
            subject: first.subject || '(No subject)',
            snippet: ref.snippet || last.snippet || '',
            from: last.from,
            date: last.date,
            messageCount: msgs.length,
          });
        } catch {
          // skip
        }
      }
      setThreads(summaries);

      const currentUser = userRef.current;
      const currentLeadId = leadIdRef.current;
      if (currentUser?.id && currentLeadId) {
        try {
          const synced = await syncIncomingToActivityLog({
            leadId: currentLeadId,
            userId: currentUser.id,
            leadEmail: leadEmail.trim(),
            threadData: allThreadData,
          });
          if (synced > 0) onActivityLoggedRef.current?.();
        } catch {
          // silent
        }
      }
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

  // ─── Handle external openThreadId prop ───
  const handledOpenThreadRef = useRef<string | null>(null);
  useEffect(() => {
    if (openThreadId && openThreadId !== handledOpenThreadRef.current && gmail.isConnected) {
      handledOpenThreadRef.current = openThreadId;
      openThread(openThreadId);
    }
  }, [openThreadId, gmail.isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Open thread ───
  const openThread = useCallback(async (threadId: string) => {
    const g = gmailRef.current;
    setActiveThreadId(threadId);
    setView('thread');
    setReplyOpen(false);
    setReplyBody('');
    setReplyCc('');
    setReplyBcc('');
    setLoadingThread(true);
    try {
      const thread = await g.getThread(threadId, 'full');
      const parsed = (thread.messages || []).map(parseGmailMessage);
      setThreadMessages(parsed);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : 'Failed to load thread' });
      setView('list');
    } finally {
      setLoadingThread(false);
    }
  }, [toast]);

  // ─── Reply ───
  const handleReply = useCallback(async () => {
    const g = gmailRef.current;
    const plainReply = htmlToPlainText(replyBody);
    if (!plainReply || threadMessages.length === 0) return;
    const lastMsg = threadMessages[threadMessages.length - 1];
    const replyTo = extractEmail(lastMsg.from).toLowerCase() === leadEmail?.trim().toLowerCase()
      ? leadEmail!.trim()
      : extractEmail(lastMsg.from);

    const subject = lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`;
    setSendingReply(true);
    try {
      const replyAttachments = replyFiles.length > 0 ? await Promise.all(replyFiles.map(fileToEmailAttachment)) : undefined;
      const result = await g.replyEmail({
        to: replyTo,
        subject,
        body: replyBody,
        cc: replyCc.trim() || undefined,
        bcc: replyBcc.trim() || undefined,
        threadId: lastMsg.threadId,
        inReplyTo: lastMsg.messageId,
        references: lastMsg.references || lastMsg.messageId,
        attachments: replyAttachments,
      });
      await logEmailActivity({ subject, body: plainReply, threadId: result.threadId, gmailMessageId: result.id, isReply: true });
      toast({ title: 'Reply sent' });
      setReplyBody('');
      setReplyCc('');
      setReplyBcc('');
      setReplyFiles([]);
      setReplyOpen(false);
      await openThread(lastMsg.threadId);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to send reply', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setSendingReply(false);
    }
  }, [replyBody, replyCc, replyBcc, replyFiles, threadMessages, leadEmail, openThread, logEmailActivity, toast]);

  // ─── Compose ───
  const handleCompose = useCallback(async () => {
    const g = gmailRef.current;
    const plainCompose = htmlToPlainText(composeBody);
    if (!plainCompose || !leadEmail?.trim()) return;
    const subject = composeSubject.trim() || '(No subject)';
    setSendingCompose(true);
    try {
      const composeAttachments = composeFiles.length > 0 ? await Promise.all(composeFiles.map(fileToEmailAttachment)) : undefined;
      const result = await g.sendEmail({
        to: leadEmail.trim(),
        subject,
        body: composeBody,
        cc: composeCc.trim() || undefined,
        bcc: composeBcc.trim() || undefined,
        attachments: composeAttachments,
      });
      await logEmailActivity({ subject, body: plainCompose, threadId: result.threadId, gmailMessageId: result.id });
      toast({ title: 'Email sent' });
      setComposeSubject('');
      setComposeBody('');
      setComposeCc('');
      setComposeBcc('');
      setComposeFiles([]);
      setView('list');
      hasFetchedRef.current = false;
      fetchThreadList();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to send', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setSendingCompose(false);
    }
  }, [composeBody, composeSubject, composeCc, composeBcc, composeFiles, leadEmail, fetchThreadList, logEmailActivity, toast]);

  // ─── Guards ───

  if (!gmail.isConnected) {
    return (
      <Card className="card-shadow">
        <CardContent className="py-12 text-center space-y-3">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">Gmail not connected</p>
          <p className="text-sm text-muted-foreground">
            Connect Google in Admin Panel &rarr; Integrations to send and read emails.
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
          <p className="text-sm text-muted-foreground">Add an email to this lead to view and send emails.</p>
        </CardContent>
      </Card>
    );
  }

  // ─── Compose view ───

  if (view === 'compose') {
    return (
      <Card className="card-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setView('list')} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">New message</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* To */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-8 shrink-0">To</Label>
            <div className="flex-1 text-sm py-1.5 px-3 bg-muted/30 rounded-md border">
              {leadContactName ? `${leadContactName} <${leadEmail}>` : leadEmail}
            </div>
          </div>

          {/* CC / BCC */}
          <CcBccFields cc={composeCc} onCcChange={setComposeCc} bcc={composeBcc} onBccChange={setComposeBcc} />

          {/* Subject */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-8 shrink-0">Sub</Label>
            <Input
              placeholder={leadCompanyName ? `Re: ${leadCompanyName}` : 'Subject'}
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Body */}
          <RichTextEditor
            value={composeBody}
            onChange={setComposeBody}
            placeholder="Compose email..."
            minHeight="250px"
            signatures={signatures}
            onManageSignatures={() => setSignaturesDialogOpen(true)}
          />

          {/* Attachments */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                id="compose-files"
                onChange={(e) => {
                  const chosen = Array.from(e.target.files ?? []);
                  const valid = chosen.filter((f) => f.size <= 10 * 1024 * 1024).slice(0, 10 - composeFiles.length);
                  setComposeFiles((prev) => [...prev, ...valid].slice(0, 10));
                  e.target.value = '';
                }}
              />
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => document.getElementById('compose-files')?.click()}>
                <Paperclip className="h-3.5 w-3.5" />
                Attach files
              </Button>
              <span className="text-xs text-muted-foreground">Up to 10 files, 10MB each. Images and PDF.</span>
            </div>
            {composeFiles.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {composeFiles.map((f, i) => (
                  <li key={i} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                    <span className="truncate max-w-[140px]">{f.name}</span>
                    <button type="button" onClick={() => setComposeFiles((p) => p.filter((_, j) => j !== i))} className="shrink-0 rounded p-0.5 hover:bg-muted-foreground/20">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleCompose} disabled={sendingCompose || !htmlToPlainText(composeBody)} className="gap-2">
              {sendingCompose ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
            <Button variant="ghost" onClick={() => setView('list')}>Discard</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Thread detail view ───

  if (view === 'thread' && activeThreadId) {
    const threadSubject = threadMessages[0]?.subject || 'Thread';
    return (
      <Card className="card-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => { setView('list'); setActiveThreadId(null); setThreadMessages([]); }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg truncate">{threadSubject}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {threadMessages.length} message{threadMessages.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingThread ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-16 w-full ml-12" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {threadMessages.map((msg, idx) => {
                const isFromLead = extractEmail(msg.from).toLowerCase() === leadEmail.toLowerCase();
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isFromLead={isFromLead}
                    leadEmail={leadEmail}
                    leadContactName={leadContactName}
                    isLast={idx === threadMessages.length - 1}
                    defaultCollapsed={threadMessages.length > 2 && idx < threadMessages.length - 2}
                    onReply={() => {
                      setReplyOpen(true);
                      setReplyCc(msg.cc || '');
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Reply area */}
          {replyOpen && (
            <div className="mt-4 rounded-lg border p-4 space-y-3 bg-muted/20">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Reply className="h-4 w-4" />
                <span>
                  Replying to{' '}
                  <strong>{leadContactName || extractName(threadMessages[threadMessages.length - 1]?.from || '')}</strong>
                </span>
              </div>

              <CcBccFields cc={replyCc} onCcChange={setReplyCc} bcc={replyBcc} onBccChange={setReplyBcc} />

              <RichTextEditor
                value={replyBody}
                onChange={setReplyBody}
                placeholder="Write your reply..."
                minHeight="150px"
                autoFocus
                signatures={signatures}
                onManageSignatures={() => setSignaturesDialogOpen(true)}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  className="hidden"
                  id="reply-files"
                  onChange={(e) => {
                    const chosen = Array.from(e.target.files ?? []);
                    const valid = chosen.filter((f) => f.size <= 10 * 1024 * 1024).slice(0, 10 - replyFiles.length);
                    setReplyFiles((prev) => [...prev, ...valid].slice(0, 10));
                    e.target.value = '';
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => document.getElementById('reply-files')?.click()}>
                  <Paperclip className="h-3.5 w-3.5" />
                  Attach
                </Button>
                {replyFiles.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {replyFiles.map((f) => f.name).join(', ')}
                    <button type="button" onClick={() => setReplyFiles([])} className="ml-1 underline">Clear</button>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={sendingReply || !htmlToPlainText(replyBody)}
                  className="gap-1.5"
                >
                  {sendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setReplyOpen(false); setReplyBody(''); setReplyCc(''); setReplyBcc(''); }}>
                  Discard
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
    <>
    <Card className="card-shadow">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Emails</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Conversations with {leadEmail}</p>
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
            onClick={() => { setView('compose'); setComposeSubject(''); setComposeBody(''); setComposeCc(''); setComposeBcc(''); setComposeFiles([]); }}
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
            <Button variant="outline" size="sm" onClick={() => { hasFetchedRef.current = false; fetchThreadList(); }}>Retry</Button>
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No emails yet</p>
            <p className="text-sm text-muted-foreground">Send the first email to {leadContactName || leadEmail}.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setView('compose'); setComposeSubject(''); setComposeBody(''); setComposeCc(''); setComposeBcc(''); setComposeFiles([]); }}
              className="gap-1.5"
            >
              <MailPlus className="h-3.5 w-3.5" />
              Compose email
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border -mx-6">
            {threads.map((t) => {
              const senderName = extractName(t.from);
              return (
                <button
                  key={t.id}
                  type="button"
                  className="w-full flex items-start gap-3 px-6 py-3.5 text-left hover:bg-muted/50 transition-colors group"
                  onClick={() => openThread(t.id)}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold mt-0.5">
                    {getInitials(senderName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-semibold truncate text-foreground">{senderName}</p>
                        {t.messageCount > 1 && (
                          <span className="text-xs text-muted-foreground shrink-0">{t.messageCount}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatEmailDate(t.date)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground truncate mt-0.5">{t.subject}</p>
                    {t.snippet && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.snippet}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    <EmailSignaturesDialog
      open={signaturesDialogOpen}
      onOpenChange={setSignaturesDialogOpen}
      signatures={signatures}
      onAdd={(name, content) => addSig(name, content)}
      onUpdate={updateSig}
      onRemove={removeSig}
      onRefresh={refreshSigs}
    />
  </>
  );
}
