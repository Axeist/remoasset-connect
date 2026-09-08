import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const RFQ_RAISE_GUIDE = [
  {
    n: '1',
    title: 'Brief',
    body: 'Choose request type, client, country, quantity, and deadline. Write a clear scope. Pick vendor types — only Closed partners matching those types in the country are invited. You are always on CC.',
  },
  {
    n: '2',
    title: 'Partners',
    body: 'Review the matched list. Uncheck anyone who should not get this RFQ. If someone is missing, fix their lead status, country, or vendor types first.',
  },
  {
    n: '3',
    title: 'Email & send',
    body: 'Preview the invite. Keep the magic link in the email so each partner can quote. Test send to yourself if you want, then send to the selected partners.',
  },
  {
    n: '4',
    title: 'Track & award',
    body: 'Open the campaign to see who opened and quoted. Compare landed totals, request a revision if needed, then award with a short rationale and continue to the client for PO.',
  },
] as const;

export function RfqHowToButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`rounded-xl cursor-pointer shrink-0 ${className ?? ''}`}
        onClick={() => setOpen(true)}
      >
        <CircleHelp className="h-3.5 w-3.5 mr-1.5" />
        How to raise RFQ
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>How to raise an RFQ</DialogTitle>
            <DialogDescription>
              Four steps — same flow every time.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-4 pt-1">
            {RFQ_RAISE_GUIDE.map((item) => (
              <li key={item.n} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                  {item.n}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Button className="w-full rounded-xl mt-2 cursor-pointer" onClick={() => setOpen(false)}>
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
