import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowRight, Loader2, Phone, Mail, MessageCircle, Linkedin, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TransitionMode = 'contact_activity' | 'nda_sent' | 'comment_only';

export interface StageTransitionResult {
  comment: string;
  activityType: string;
  ndaSubActivity?: string;
}

const CONTACT_ACTIVITY_OPTIONS = [
  { value: 'call', label: 'Call', icon: Phone, activeClass: 'border-blue-500/50 bg-blue-500/10 text-blue-700 ring-2 ring-blue-500/20' },
  { value: 'email', label: 'Email', icon: Mail, activeClass: 'border-orange-500/50 bg-orange-500/10 text-orange-700 ring-2 ring-orange-500/20' },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, activeClass: 'border-green-500/50 bg-green-500/10 text-green-700 ring-2 ring-green-500/20' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, activeClass: 'border-sky-500/50 bg-sky-500/10 text-sky-700 ring-2 ring-sky-500/20' },
];

export function getTransitionMode(toStatusName: string): TransitionMode {
  const lower = toStatusName.toLowerCase();
  if (['contacted', 'qualified', 'negotiation'].includes(lower)) return 'contact_activity';
  if (lower === 'proposal') return 'nda_sent';
  return 'comment_only';
}

interface MoveCommentDialogProps {
  open: boolean;
  leadName: string;
  fromStatus: string;
  toStatus: string;
  transitionMode: TransitionMode;
  onConfirm: (result: StageTransitionResult) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function MoveCommentDialog({
  open,
  leadName,
  fromStatus,
  toStatus,
  transitionMode,
  onConfirm,
  onCancel,
  submitting,
}: MoveCommentDialogProps) {
  const [comment, setComment] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('call');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setComment('');
      setSelectedActivity('call');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    if (transitionMode === 'contact_activity') {
      onConfirm({ comment: comment.trim(), activityType: selectedActivity });
    } else if (transitionMode === 'nda_sent') {
      onConfirm({ comment: comment.trim(), activityType: 'nda', ndaSubActivity: 'nda_sent' });
    } else {
      onConfirm({ comment: comment.trim(), activityType: 'note' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transitionMode === 'nda_sent'
              ? 'Log NDA Sent to proceed'
              : transitionMode === 'contact_activity'
                ? 'Log activity to proceed'
                : 'Why is this lead being moved?'}
          </DialogTitle>
          <DialogDescription>
            {transitionMode === 'contact_activity' && (
              <>A contact activity is required to move <span className="font-medium text-foreground">{leadName}</span> to <span className="font-medium text-foreground">{toStatus}</span>.</>
            )}
            {transitionMode === 'nda_sent' && (
              <>An NDA Sent activity will be logged to move <span className="font-medium text-foreground">{leadName}</span> to <span className="font-medium text-foreground">{toStatus}</span>.</>
            )}
            {transitionMode === 'comment_only' && (
              <>Add a note about why <span className="font-medium text-foreground">{leadName}</span> is changing stages.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 py-2">
          <span className="rounded-md border bg-muted px-3 py-1.5 text-sm font-medium">{fromStatus}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">{toStatus}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {transitionMode === 'contact_activity' && (
            <div className="space-y-2">
              <Label>Activity Type *</Label>
              <div className="grid grid-cols-2 gap-2">
                {CONTACT_ACTIVITY_OPTIONS.map(({ value, label, icon: Icon, activeClass }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedActivity(value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                      selectedActivity === value
                        ? activeClass
                        : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {transitionMode === 'nda_sent' && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 shrink-0">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">NDA Sent</p>
                <p className="text-xs text-muted-foreground">This activity will be logged automatically</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              {transitionMode === 'comment_only' ? 'Comment *' : 'Description / Notes *'}
            </Label>
            <Textarea
              ref={textareaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                transitionMode === 'contact_activity'
                  ? 'e.g. Had a discovery call, customer showed interest...'
                  : transitionMode === 'nda_sent'
                    ? 'e.g. NDA sent via email for review and signing...'
                    : 'e.g. Customer showed interest, scheduling a demo next week...'
              }
              rows={3}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !comment.trim()} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {transitionMode === 'nda_sent'
                ? 'Move & Log NDA Sent'
                : transitionMode === 'contact_activity'
                  ? 'Move & Log Activity'
                  : 'Move & Log'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
