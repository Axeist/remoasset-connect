/** ISO 3166-1 alpha-2 → ITU calling code (no plus). */
export const ISO_CALLING_CODES: Record<string, string> = {
  US: '1', CA: '1', PR: '1',
  EG: '20', ZA: '27', GR: '30', NL: '31', BE: '32', FR: '33', ES: '34',
  HU: '36', IT: '39', RO: '40', CH: '41', AT: '43', GB: '44', UK: '44',
  DK: '45', SE: '46', NO: '47', PL: '48', DE: '49',
  PE: '51', MX: '52', AR: '53', BR: '55', CL: '56', CO: '57', VE: '58',
  MY: '60', AU: '61', ID: '62', PH: '63', NZ: '64', SG: '65', TH: '66',
  JP: '81', KR: '82', VN: '84', CN: '86', TR: '90', IN: '91', PK: '92',
  AF: '93', LK: '94', MM: '95', IR: '98',
  SS: '211', MA: '212', DZ: '213', TN: '216', LY: '218', GM: '220',
  SN: '221', MR: '222', ML: '223', GN: '224', CI: '225', BF: '226',
  NE: '227', TG: '228', BJ: '229', MU: '230', LR: '231', SL: '232',
  GH: '233', NG: '234', TD: '235', CF: '236', CM: '237', CV: '238',
  ST: '239', GQ: '240', GA: '241', CG: '242', CD: '243', AO: '244',
  GW: '245', SC: '248', SD: '249', RW: '250', ET: '251', SO: '252',
  DJ: '253', KE: '254', TZ: '255', UG: '256', BI: '257', MZ: '258',
  ZM: '260', MG: '261', RE: '262', ZW: '263', NA: '264', MW: '265',
  LS: '266', BW: '267', SZ: '268', KM: '269', ER: '291', AW: '297',
  FO: '298', GL: '299', GI: '350', PT: '351', LU: '352', IE: '353',
  IS: '354', AL: '355', MT: '356', CY: '357', FI: '358', BG: '359',
  LT: '370', LV: '371', EE: '372', MD: '373', AM: '374', BY: '375',
  AD: '376', MC: '377', SM: '378', UA: '380', RS: '381', ME: '382',
  HR: '385', SI: '386', BA: '387', MK: '389', CZ: '420', SK: '421',
  LI: '423', FK: '500', BZ: '501', GT: '502', SV: '503', HN: '504',
  NI: '505', CR: '506', PA: '507', PM: '508', HT: '509', GP: '590',
  BO: '591', GY: '592', EC: '593', GF: '594', PY: '595', MQ: '596',
  SR: '597', UY: '598', TL: '670', BN: '673', NR: '674', PG: '675',
  TO: '676', SB: '677', VU: '678', FJ: '679', PW: '680', WF: '681',
  CK: '682', NU: '683', WS: '685', KI: '686', NC: '687', TV: '688',
  PF: '689', TK: '690', FM: '691', MH: '692', KP: '850', HK: '852',
  MO: '853', KH: '855', LA: '856', BD: '880', TW: '886', MV: '960',
  LB: '961', JO: '962', SY: '963', IQ: '964', KW: '965', SA: '966',
  YE: '967', OM: '968', PS: '970', AE: '971', IL: '972', BH: '973',
  QA: '974', BT: '975', MN: '976', NP: '977', TJ: '992', TM: '993',
  AZ: '994', GE: '995', KG: '996', UZ: '998',
};

export function digitsOnly(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/[^0-9]/g, '');
}

/**
 * Normalize a phone to E.164 (`+` + digits) for CloudTalk C2C detection.
 * Does not invent a country when iso2 is missing and the number has no +/00 prefix.
 */
export function normalizePhoneE164(
  raw: string | null | undefined,
  iso2?: string | null
): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const international = trimmed.startsWith('+') || trimmed.startsWith('00');
  let digits = digitsOnly(trimmed);
  if (!digits || digits.length < 6) return trimmed;

  if (international) {
    if (digits.length < 8 || digits.length > 15) return trimmed;
    return `+${digits}`;
  }

  const cc = iso2 ? ISO_CALLING_CODES[iso2.toUpperCase()] : undefined;
  if (!cc) {
    if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
    return trimmed;
  }

  if (digits.startsWith(cc) && digits.length > cc.length + 5) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  const combined = `${cc}${digits}`;
  if (combined.length < 8 || combined.length > 15) return trimmed;
  return `+${combined}`;
}

/** Visible E.164 for the CloudTalk Chrome extension (digits stay in the DOM). */
export function toE164Display(raw: string | null | undefined, iso2?: string | null): string {
  if (!raw?.trim()) return '';
  return normalizePhoneE164(raw, iso2) ?? raw.trim();
}

export function cloudtalkDialHref(e164Display: string, fromE164?: string | null): string {
  const dest = toE164Display(e164Display).replace(/\s/g, '');
  if (!dest.startsWith('+')) return `tel:${dest}`;
  if (fromE164) {
    const from = toE164Display(fromE164).replace(/\s/g, '');
    if (from.startsWith('+')) {
      return `ct+tel:${dest}?from=${encodeURIComponent(from)}`;
    }
  }
  return `ct+tel:${dest}`;
}

export function waMeUrl(raw: string | null | undefined): string | null {
  const d = digitsOnly(raw);
  return d ? `https://wa.me/${d}` : null;
}
