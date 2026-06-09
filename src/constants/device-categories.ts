export type DeviceCategory =
  | 'laptop'
  | 'desktop_server'
  | 'monitor'
  | 'headset_audio'
  | 'keyboard'
  | 'mouse'
  | 'furniture'
  | 'other';

export type DeviceSpecFieldKey =
  | 'processor'
  | 'display_size'
  | 'ram'
  | 'storage'
  | 'gpu'
  | 'os'
  | 'color'
  | 'connectivity'
  | 'size_dimensions'
  | 'material'
  | 'spec_description';

export const DEVICE_CATEGORIES: { value: DeviceCategory; label: string }[] = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'desktop_server', label: 'Desktop / Server' },
  { value: 'monitor', label: 'Monitor / Display' },
  { value: 'headset_audio', label: 'Headset / Audio' },
  { value: 'keyboard', label: 'Keyboard' },
  { value: 'mouse', label: 'Mouse / Trackpad' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'other', label: 'Other / Custom' },
];

export const DEVICE_FIELD_LABELS: Record<DeviceSpecFieldKey, { label: string; placeholder: string }> = {
  processor: { label: 'Processor / Chip', placeholder: 'e.g. M3 Pro, Intel Core i7' },
  display_size: { label: 'Screen / Display size', placeholder: 'e.g. 27-inch, 15.6-inch' },
  ram: { label: 'RAM / Memory', placeholder: 'e.g. 16GB, 32GB' },
  storage: { label: 'Storage', placeholder: 'e.g. 512GB SSD, 1TB HDD' },
  gpu: { label: 'GPU / Graphics', placeholder: 'e.g. NVIDIA RTX 4060' },
  os: { label: 'Operating system', placeholder: 'e.g. Windows 11 Pro, macOS' },
  color: { label: 'Color / Finish', placeholder: 'e.g. Black, Silver' },
  connectivity: { label: 'Connectivity', placeholder: 'e.g. USB-C, Bluetooth, Wi-Fi 6' },
  size_dimensions: { label: 'Size / Dimensions', placeholder: 'e.g. 120×60 cm, L-size' },
  material: { label: 'Material', placeholder: 'e.g. Mesh, leather, aluminum' },
  spec_description: { label: 'Description / specs', placeholder: 'Key specs, SKU, or requirements…' },
};

export const DEVICE_CATEGORY_CONFIG: Record<
  DeviceCategory,
  {
    modelLabel: string;
    brandPlaceholder: string;
    modelPlaceholder: string;
    specSubtitle: string;
    fields: DeviceSpecFieldKey[];
    showAddons: boolean;
  }
> = {
  laptop: {
    modelLabel: 'Device model',
    brandPlaceholder: 'e.g. Apple, Dell, HP',
    modelPlaceholder: 'e.g. MacBook Pro 14',
    specSubtitle: 'Processor, memory & storage',
    fields: ['processor', 'display_size', 'ram', 'storage', 'os', 'gpu'],
    showAddons: true,
  },
  desktop_server: {
    modelLabel: 'Model / configuration',
    brandPlaceholder: 'e.g. Dell, HP, Supermicro',
    modelPlaceholder: 'e.g. PowerEdge R750, OptiPlex',
    specSubtitle: 'CPU, memory & storage',
    fields: ['processor', 'ram', 'storage', 'os', 'gpu'],
    showAddons: true,
  },
  monitor: {
    modelLabel: 'Model name',
    brandPlaceholder: 'e.g. Dell, LG, Samsung',
    modelPlaceholder: 'e.g. UltraSharp U2723QE',
    specSubtitle: 'Panel & connectivity',
    fields: ['display_size', 'connectivity', 'color'],
    showAddons: true,
  },
  headset_audio: {
    modelLabel: 'Model name',
    brandPlaceholder: 'e.g. Jabra, Sony, Logitech',
    modelPlaceholder: 'e.g. Evolve2 75',
    specSubtitle: 'Type & connectivity',
    fields: ['connectivity', 'color'],
    showAddons: false,
  },
  keyboard: {
    modelLabel: 'Model name',
    brandPlaceholder: 'e.g. Logitech, Keychron, Apple',
    modelPlaceholder: 'e.g. MX Keys, Magic Keyboard',
    specSubtitle: 'Layout & connectivity',
    fields: ['connectivity', 'color'],
    showAddons: false,
  },
  mouse: {
    modelLabel: 'Model name',
    brandPlaceholder: 'e.g. Logitech, Microsoft, Razer',
    modelPlaceholder: 'e.g. MX Master 3S',
    specSubtitle: 'Type & connectivity',
    fields: ['connectivity', 'color'],
    showAddons: false,
  },
  furniture: {
    modelLabel: 'Product name',
    brandPlaceholder: 'e.g. Herman Miller, IKEA, Steelcase',
    modelPlaceholder: 'e.g. Aeron Chair, BEKANT Desk',
    specSubtitle: 'Size & material',
    fields: ['size_dimensions', 'material', 'color'],
    showAddons: false,
  },
  other: {
    modelLabel: 'Product name',
    brandPlaceholder: 'Brand or supplier',
    modelPlaceholder: 'Model, SKU, or product name',
    specSubtitle: 'Details & custom specs',
    fields: ['spec_description'],
    showAddons: false,
  },
};
