import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Trash2, Plus, ChevronDown, ChevronUp, HelpCircle, Search } from 'lucide-react';
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
          <ScrollArea className="max-h-[240px]">
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

export function DeviceSpecForm({ values, onChange, sectionNumberStart = 1 }: DeviceSpecFormProps) {
  const [addonsOpen, setAddonsOpen] = useState(true);
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

  const addAddon = () => {
    update('addons', [...values.addons, { type: '', model: '', qty: 1 }]);
  };

  const updateAddon = (idx: number, field: keyof DeviceAddon, val: string | number) => {
    const next = values.addons.map((a, i) => i === idx ? { ...a, [field]: val } : a);
    update('addons', next);
  };

  const removeAddon = (idx: number) => {
    update('addons', values.addons.filter((_, i) => i !== idx));
  };

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

      {/* Section: Add-ons */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => setAddonsOpen(!addonsOpen)}
          className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 rounded-t-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Add-ons</span>
            <AddonBadge count={values.addons.length} />
          </div>
          {addonsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {addonsOpen && (
          <div className="px-4 pb-4 space-y-3">
            {values.addons.map((addon, idx) => (
              <div key={idx} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">#{idx + 1} {addon.type || 'New Add-on'}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAddon(idx)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Addon Type <span className="text-destructive">*</span></Label>
                    <Select value={addon.type} onValueChange={(v) => updateAddon(idx, 'type', v)}>
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
                      onChange={(e) => updateAddon(idx, 'model', e.target.value)}
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
                      onChange={(e) => updateAddon(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addAddon} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add add-on
            </Button>
          </div>
        )}
      </div>

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
