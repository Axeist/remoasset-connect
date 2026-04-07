import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Trash2, Plus, ChevronDown, ChevronUp, HelpCircle, Search, Package } from 'lucide-react';
import {
  BRANDS, MODELS_BY_BRAND, ALL_PROCESSORS, PROCESSORS_BY_BRAND,
  DISPLAY_SIZES, RAM_OPTIONS, STORAGE_OPTIONS, ADDON_TYPES, OS_OPTIONS,
} from '@/constants/device-options';
import type { DeviceAddon } from '@/types/procurement';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface DeviceSpecValues {
  brand: string;
  device_model: string;
  processor: string;
  display_size: string;
  ram: string;
  storage: string;
  gpu: string;
  os: string;
  quantity: number;
  addons: DeviceAddon[];
  notes: string;
}

interface DeviceSpecFormProps {
  values: DeviceSpecValues;
  onChange: (values: DeviceSpecValues) => void;
  sectionNumberStart?: number;
  addonsMode?: 'inline' | 'dialog';
}

function ComboboxField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  tooltip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  required?: boolean;
  tooltip?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const selectOption = (opt: string) => {
    onChange(opt);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">{tooltip}</p></TooltipContent>
          </Tooltip>
        )}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal h-10",
              !value && "text-muted-foreground"
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search) {
                  if (filtered.length > 0) {
                    selectOption(filtered[0]);
                  } else {
                    selectOption(search);
                  }
                }
                if (e.key === 'Escape') {
                  setOpen(false);
                }
              }}
            />
          </div>
          <ScrollArea className="max-h-[200px]">
            {filtered.length === 0 && search ? (
              <button
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded cursor-pointer"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(search)}
              >
                Use &ldquo;<span className="font-medium">{search}</span>&rdquo;
              </button>
            ) : filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No options</p>
            ) : (
              <div className="p-1">
                {filtered.map((opt) => (
                  <button
                    key={opt}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                      value === opt && "bg-accent/50"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectOption(opt)}
                  >
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', value === opt ? 'opacity-100' : 'opacity-0')} />
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function AddonsInline({
  addons,
  onAddonsChange,
}: {
  addons: DeviceAddon[];
  onAddonsChange: (addons: DeviceAddon[]) => void;
}) {
  const [open, setOpen] = useState(true);

  const addAddon = () => onAddonsChange([...addons, { type: '', model: '', qty: 1 }]);
  const updateAddon = (idx: number, field: keyof DeviceAddon, val: string | number) => {
    onAddonsChange(addons.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  };
  const removeAddon = (idx: number) => onAddonsChange(addons.filter((_, i) => i !== idx));

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 rounded-t-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Add-ons</span>
          <AddonBadge count={addons.length} />
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {addons.map((addon, idx) => (
            <AddonRow
              key={idx}
              addon={addon}
              index={idx}
              onUpdate={updateAddon}
              onRemove={removeAddon}
            />
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addAddon} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add add-on
          </Button>
        </div>
      )}
    </div>
  );
}

function AddonsDialogButton({
  addons,
  onAddonsChange,
}: {
  addons: DeviceAddon[];
  onAddonsChange: (addons: DeviceAddon[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DeviceAddon[]>([]);

  const handleOpen = () => {
    setDraft(addons.map((a) => ({ ...a })));
    setOpen(true);
  };

  const handleSave = () => {
    onAddonsChange(draft.filter((a) => a.type && a.model));
    setOpen(false);
  };

  const addAddon = () => setDraft((p) => [...p, { type: '', model: '', qty: 1 }]);
  const updateAddon = (idx: number, field: keyof DeviceAddon, val: string | number) => {
    setDraft((p) => p.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  };
  const removeAddon = (idx: number) => setDraft((p) => p.filter((_, i) => i !== idx));

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full border border-dashed rounded-lg px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary">
            <Package className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium">
              Add-ons
              {addons.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {addons.length} item{addons.length !== 1 ? 's' : ''} added
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {addons.length === 0
                ? 'Mouse, keyboard, monitor, docking station...'
                : addons.map((a) => a.type || 'Untitled').join(', ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AddonBadge count={addons.length} />
          <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Device Add-ons
            </DialogTitle>
            <DialogDescription>
              Add peripherals and accessories for this device configuration.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-2">
              {draft.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No add-ons yet</p>
                  <p className="text-xs">Click below to add peripherals and accessories</p>
                </div>
              )}
              {draft.map((addon, idx) => (
                <AddonRow
                  key={idx}
                  addon={addon}
                  index={idx}
                  onUpdate={updateAddon}
                  onRemove={removeAddon}
                />
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addAddon} className="gap-1.5 w-full">
                <Plus className="h-3.5 w-3.5" /> Add add-on
              </Button>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>
              Save {draft.filter((a) => a.type && a.model).length} add-on{draft.filter((a) => a.type && a.model).length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddonRow({
  addon,
  index,
  onUpdate,
  onRemove,
}: {
  addon: DeviceAddon;
  index: number;
  onUpdate: (idx: number, field: keyof DeviceAddon, val: string | number) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">#{index + 1} {addon.type || 'New Add-on'}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Addon Type <span className="text-destructive">*</span></Label>
          <Select value={addon.type} onValueChange={(v) => onUpdate(index, 'type', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {ADDON_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Model Name <span className="text-destructive">*</span></Label>
          <Input
            value={addon.model}
            onChange={(e) => onUpdate(index, 'model', e.target.value)}
            placeholder="e.g. Magic Mouse"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Qty <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            min={1}
            value={addon.qty}
            onChange={(e) => onUpdate(index, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

export function DeviceSpecForm({ values, onChange, sectionNumberStart = 1, addonsMode = 'inline' }: DeviceSpecFormProps) {
  const sn = sectionNumberStart;

  const update = <K extends keyof DeviceSpecValues>(key: K, val: DeviceSpecValues[K]) => {
    onChange({ ...values, [key]: val });
  };

  const handleBrandChange = (v: string) => {
    if (v !== values.brand) {
      onChange({ ...values, brand: v, device_model: '' });
    } else {
      onChange({ ...values, brand: v });
    }
  };

  const modelOptions = values.brand && MODELS_BY_BRAND[values.brand]
    ? MODELS_BY_BRAND[values.brand]
    : Object.values(MODELS_BY_BRAND).flat();

  const processorOptions = values.brand === 'Apple'
    ? PROCESSORS_BY_BRAND.Apple
    : values.brand
      ? [...(PROCESSORS_BY_BRAND.Intel || []), ...(PROCESSORS_BY_BRAND.AMD || []), ...(PROCESSORS_BY_BRAND.Qualcomm || [])]
      : ALL_PROCESSORS;

  const handleAddonsChange = (addons: DeviceAddon[]) => update('addons', addons);

  return (
    <div className="space-y-6">
      {/* Section: Device Details */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">{sn}</span>
          <h4 className="font-semibold text-sm">Device Details</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ComboboxField
            label="Brand / Manufacturer"
            value={values.brand}
            onChange={handleBrandChange}
            options={[...BRANDS]}
            placeholder="e.g. Apple, Lenovo, Dell"
            required
          />
          <ComboboxField
            label="Device Model"
            value={values.device_model}
            onChange={(v) => update('device_model', v)}
            options={modelOptions}
            placeholder="e.g. MacBook Pro 14"
            required
            tooltip="Select from list or type a custom model name"
          />
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Qty <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min={1}
              value={values.quantity}
              onChange={(e) => update('quantity', Math.max(1, parseInt(e.target.value) || 1))}
              className="h-10"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <ComboboxField
            label="Processor / Chip"
            value={values.processor}
            onChange={(v) => update('processor', v)}
            options={processorOptions}
            placeholder="e.g. M3 Pro, Intel Core i7-1365U"
            required
            tooltip="Options update based on selected brand"
          />
          <ComboboxField
            label="Display Size"
            value={values.display_size}
            onChange={(v) => update('display_size', v)}
            options={[...DISPLAY_SIZES]}
            placeholder="e.g. 14-inch"
            required
          />
        </div>
      </div>

      {/* Section: Specifications */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">{sn + 1}</span>
          <h4 className="font-semibold text-sm">Specifications</h4>
          <span className="text-xs text-muted-foreground">RAM, storage & add-ons</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              RAM / Unified Memory <span className="text-destructive">*</span>
            </Label>
            <Select value={values.ram} onValueChange={(v) => update('ram', v)}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Select RAM" /></SelectTrigger>
              <SelectContent>
                {RAM_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              SSD Storage <span className="text-destructive">*</span>
            </Label>
            <Select value={values.storage} onValueChange={(v) => update('storage', v)}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Select SSD Storage" /></SelectTrigger>
              <SelectContent>
                {STORAGE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <ComboboxField
            label="Operating System"
            value={values.os}
            onChange={(v) => update('os', v)}
            options={[...OS_OPTIONS]}
            placeholder="e.g. Windows 11 Pro"
          />
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">GPU</Label>
            <Input
              value={values.gpu}
              onChange={(e) => update('gpu', e.target.value)}
              placeholder="e.g. NVIDIA RTX 4060"
              className="h-10"
            />
          </div>
        </div>
      </div>

      {/* Add-ons: inline or dialog trigger */}
      {addonsMode === 'dialog' ? (
        <AddonsDialogButton addons={values.addons} onAddonsChange={handleAddonsChange} />
      ) : (
        <AddonsInline addons={values.addons} onAddonsChange={handleAddonsChange} />
      )}

      {/* Additional Notes */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Additional Notes</Label>
        <Textarea
          value={values.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Any specific requirements, preferences, or instructions for this order..."
          rows={3}
        />
      </div>
    </div>
  );
}

function AddonBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
      {count}
    </span>
  );
}
