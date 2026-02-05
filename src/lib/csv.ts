/**
 * Parse a CSV string into rows of string arrays.
 * Handles quoted fields (with commas and newlines inside quotes).
 */
export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',' || c === '\t') {
      row.push(field.trim());
      field = '';
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && next === '\n') i++;
      row.push(field.trim());
      field = '';
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += c;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

/** Normalize CSV header to our canonical field name (case-insensitive, strip spaces) */
const HEADER_ALIASES: Record<string, string> = {
  company_name: 'company_name',
  company: 'company_name',
  'vendor name': 'company_name',
  vendorname: 'company_name',
  name: 'company_name',
  country: 'country',
  'country name': 'country',
  website: 'website',
  url: 'website',
  email: 'email',
  'contact mail': 'email',
  contactmail: 'email',
  'contact email': 'email',
  phone: 'phone',
  'contact number': 'phone',
  contactnumber: 'phone',
  'contact phone': 'phone',
  contact_name: 'contact_name',
  'contact name': 'contact_name',
  contactname: 'contact_name',
  contact_designation: 'contact_designation',
  'contact designation': 'contact_designation',
  designation: 'contact_designation',
  status: 'status',
  'lead status': 'status',
  lead_score: 'lead_score',
  score: 'lead_score',
  'lead score': 'lead_score',
  notes: 'notes',
  note: 'notes',
  'followup stage': 'followup_stage',
  followup_stage: 'followup_stage',
  'follow-up stage': 'followup_stage',
  'call booked': 'call_booked',
  call_booked: 'call_booked',
  lead_owner: 'lead_owner',
  'lead owner': 'lead_owner',
  owner: 'lead_owner',
  'assigned to': 'lead_owner',
};

export function normalizeHeader(header: string): string {
  const key = header.trim().toLowerCase().replace(/\s+/g, ' ');
  return HEADER_ALIASES[key] ?? header.trim().toLowerCase().replace(/\s+/g, '_');
}
