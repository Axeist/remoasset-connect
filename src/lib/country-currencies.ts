/** ISO 3166-1 alpha-2 → ISO 4217 (defaults for warehouse pricing input) */
export const COUNTRY_CODE_TO_CURRENCY: Record<string, string> = {
  US: 'USD', CA: 'CAD', MX: 'MXN', GB: 'GBP', UK: 'GBP',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR',
  IE: 'EUR', PT: 'EUR', GR: 'EUR', FI: 'EUR', LU: 'EUR', MT: 'EUR', CY: 'EUR',
  EE: 'EUR', LV: 'EUR', LT: 'EUR', SK: 'EUR', SI: 'EUR', HR: 'EUR',
  PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN', SE: 'SEK', NO: 'NOK',
  DK: 'DKK', CH: 'CHF', IS: 'ISK', UA: 'UAH', RS: 'RSD', MK: 'MKD', AL: 'ALL',
  AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', KR: 'KRW', IN: 'INR', SG: 'SGD',
  HK: 'HKD', TW: 'TWD', TH: 'THB', MY: 'MYR', ID: 'IDR', PH: 'PHP', VN: 'VND',
  BD: 'BDT', PK: 'PKR', LK: 'LKR', NP: 'NPR', MM: 'MMK', KH: 'KHR', LA: 'LAK',
  BN: 'BND', MO: 'MOP', EG: 'EGP', AE: 'AED', SA: 'SAR', QA: 'QAR', BH: 'BHD',
  KW: 'KWD', OM: 'OMR', JO: 'JOD', LB: 'LBP', IL: 'ILS', TR: 'TRY', IQ: 'IQD',
  IR: 'IRR', YE: 'YER', MA: 'MAD', TN: 'TND', DZ: 'DZD', LY: 'LYD',
  ZA: 'ZAR', KE: 'KES', NG: 'NGN', BW: 'BWP', BR: 'BRL', AR: 'ARS', CL: 'CLP',
  CO: 'COP', PE: 'PEN', EC: 'USD', UY: 'UYU', CR: 'CRC', PA: 'PAB', GT: 'GTQ',
  RU: 'RUB', GE: 'GEL', AM: 'AMD', PR: 'USD', JM: 'JMD', TT: 'TTD', BS: 'BSD',
};

export function defaultCurrencyForCountryCode(code: string | null | undefined): string {
  if (!code) return 'USD';
  const c = code.toUpperCase();
  return COUNTRY_CODE_TO_CURRENCY[c] || 'USD';
}

export const FX_CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EGP', label: 'EGP — Egyptian Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'CNY', label: 'CNY — Chinese Yuan' },
  { value: 'KRW', label: 'KRW — Korean Won' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'MXN', label: 'MXN — Mexican Peso' },
  { value: 'BRL', label: 'BRL — Brazilian Real' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'TRY', label: 'TRY — Turkish Lira' },
  { value: 'CHF', label: 'CHF — Swiss Franc' },
  { value: 'SEK', label: 'SEK — Swedish Krona' },
  { value: 'NOK', label: 'NOK — Norwegian Krone' },
  { value: 'DKK', label: 'DKK — Danish Krone' },
  { value: 'PLN', label: 'PLN — Polish Złoty' },
  { value: 'QAR', label: 'QAR — Qatari Riyal' },
  { value: 'KWD', label: 'KWD — Kuwaiti Dinar' },
  { value: 'BHD', label: 'BHD — Bahraini Dinar' },
  { value: 'ILS', label: 'ILS — Israeli Shekel' },
];
