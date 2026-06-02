export const VENDOR_TYPE_VALUES = [
  'new_device',
  'refurbished',
  'rental',
  'warehouse',
  'itad',
] as const;

export type VendorType = (typeof VENDOR_TYPE_VALUES)[number];

export const VENDOR_TYPE_OPTIONS: { value: VendorType; label: string }[] = [
  { value: 'new_device', label: 'New Device' },
  { value: 'refurbished', label: 'Refurbished' },
  { value: 'rental', label: 'Rental' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'itad', label: 'ITAD (IT Asset Disposal)' },
];

export function formatVendorTypeLabel(value: string): string {
  return VENDOR_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ');
}
