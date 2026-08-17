import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useGmail } from '@/hooks/useGmail';
import { Loader2, Mail, Copy } from 'lucide-react';
import { htmlToPlainText, RichTextEditor } from '@/components/ui/rich-text-editor';

function toEditorHtml(text: string): string {
  if (!text.trim()) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export interface DraftFollowUpLead {
  id: string;
  company_name: string;
  email: string | null;
  status?: { name: string } | null;
}

interface DraftFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: DraftFollowUpLead | null;
  onSent?: () => void;
}

export function DraftFollowUpDialog({ open, onOpenChange, lead, onSent }: DraftFollowUpDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const gmail = useGmail();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stageName = lead?.status?.name ?? 'this stage';

  const startDraft = async (nextLead: DraftFollowUpLead) => {
    setError(null);
    setSubject('');
    setBody('');
    setTo(nextLead.email ?? '');
    if (!nextLead.email) {
      setError('This lead has no email. Add one on the lead before drafting.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('draft-sla-followup', {
        body: { lead_id: nextLead.id },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setSubject(data.subject ?? '');
      setBody(toEditorHtml(data.body ?? ''));
      if (data.to) setTo(data.to);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not draft follow-up');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && lead) void startDraft(lead);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?.id]);

  const handleOpen = (next: boolean) => {
    onOpenChange(next);
  };

  const logActivity = async () => {
    if (!user?.id || !lead) return;
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      user_id: user.id,
      activity_type: 'email',
      description: `Email to lead: ${subject}\n\n${htmlToPlainText(body).slice(0, 200)}${htmlToPlainText(body).length > 200 ? '…' : ''}`,
    });
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !htmlToPlainText(body)) return;
    setSending(true);
    try {
      if (gmail.isConnected) {
        await gmail.sendEmail({ to: to.trim(), subject: subject.trim(), body });
        await logActivity();
        toast({ title: 'Follow-up sent' });
        onSent?.();
        onOpenChange(false);
      } else {
        setError('Connect Gmail in Admin → Integrations (or Settings) to send. You can copy the draft instead.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const copyDraft = async () => {
    await navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${htmlToPlainText(body)}`);
    toast({ title: 'Copied draft' });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Draft follow-up</DialogTitle>
          <DialogDescription>
            {loading
              ? `Writing a ${stageName} follow-up…`
              : `${lead?.company_name ?? 'Lead'} · ${stageName}`}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Writing a {stageName} follow-up…
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <RichTextEditor
                key={`${lead?.id}-${subject}`}
                value={body}
                onChange={setBody}
                minHeight="180px"
                placeholder="Follow-up body"
              />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={copyDraft} disabled={loading || !htmlToPlainText(body)}>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button
            className="gradient-primary gap-1"
            onClick={handleSend}
            disabled={loading || sending || !subject || !htmlToPlainText(body) || !to}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
