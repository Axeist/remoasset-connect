import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientRequestProfit } from '@/lib/client-request-pricing';

interface Props {
  quoted: string;
  onQuotedChange: (value: string) => void;
  landingCost: string;
  onLandingCostChange: (value: string) => void;
  serviceCost: string;
  onServiceCostChange: (value: string) => void;
  quotedLabel?: string;
  compact?: boolean;
}

export function ServiceRequestPricingFields({
  quoted, onQuotedChange,
  landingCost, onLandingCostChange,
  serviceCost, onServiceCostChange,
  quotedLabel = 'Price quoted (USD)',
  compact = false,
}: Props) {
  const profit = useMemo(() => {
    const q = parseFloat(quoted);
    const l = parseFloat(landingCost);
    const s = parseFloat(serviceCost);
    if (Number.isNaN(q)) return null;
    const landing = Number.isNaN(l) ? 0 : l;
    const service = Number.isNaN(s) ? 0 : s;
    if (landing + service <= 0) return null;
    return clientRequestProfit(landing, q, service);
  }, [quoted, landingCost, serviceCost]);

  const inputClass = compact ? 'h-9 text-sm' : undefined;

  return (
    <div className="space-y-3">
      <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-3'} gap-3`}>
        <div className="space-y-2">
          <Label className={compact ? 'text-xs text-muted-foreground' : undefined}>{quotedLabel}</Label>
          <Input type="number" step="0.01" min={0} value={quoted} onChange={(e) => onQuotedChange(e.target.value)} placeholder="0.00" className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label className={compact ? 'text-xs text-muted-foreground' : undefined}>Landing cost (USD)</Label>
          <Input type="number" step="0.01" min={0} value={landingCost} onChange={(e) => onLandingCostChange(e.target.value)} placeholder="0.00" className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label className={compact ? 'text-xs text-muted-foreground' : undefined}>Service cost (USD)</Label>
          <Input type="number" step="0.01" min={0} value={serviceCost} onChange={(e) => onServiceCostChange(e.target.value)} placeholder="0.00" className={inputClass} />
        </div>
      </div>
      <div className={`grid grid-cols-2 gap-3 ${compact ? 'max-w-md' : 'max-w-sm'}`}>
        <div className="space-y-1">
          <Label className={compact ? 'text-xs text-muted-foreground' : 'text-sm'}>Profit ($)</Label>
          <Input
            readOnly
            className={`bg-muted/50 tabular-nums ${inputClass ?? ''}`}
            value={profit != null ? profit.profitAmount.toFixed(2) : '—'}
          />
        </div>
        <div className="space-y-1">
          <Label className={compact ? 'text-xs text-muted-foreground' : 'text-sm'}>Profit margin (%)</Label>
          <Input
            readOnly
            className={`bg-muted/50 tabular-nums ${inputClass ?? ''}`}
            value={profit?.profitPctOnProcurement != null ? `${profit.profitPctOnProcurement.toFixed(2)}%` : '—'}
          />
        </div>
      </div>
    </div>
  );
}
