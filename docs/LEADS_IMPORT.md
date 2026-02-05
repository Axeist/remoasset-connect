# Leads CSV import

Use **Leads** → **Import** to upload a CSV file. The importer accepts the columns below. Headers are flexible: you can use the canonical names or common aliases (e.g. **Vendor Name** → company name, **Contact Mail** → email, **Contact Number** → phone).

## Required

| Column (canonical) | Aliases | Description |
|-------------------|---------|-------------|
| `company_name` | Vendor Name, Company, Name | Company or vendor name. **Required.** |

## Optional (mapped to lead fields)

| Column (canonical) | Aliases | Description |
|-------------------|---------|-------------|
| `country` | Country | Country **name** or **code**. Must match a country in **Admin → Settings → Countries** (e.g. Singapore, India, SG, IN). |
| `website` | Website, URL | Company website URL. |
| `email` | Contact Mail, Contact Email, Email | Contact email. Invalid or placeholder values (e.g. `??????????????????`) will skip the row. |
| `phone` | Contact Number, Contact Phone, Phone | Contact phone. Any format accepted. |
| `contact_name` | Contact Name | Contact person name. |
| `contact_designation` | Contact Designation, Designation | Job title. |
| `status` | Status, Lead Status | Lead status **name**. Must match a status in **Admin → Settings → Lead statuses** (e.g. New, Qualified, Email sent). If missing or unknown, first status is used. |
| `lead_score` | Score, Lead Score | Number 1–100. Default: 50. |
| `lead_owner` | Lead Owner, Owner, Assigned to | **Full name** of the team member who should own the lead. Must match exactly the name in **Admin → Users** (e.g. Ranjith Kirloskar). **If empty, the lead is assigned to you** (the user who is importing—your profile is set as owner). If the name doesn’t match any team member, the lead is also assigned to you. |
| `notes` | Notes, Note | Free-text notes. |
| `followup_stage` | Followup stage, Follow-up stage | Imported into lead **notes** as "Follow-up: &lt;value&gt;" (e.g. No Touch, 2nd follow up). |
| `call_booked` | Call booked | Imported into lead **notes** as "Call: &lt;value&gt;". |

## Tips for your existing spreadsheet

1. **One row per lead** — No merged cells. Flatten so each row has its own Vendor Name and Country.
2. **Country & status** — Add the same country and status names in **Admin → Settings** if they don’t exist yet.
3. **Invalid email** — Rows with placeholder or invalid email (e.g. `??????????????????`) are skipped; fix or remove them before import.
4. **Lead owner** — Use the exact full name as shown in Admin → Users. If the name doesn’t match any team member, the lead is assigned to you (or unassigned if you’re not logged in).
5. **Extra columns** — Columns not listed above are ignored. You can keep "Call booked", "Followup stage", or extra note columns; map them as above or combine into `notes`.

## Sample file

Use `docs/leads-import-sample.csv` as a template. It includes all supported columns and example rows. Copy it, replace with your data, then upload via **Leads** → **Import**.
