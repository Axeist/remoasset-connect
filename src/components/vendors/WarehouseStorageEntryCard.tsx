import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getClientRequestTypeMeta } from '@/constants/client-request-types';
import { CLIENT_REQUEST_STATUSES } from '@/constants/device-options';
import type { WarehouseStorageEntry } from '@/lib/warehouse-storage';
import { format, parseISO, isValid } from 'date-fns';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight, Calendar, ExternalLink, HardDrive, MapPin, Package, Truck, User, Wrench,
} from 'lucide-react';

const STATE_BADGE: Record<string, { label: string; className: string }> = {
  stored: { label: 'In storage', className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' },
  incoming: { label: 'Incoming', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  outbound: { label: 'Outbound', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
};

function fmtDate(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const d = parseISO(value.length <= 10 ? `${value}T00:00:00` : value);
    return isValid(d) ? format(d, 'MMM d, yyyy') : null;
  } catch {
    return null;
  }
}

function MetaRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 min-w-0">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className="text-sm text-foreground leading-snug break-words">{value}</p>
      </div>
    </div>
  );
}

type Props = {
  entry: WarehouseStorageEntry;
  onOpenClient: () => void;
};

export function WarehouseStorageEntryCard({ entry, onOpenClient }: Props) {
  const typeMeta = getClientRequestTypeMeta(entry.requestType);
  const statusInfo = CLIENT_REQUEST_STATUSES.find((s) => s.value === entry.status);
  const stateBadge = STATE_BADGE[entry.storageState];

  const dates = [
    entry.createdAt && { label: 'Created', value: fmtDate(entry.createdAt) },
    entry.pickupDate && { label: 'Pickup', value: fmtDate(entry.pickupDate) },
    entry.shippingDate && { label: 'Shipped', value: fmtDate(entry.shippingDate) },
    entry.warehouseDeliveryDate && { label: 'Warehouse arrival', value: fmtDate(entry.warehouseDeliveryDate) },
    entry.expectedDeliveryDate && { label: 'Expected', value: fmtDate(entry.expectedDeliveryDate) },
    entry.deliveryDate && { label: 'Delivered', value: fmtDate(entry.deliveryDate) },
  ].filter((d): d is { label: string; value: string } => Boolean(d?.value));

  const vendorLine = [entry.vendorName, entry.vendorCountry].filter(Boolean).join(' · ');
  const locationLine = entry.warehouseLocation
    ? entry.vendorName
      ? `${entry.warehouseLocation} — via ${entry.vendorName}`
      : entry.warehouseLocation
    : vendorLine || null;

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs shrink-0"
              style={{ backgroundColor: `${typeMeta.color}15`, color: typeMeta.color, borderColor: `${typeMeta.color}40` }}
            >
              {typeMeta.label}
            </Badge>
            <Badge variant="outline" className={`text-xs ${stateBadge.className}`}>{stateBadge.label}</Badge>
            {statusInfo && (
              <Badge variant="outline" className="text-xs" style={{ color: statusInfo.color, borderColor: `${statusInfo.color}50` }}>
                {statusInfo.label}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {entry.deviceCount} device{entry.deviceCount === 1 ? '' : 's'}
            </span>
          </div>
          <h4 className="text-base font-semibold text-foreground leading-snug">{entry.title}</h4>
          {entry.subtitle && (
            <p className="text-sm text-muted-foreground">{entry.subtitle}</p>
          )}
          {entry.routeLabel && (
            <p className="text-sm text-foreground flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
              {entry.routeLabel}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="shrink-0 h-8 gap-1.5 text-xs" onClick={onOpenClient}>
          View request <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>

      {entry.devices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" /> Devices
          </p>
          <div className="grid gap-2">
            {entry.devices.map((device, idx) => (
              <div
                key={`${device.brand}-${device.model}-${idx}`}
                className="rounded-md border border-border/50 bg-muted/20 px-3 py-2.5 space-y-2"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-xs font-medium text-primary">{device.category}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {device.brand} {device.model}
                  </span>
                  {device.quantity > 1 && (
                    <span className="text-sm text-muted-foreground">×{device.quantity}</span>
                  )}
                  {device.serialNumber && (
                    <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      S/N {device.serialNumber}
                    </span>
                  )}
                </div>
                {device.specs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {device.specs.map((spec) => (
                      <span
                        key={`${spec.label}-${spec.value}`}
                        className="inline-flex items-center rounded-md bg-background/80 border border-border/50 px-2 py-1 text-xs text-foreground"
                      >
                        <span className="text-muted-foreground mr-1">{spec.label}:</span>
                        {spec.value}
                      </span>
                    ))}
                  </div>
                )}
                {device.addons.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Add-ons: {device.addons.join(' · ')}
                  </p>
                )}
                {device.notes && (
                  <p className="text-xs text-muted-foreground italic">{device.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-1 border-t border-border/40">
        <MetaRow icon={MapPin} label="Warehouse / location" value={locationLine} />
        <MetaRow icon={Truck} label="Vendor" value={vendorLine || null} />
        <MetaRow icon={Package} label="Request country" value={entry.requestCountry} />
        {entry.fromAddress && (
          <MetaRow icon={MapPin} label="From" value={entry.fromAddress} />
        )}
        {entry.toAddress && (
          <MetaRow icon={MapPin} label="To" value={entry.toAddress} />
        )}
        {entry.originContact && (
          <MetaRow icon={User} label="Origin contact" value={entry.originContact} />
        )}
        {entry.destinationContact && (
          <MetaRow icon={User} label="Destination contact" value={entry.destinationContact} />
        )}
        {entry.services.length > 0 && (
          <MetaRow
            icon={Wrench}
            label="Warehouse services"
            value={
              <span className="flex flex-wrap gap-1.5">
                {entry.services.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs font-normal">{s}</Badge>
                ))}
              </span>
            }
          />
        )}
        {dates.length > 0 && (
          <MetaRow
            icon={Calendar}
            label="Timeline"
            value={
              <span className="flex flex-col gap-0.5">
                {dates.map((d) => (
                  <span key={d.label}>
                    <span className="text-muted-foreground">{d.label}:</span> {d.value}
                  </span>
                ))}
              </span>
            }
          />
        )}
      </div>

      {entry.notes && entry.notes !== entry.subtitle && (
        <p className="text-sm text-muted-foreground border-t border-border/40 pt-3 leading-relaxed">
          <span className="font-medium text-foreground">Notes: </span>
          {entry.notes}
        </p>
      )}
    </div>
  );
}
