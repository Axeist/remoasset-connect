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
import {
  DEVICE_CATEGORIES, DEVICE_CATEGORY_CONFIG, DEVICE_FIELD_LABELS,
  type DeviceCategory, type DeviceSpecFieldKey,
} from '@/constants/device-categories';
import type { CustomSpecField, DeviceAddon } from '@/types/procurement';
import { createEmptyDeviceSpec } from '@/lib/device-spec-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface DeviceSpecValues {
  id: string;
  category: DeviceCategory;
  brand: string;
  device_model: string;
  quantity: number;
  serial_number: string;
  processor: string;
  display_size: string;
  ram: string;
  storage: string;
  gpu: string;
  os: string;
  color: string;
  connectivity: string;
  size_dimensions: string;
  material: string;
  spec_description: string;
  custom_fields: CustomSpecField[];
  addons: DeviceAddon[];
  notes: string;
}

interface DeviceSpecFormProps {
  values: DeviceSpecValues;
  onChange: (values: DeviceSpecValues) => void;
  sectionNumberStart?: number;
  addonsMode?: 'inline' | 'dialog';
  hideNotes?: boolean;
  /** Hide category picker when nested inside multi-device list */
  compactHeader?: boolean;
}

interface MultiDeviceSpecFormProps {
  devices: DeviceSpecValues[];
  onChange: (devices: DeviceSpecValues[]) => void;
  sectionNumberStart?: number;
  hideNotes?: boolean;
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
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-[10px] border-[1.5px] border-input bg-background px-3 py-2 text-sm ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !value && "text-muted-foreground"
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
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

export function DeviceSpecForm({
  values, onChange, sectionNumberStart = 1, addonsMode = 'inline', hideNotes = false, compactHeader = false,
}: DeviceSpecFormProps) {
  const sn = sectionNumberStart;
  const categoryCfg = DEVICE_CATEGORY_CONFIG[values.category];

  const update = <K extends keyof DeviceSpecValues>(key: K, val: DeviceSpecValues[K]) => {
    onChange({ ...values, [key]: val });
  };

  const handleCategoryChange = (category: DeviceCategory) => {
    onChange({ ...values, category });
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

  const addCustomField = () => {
    update('custom_fields', [...values.custom_fields, { label: '', value: '' }]);
  };

  const updateCustomField = (idx: number, field: keyof CustomSpecField, val: string) => {
    update(
      'custom_fields',
      values.custom_fields.map((f, i) => (i === idx ? { ...f, [field]: val } : f)),
    );
  };

  const removeCustomField = (idx: number) => {
    update('custom_fields', values.custom_fields.filter((_, i) => i !== idx));
  };

  const renderSpecField = (fieldKey: DeviceSpecFieldKey) => {
    const meta = DEVICE_FIELD_LABELS[fieldKey];
    const val = values[fieldKey];

    if (fieldKey === 'ram') {
      return (
        <div key={fieldKey} className="space-y-1.5">
          <Label className="text-sm font-medium">{meta.label}</Label>
          <Select value={val} onValueChange={(v) => update('ram', v)}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Select RAM" /></SelectTrigger>
            <SelectContent>
              {RAM_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (fieldKey === 'storage') {
      return (
        <div key={fieldKey} className="space-y-1.5">
          <Label className="text-sm font-medium">{meta.label}</Label>
          <Select value={val} onValueChange={(v) => update('storage', v)}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Select storage" /></SelectTrigger>
            <SelectContent>
              {STORAGE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (fieldKey === 'processor') {
      return (
        <ComboboxField
          key={fieldKey}
          label={meta.label}
          value={val}
          onChange={(v) => update('processor', v)}
          options={processorOptions}
          placeholder={meta.placeholder}
          tooltip="Options update based on selected brand"
        />
      );
    }

    if (fieldKey === 'display_size') {
      return (
        <ComboboxField
          key={fieldKey}
          label={meta.label}
          value={val}
          onChange={(v) => update('display_size', v)}
          options={[...DISPLAY_SIZES]}
          placeholder={meta.placeholder}
        />
      );
    }

    if (fieldKey === 'os') {
      return (
        <ComboboxField
          key={fieldKey}
          label={meta.label}
          value={val}
          onChange={(v) => update('os', v)}
          options={[...OS_OPTIONS]}
          placeholder={meta.placeholder}
        />
      );
    }

    if (fieldKey === 'spec_description') {
      return (
        <div key={fieldKey} className="space-y-1.5 md:col-span-2">
          <Label className="text-sm font-medium">{meta.label}</Label>
          <Textarea
            value={val}
            onChange={(e) => update('spec_description', e.target.value)}
            placeholder={meta.placeholder}
            rows={3}
            className="text-sm resize-y"
          />
        </div>
      );
    }

    return (
      <div key={fieldKey} className="space-y-1.5">
        <Label className="text-sm font-medium">{meta.label}</Label>
        <Input
          value={val}
          onChange={(e) => update(fieldKey as 'color' | 'connectivity' | 'size_dimensions' | 'material' | 'gpu', e.target.value)}
          placeholder={meta.placeholder}
          className="h-10"
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {!compactHeader && (
        <div>
          <SectionHeader number={sn} title="Device type & identity" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Device category <span className="text-destructive">*</span>
              </Label>
              <Select value={values.category} onValueChange={(v) => handleCategoryChange(v as DeviceCategory)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {DEVICE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Serial number</Label>
              <Input
                value={values.serial_number}
                onChange={(e) => update('serial_number', e.target.value)}
                placeholder="Device serial / asset tag (optional)"
                className="h-10"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        {compactHeader ? (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Select value={values.category} onValueChange={(v) => handleCategoryChange(v as DeviceCategory)}>
              <SelectTrigger className="h-9 w-[min(100%,220px)] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEVICE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <SectionHeader number={sn + 1} title="Product details" />
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ComboboxField
            label="Brand / Manufacturer"
            value={values.brand}
            onChange={handleBrandChange}
            options={[...BRANDS]}
            placeholder={categoryCfg.brandPlaceholder}
            required
          />
          <ComboboxField
            label={categoryCfg.modelLabel}
            value={values.device_model}
            onChange={(v) => update('device_model', v)}
            options={values.category === 'laptop' || values.category === 'desktop_server' ? modelOptions : []}
            placeholder={categoryCfg.modelPlaceholder}
            required
            tooltip="Select from list or type a custom name"
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
        {compactHeader && (
          <div className="mt-4 max-w-md">
            <Label className="text-sm font-medium">Serial number</Label>
            <Input
              value={values.serial_number}
              onChange={(e) => update('serial_number', e.target.value)}
              placeholder="Optional"
              className="h-9 text-sm mt-1.5"
            />
          </div>
        )}
      </div>

      {categoryCfg.fields.length > 0 && (
        <div>
          <SectionHeader number={sn + 2} title="Specifications" subtitle={categoryCfg.specSubtitle} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryCfg.fields.map((fieldKey) => renderSpecField(fieldKey))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">Custom fields</Label>
          <Button type="button" variant="outline" size="sm" onClick={addCustomField} className="gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" /> Add field
          </Button>
        </div>
        {values.custom_fields.length === 0 ? (
          <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center">
            Add any extra specs — warranty, SKU, cable type, desk height, etc.
          </p>
        ) : (
          <div className="space-y-2">
            {values.custom_fields.map((field, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Label</Label>
                  <Input
                    value={field.label}
                    onChange={(e) => updateCustomField(idx, 'label', e.target.value)}
                    placeholder="e.g. Warranty, SKU"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Value</Label>
                  <Input
                    value={field.value}
                    onChange={(e) => updateCustomField(idx, 'value', e.target.value)}
                    placeholder="Value"
                    className="h-9 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => removeCustomField(idx)}
                  aria-label="Remove custom field"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {categoryCfg.showAddons && (
        addonsMode === 'dialog' ? (
          <AddonsDialogButton addons={values.addons} onAddonsChange={handleAddonsChange} />
        ) : (
          <AddonsInline addons={values.addons} onAddonsChange={handleAddonsChange} />
        )
      )}

      {!hideNotes && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Additional notes</Label>
          <Textarea
            value={values.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Any specific requirements, preferences, or instructions…"
            rows={3}
          />
        </div>
      )}
    </div>
  );
}

export function MultiDeviceSpecForm({
  devices, onChange, sectionNumberStart = 2, hideNotes = false,
}: MultiDeviceSpecFormProps) {
  const updateDevice = (index: number, next: DeviceSpecValues) => {
    onChange(devices.map((d, i) => (i === index ? next : d)));
  };

  const removeDevice = (index: number) => {
    if (devices.length <= 1) return;
    onChange(devices.filter((_, i) => i !== index));
  };

  const addDevice = () => {
    onChange([...devices, createEmptyDeviceSpec('other')]);
  };

  return (
    <div className="space-y-4">
      {devices.map((device, index) => (
        <div key={device.id} className="rounded-xl border border-border/80 bg-card/30 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                {index + 1}
              </span>
              <span className="text-sm font-semibold truncate">
                {device.brand || device.device_model
                  ? `${device.brand} ${device.device_model}`.trim()
                  : `Device ${index + 1}`}
              </span>
            </div>
            {devices.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeDevice(index)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
            )}
          </div>
          <div className="p-4">
            <DeviceSpecForm
              values={device}
              onChange={(v) => updateDevice(index, v)}
              sectionNumberStart={sectionNumberStart}
              hideNotes={hideNotes}
              compactHeader
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addDevice} className="w-full gap-2 border-dashed">
        <Plus className="h-4 w-4" />
        Add another device
      </Button>
    </div>
  );
}

export function SectionHeader({ number, title, subtitle }: { number: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">{number}</span>
      <h4 className="font-semibold text-sm">{title}</h4>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
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
