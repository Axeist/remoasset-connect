export interface LeadStatusOption {
  id: string;
  name: string;
  color: string;
  sort_order?: number;
}

export interface CountryOption {
  id: string;
  name: string;
  code: string;
}

export interface LeadContact {
  name: string;
  email: string;
  phone: string;
  designation: string;
}

export interface Lead {
  id: string;
  company_name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  contact_designation: string | null;
  additional_contacts?: LeadContact[] | null;
  country_id: string | null;
  country?: { name: string; code: string } | null;
  status_id: string | null;
  status?: { name: string; color: string } | null;
  lead_score: number | null;
  owner_id: string | null;
  owner?: { full_name: string | null } | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadRow extends Lead {
  last_activity_at?: string | null;
}
