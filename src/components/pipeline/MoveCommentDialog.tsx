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
import { ArrowRight, Loader2 } from 'lucide-react';

interface MoveCommentDialogProps {
  open: boolean;
  leadName: string;
  fromStatus: string;
  toStatus: string;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function MoveCommentDialog({
  open,
  leadName,
  fromStatus,
  toStatus,
  onConfirm,
  onCancel,
  submitting,
}: MoveCommentDialogProps) {
  const [comment, setComment] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setComment('');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(comment.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Why is this lead being moved?</DialogTitle>
          <DialogDescription>
            Add a note about why <span className="font-medium text-foreground">{leadName}</span> is changing stages.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 py-2">
          <span className="rounded-md border bg-muted px-3 py-1.5 text-sm font-medium">{fromStatus}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">{toStatus}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            ref={textareaRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. Customer showed interest, scheduling a demo next week..."
            rows={3}
            className="resize-none"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !comment.trim()} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Move & Log
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
