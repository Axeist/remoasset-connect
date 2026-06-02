import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { CLIENT_REQUEST_TYPE_OPTIONS } from '@/constants/client-request-types';
import type { ClientRequestType } from '@/constants/client-request-types';
import { cn } from '@/lib/utils';
import { Package, Recycle, Ship, Warehouse } from 'lucide-react';

const TYPE_ICONS: Record<ClientRequestType, typeof Package> = {
  fulfillment: Package,
  retrieval_redeployment: Warehouse,
  cross_border: Ship,
  itad: Recycle,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: ClientRequestType) => void;
}

export function ChooseRequestTypeDialog({ open, onOpenChange, onSelect }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add client request</DialogTitle>
          <DialogDescription>
            Choose the request type. Each type has its own form and is labeled clearly on the client profile.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {CLIENT_REQUEST_TYPE_OPTIONS.map((opt) => {
            const Icon = TYPE_ICONS[opt.value];
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onSelect(opt.value);
                  onOpenChange(false);
                }}
                className={cn(
                  'text-left rounded-xl border p-4 transition-colors',
                  'hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                style={{ borderColor: `${opt.color}50` }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="rounded-lg p-2 shrink-0"
                    style={{ backgroundColor: `${opt.color}18`, color: opt.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{opt.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
