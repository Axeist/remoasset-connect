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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2, Phone, Mail, MessageCircle, Linkedin, ShieldCheck, Trophy, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TransitionMode = 'contact_activity' | 'nda_sent' | 'won' | 'lost' | 'comment_only';

export interface StageTransitionResult {
  comment: string;
  activityType: string;
  ndaSubActivity?: string;
  outcomeReason?: string;
}

const CONTACT_ACTIVITY_OPTIONS = [
  { value: 'call', label: 'Call', icon: Phone, activeClass: 'border-primary/50 bg-primary/10 text-primary ring-2 ring-primary/20' },
  { value: 'email', label: 'Email', icon: Mail, activeClass: 'border-orange-500/50 bg-orange-500/10 text-orange-700 ring-2 ring-orange-500/20' },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, activeClass: 'border-green-500/50 bg-green-500/10 text-green-700 ring-2 ring-green-500/20' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, activeClass: 'border-sky-500/50 bg-sky-500/10 text-sky-700 ring-2 ring-sky-500/20' },
];

const WON_REASONS = [
  'Price competitive',
  'Strong product fit',
  'Good relationship',
  'Referral/recommendation',
  'Other',
];

const LOST_REASONS = [
  'Price too high',
  'Chose competitor',
  'No budget',
  'No longer interested',
  'Unresponsive / ghosted',
  'Requirements changed',
  'Poor product fit',
  'Other',
];

export function getTransitionMode(toStatusName: string): TransitionMode {
  const lower = toStatusName.toLowerCase();
  if (['contacted', 'qualified', 'negotiation'].includes(lower)) return 'contact_activity';
  if (lower === 'proposal') return 'nda_sent';
  if (['won', 'closed won', 'closed-won'].includes(lower)) return 'won';
  if (['lost', 'closed lost', 'closed-lost'].includes(lower)) return 'lost';
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
  const [outcomeReason, setOutcomeReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setComment('');
      setSelectedActivity('call');
      setOutcomeReason('');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const isOutcome = transitionMode === 'won' || transitionMode === 'lost';
  const isFormValid = comment.trim() && (!isOutcome || outcomeReason);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    if (transitionMode === 'contact_activity') {
      onConfirm({ comment: comment.trim(), activityType: selectedActivity });
    } else if (transitionMode === 'nda_sent') {
      onConfirm({ comment: comment.trim(), activityType: 'nda', ndaSubActivity: 'nda_sent' });
    } else if (isOutcome) {
      onConfirm({ comment: comment.trim(), activityType: 'note', outcomeReason });
    } else {
      onConfirm({ comment: comment.trim(), activityType: 'note' });
    }
  };

  const reasonOptions = transitionMode === 'won' ? WON_REASONS : LOST_REASONS;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transitionMode === 'nda_sent'
              ? 'Log NDA Sent to proceed'
              : transitionMode === 'contact_activity'
                ? 'Log activity to proceed'
                : transitionMode === 'won'
                  ? 'Mark as Won'
                  : transitionMode === 'lost'
                    ? 'Mark as Lost'
                    : 'Why is this lead being moved?'}
          </DialogTitle>
          <DialogDescription>
            {transitionMode === 'contact_activity' && (
              <>A contact activity is required to move <span className="font-medium text-foreground">{leadName}</span> to <span className="font-medium text-foreground">{toStatus}</span>.</>
            )}
            {transitionMode === 'nda_sent' && (
              <>An NDA Sent activity will be logged to move <span className="font-medium text-foreground">{leadName}</span> to <span className="font-medium text-foreground">{toStatus}</span>.</>
            )}
            {transitionMode === 'won' && (
              <>Record why <span className="font-medium text-foreground">{leadName}</span> was won to improve future performance.</>
            )}
            {transitionMode === 'lost' && (
              <>Record why <span className="font-medium text-foreground">{leadName}</span> was lost to help the team learn and improve.</>
            )}
            {transitionMode === 'comment_only' && (
              <>Add a note about why <span className="font-medium text-foreground">{leadName}</span> is changing stages.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 py-2">
          <span className="rounded-md border bg-muted px-3 py-1.5 text-sm font-medium">{fromStatus}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className={cn(
            'rounded-md border px-3 py-1.5 text-sm font-medium',
            transitionMode === 'won'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : transitionMode === 'lost'
                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300'
                : 'border-primary/30 bg-primary/10 text-primary'
          )}>
            {transitionMode === 'won' && <Trophy className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
            {transitionMode === 'lost' && <ThumbsDown className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
            {toStatus}
          </span>
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
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">NDA Sent</p>
                <p className="text-xs text-muted-foreground">This activity will be logged automatically</p>
              </div>
            </div>
          )}

          {isOutcome && (
            <div className="space-y-2">
              <Label>
                {transitionMode === 'won' ? 'Win reason *' : 'Loss reason *'}
              </Label>
              <Select value={outcomeReason} onValueChange={setOutcomeReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {reasonOptions.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              {transitionMode === 'comment_only' ? 'Comment *' : isOutcome ? 'Additional notes *' : 'Description / Notes *'}
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
                    : transitionMode === 'won'
                      ? 'e.g. Great partnership. Agreed on 50-unit rental contract...'
                      : transitionMode === 'lost'
                        ? 'e.g. Client went with a cheaper local supplier...'
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
            <Button
              type="submit"
              disabled={submitting || !isFormValid}
              className={cn(
                'gap-2',
                transitionMode === 'won' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                transitionMode === 'lost' && 'bg-red-600 hover:bg-red-700 text-white',
              )}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {transitionMode === 'nda_sent'
                ? 'Move & Log NDA Sent'
                : transitionMode === 'contact_activity'
                  ? 'Move & Log Activity'
                  : transitionMode === 'won'
                    ? 'Mark as Won'
                    : transitionMode === 'lost'
                      ? 'Mark as Lost'
                      : 'Move & Log'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
