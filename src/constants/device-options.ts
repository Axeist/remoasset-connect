export const BRANDS = [
  'Apple', 'Lenovo', 'Dell', 'HP', 'Asus', 'Acer', 'Microsoft',
  'Samsung', 'LG', 'Razer', 'Framework', 'MSI', 'Huawei', 'Toshiba',
  'Fujitsu', 'Panasonic', 'Google',
] as const;

export const MODELS_BY_BRAND: Record<string, string[]> = {
  Apple: [
    'MacBook Pro 14', 'MacBook Pro 16', 'MacBook Air 13', 'MacBook Air 15',
    'Mac Mini', 'Mac Studio', 'Mac Pro', 'iMac 24',
  ],
  Lenovo: [
    'ThinkPad X1 Carbon Gen 12', 'ThinkPad X1 Yoga Gen 9', 'ThinkPad T14s Gen 6',
    'ThinkPad T14 Gen 6', 'ThinkPad T16 Gen 3', 'ThinkPad L14 Gen 5',
    'ThinkPad L16 Gen 1', 'ThinkPad E14 Gen 6', 'ThinkPad E16 Gen 2',
    'ThinkPad P14s Gen 5', 'ThinkPad P16s Gen 3', 'ThinkBook 14 Gen 7',
    'ThinkBook 16 Gen 7', 'IdeaPad Slim 5', 'IdeaPad Pro 5',
    'Legion Pro 5', 'Legion Slim 5', 'Yoga Slim 7',
  ],
  Dell: [
    'Latitude 5450', 'Latitude 5550', 'Latitude 7450', 'Latitude 7350',
    'Latitude 9450', 'Latitude 5350', 'Precision 3490', 'Precision 5490',
    'Precision 5690', 'Precision 7680', 'Precision 7780',
    'XPS 13', 'XPS 14', 'XPS 15', 'XPS 16',
    'Inspiron 14', 'Inspiron 15', 'Inspiron 16',
    'Vostro 14', 'Vostro 15', 'Vostro 16',
  ],
  HP: [
    'EliteBook 640 G11', 'EliteBook 660 G11', 'EliteBook 840 G11',
    'EliteBook 860 G11', 'EliteBook 1040 G11', 'EliteBook Ultra G1i',
    'ProBook 440 G11', 'ProBook 450 G11', 'ProBook 460 G11',
    'ZBook Firefly 14 G11', 'ZBook Firefly 16 G11', 'ZBook Studio G11',
    'ZBook Power G11', 'ZBook Fury G11',
    'Pavilion 14', 'Pavilion 15', 'Pavilion 16',
    'Spectre x360 14', 'Spectre x360 16', 'Envy x360 14', 'Envy x360 16',
  ],
  Asus: [
    'ExpertBook B5 B5404', 'ExpertBook B9 B9403', 'ExpertBook B3 B3404',
    'ZenBook 14 UX3405', 'ZenBook Pro 14 UX6404', 'ZenBook S 14',
    'ProArt Studiobook 16', 'VivoBook S 14', 'VivoBook S 15',
    'ROG Zephyrus G14', 'ROG Zephyrus G16', 'TUF Gaming A15', 'TUF Gaming A16',
  ],
  Acer: [
    'TravelMate P4 14', 'TravelMate P4 16', 'TravelMate P6 14',
    'Swift Go 14', 'Swift X 14', 'Swift Edge 16',
    'Aspire 14', 'Aspire 15', 'Aspire Vero 16',
    'Predator Helios 16', 'Nitro V 15', 'Nitro V 16',
  ],
  Microsoft: [
    'Surface Laptop 7', 'Surface Laptop Studio 2', 'Surface Laptop Go 3',
    'Surface Pro 11', 'Surface Go 4',
  ],
  Samsung: [
    'Galaxy Book4 Pro', 'Galaxy Book4 Pro 360', 'Galaxy Book4 Ultra',
    'Galaxy Book4', 'Galaxy Book4 360',
  ],
  LG: ['Gram 14', 'Gram 15', 'Gram 16', 'Gram 17', 'Gram Pro 16'],
  Razer: ['Blade 14', 'Blade 15', 'Blade 16', 'Blade 18'],
  Framework: ['Laptop 16', 'Laptop 13'],
  MSI: [
    'Prestige 14', 'Prestige 16', 'Modern 14', 'Modern 15',
    'Creator Z16', 'Stealth 16', 'Raider GE78',
  ],
  Huawei: ['MateBook X Pro', 'MateBook 14s', 'MateBook D 14', 'MateBook D 16'],
  Toshiba: ['Dynabook Portege X30L', 'Dynabook Tecra A40', 'Dynabook Tecra A50'],
  Fujitsu: ['Lifebook U7413', 'Lifebook U9313', 'Lifebook E5413'],
  Panasonic: ['Toughbook 40', 'Toughbook 55', 'Toughbook G2'],
  Google: ['Pixelbook Go', 'Chromebook Plus'],
};

export const PROCESSORS_BY_BRAND: Record<string, string[]> = {
  Apple: [
    'M4', 'M4 Pro', 'M4 Max', 'M4 Ultra',
    'M3', 'M3 Pro', 'M3 Max', 'M3 Ultra',
    'M2', 'M2 Pro', 'M2 Max', 'M2 Ultra',
  ],
  Intel: [
    'Core Ultra 9 285H', 'Core Ultra 7 265H', 'Core Ultra 7 255H',
    'Core Ultra 5 245H', 'Core Ultra 5 235H',
    'Core Ultra 9 185H', 'Core Ultra 7 165H', 'Core Ultra 7 155H',
    'Core Ultra 5 135H', 'Core Ultra 5 125H',
    'Core i9-14900HX', 'Core i7-14700HX', 'Core i7-1365U',
    'Core i5-1345U', 'Core i5-1335U', 'Core i3-1315U',
  ],
  AMD: [
    'Ryzen AI 9 HX 370', 'Ryzen AI 9 365', 'Ryzen AI 7 350',
    'Ryzen 9 8945HX', 'Ryzen 9 7945HX', 'Ryzen 7 8845HS',
    'Ryzen 7 8840U', 'Ryzen 7 7840U', 'Ryzen 5 8640U',
    'Ryzen 5 7640U', 'Ryzen 5 7530U',
  ],
  Qualcomm: [
    'Snapdragon X Elite X1E-84-100', 'Snapdragon X Elite X1E-80-100',
    'Snapdragon X Plus X1P-64-100', 'Snapdragon X Plus X1P-46-100',
  ],
};

export const ALL_PROCESSORS = [
  ...PROCESSORS_BY_BRAND.Apple,
  ...PROCESSORS_BY_BRAND.Intel,
  ...PROCESSORS_BY_BRAND.AMD,
  ...PROCESSORS_BY_BRAND.Qualcomm,
];

export const DISPLAY_SIZES = [
  '11.6-inch', '12.3-inch', '13.3-inch', '13.4-inch', '13.6-inch',
  '14-inch', '14.2-inch', '15-inch', '15.3-inch', '15.6-inch',
  '16-inch', '16.2-inch', '17-inch', '17.3-inch',
] as const;

export const RAM_OPTIONS = [
  '4GB', '8GB', '12GB', '16GB', '18GB', '24GB',
  '32GB', '36GB', '48GB', '64GB', '96GB', '128GB',
] as const;

export const STORAGE_OPTIONS = [
  '128GB SSD', '256GB SSD', '512GB SSD', '1TB SSD',
  '2TB SSD', '4TB SSD', '8TB SSD',
] as const;

export const ADDON_TYPES = [
  'Mouse', 'Keyboard', 'Monitor / Display', 'Headphones / Earphones',
  'USB Hub', 'Docking Station', 'Laptop Bag / Case', 'Webcam',
  'External Storage', 'Power Bank', 'Cable / Adapter', 'Printer', 'Others',
] as const;

export const OS_OPTIONS = [
  'Windows 11 Pro', 'Windows 11 Home', 'Windows 11 Enterprise',
  'macOS Sequoia', 'macOS Sonoma', 'macOS Ventura',
  'Ubuntu 24.04 LTS', 'Ubuntu 22.04 LTS', 'Fedora 40',
  'Chrome OS', 'Chrome OS Flex', 'No OS',
] as const;

export const CLIENT_REQUEST_STATUSES: { value: string; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: '#F59E0B' },
  { value: 'vendor_allocated', label: 'Vendor Allocated', color: '#8B5CF6' },
  { value: 'ordered', label: 'Ordered', color: '#3B82F6' },
  { value: 'in_transit', label: 'In Transit', color: '#6366F1' },
  { value: 'fulfilled', label: 'Fulfilled', color: '#10B981' },
  { value: 'cancelled', label: 'Cancelled', color: '#EF4444' },
];
