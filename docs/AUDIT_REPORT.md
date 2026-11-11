# RemoAsset Connect — End-to-End Platform Audit

**Date:** 11 Nov 2026 · **Commit audited:** `a65f644` · **Scope:** web app (`src/`), Supabase (69 migrations, 21 edge functions), Vercel `api/`, `services/quote-ocr`, `mcp-server/`

Four reviews ran in parallel: Security, UI/UX and frontend, Product and features, and Code quality and testing. Their findings were cross-checked against each other. The most important claims were then checked again directly in the code; those are marked ✔︎.

---

## 1. Executive summary

The product is **broad and mostly wired to real data**: leads, pipeline, tasks, follow-ups, RFQs, clients, pricing, CloudTalk, Slack, Gmail, the AI vendor agent, a public API and the MCP server. It works as an internal tool. It does **not** yet meet industrial SaaS standards, for three reasons:

1. **Security is the blocker.** Live credentials sit in git. Edge functions are open to the internet, one of them is an open email relay on the company domain, and call recordings are in public storage. Role permissions mostly hide UI but are not enforced in the database.
2. **Business logic runs in the browser.** Notifications, reminders, the transfer log and the "Won" rules are written by front-end code. The API, MCP, bulk edit and import skip them, and reminders only fire while someone has a tab open.
3. **The frontend architecture makes the app feel slow.** Every page rebuilds the sidebar and header. The whole app ships as one 3.2 MB file. There is no data caching, and every save puts the screen back into a loading state. Animation polish only works once this foundation is fixed.

### Scorecard

| Area | Score | Headline |
|---|---|---|
| Security | 🔴 2/10 | 3 Critical, 7 High, 11 Medium |
| Feature completeness | 🟡 6/10 | Wide coverage, but notifications, tasks and transfers are only partly done |
| Data integrity | 🟠 4/10 | No audit log, hard deletes, rules enforced client-only, score-reset bug |
| Performance (perceived) | 🟠 4/10 | 3.2 MB bundle, layout remounts, no caching, 3.2 s splash |
| UI consistency & motion | 🟡 5/10 | Good brand base; inconsistent tokens, no reduced-motion, two toast systems |
| Code quality | 🟠 4/10 | 168 type errors, 302 lint errors, strict mode off, 95 ignored DB errors |
| Testing & CI | 🔴 1/10 | 49 unit tests (1 failing), no component, database-security (RLS) or end-to-end tests, no CI |
| Observability | 🔴 0/10 | No error tracking, no error boundary, function failures invisible |

---

## 2. ⚠️ Do these yourself today (I can't do them for you)

These need dashboard or account access. The code fixes in Phase 1 are not enough on their own: as long as these leaked credentials are valid, they bypass every fix.

| # | Action | Why |
|---|---|---|
| A | **Rotate the Supabase service-role key / JWT secret** (Dashboard → Project Settings → API) | `.env` with `SUPABASE_SERVICE_ROLE_KEY` is committed to GitHub ✔︎. That key bypasses all security. |
| B | **Change the Super Admin password** and enable MFA on that account | `scripts/create-admin.mjs` contains it in plain text ✔︎. Check Auth logs for unexpected logins. |
| C | **Check Auth → Providers → "Allow new users to sign up"** | The `@remoasset` domain restriction is checked only in the browser. Anyone can sign up through the API or with any Google account and is automatically given the `procurement_specialist` role. |
| D | **Check the Resend dashboard for unexpected sends** from `outreach@remoasset.in` | The outreach email function has no auth ✔︎. |
| E | After A, update the new key in Vercel, GitHub Actions secrets and Supabase function secrets | — |

Purging `.env` from git history (with `git filter-repo`) rewrites the history everyone has cloned. I'll prepare it, but you decide when to run it.

---

## 3. Findings

### 3.1 Security (verified against the final migration state)

#### Critical

| # | Finding | Evidence |
|---|---|---|
| S1 | Service-role key committed to git | `.env` tracked ✔︎ |
| S2 | **Open email relay.** `vendor-outreach-email` and `approve-outreach-and-create-lead` have no auth. The sender, CC and reply-to are taken from the request body, so anyone can send phishing that passes the company domain's email checks. | `vendor-outreach-email/index.ts:211-252` ✔︎ |
| S3 | Hard-coded Super Admin password in the repo | `scripts/create-admin.mjs:49-50` ✔︎ |

#### High

| # | Finding | Evidence |
|---|---|---|
| S4 | Signup domain check is client-only. Any new user gets an internal role. | `AuthContext.tsx:192-197`, `handle_new_user` trigger |
| S5 | 11 edge functions have **no auth at all** (`verify_jwt=false` everywhere, no check in code), so they are open to anyone on the internet. Affected: `slack-*`, `vendor-discovery*`, `vendor-agent-chat`, `create-vendor-lead`, `enrich-lead`, `mrp-price-lookup`, `google-calendar`. Impact: unlimited AI and search spend, posting into Slack, writing leads as any user. | `config.toml` ✔︎ |
| S6 | `call-recordings` and `activity-files` storage buckets are **public**, so call recordings can be downloaded by anyone | `20260903120000_cloudtalk.sql:279-289` ✔︎ |
| S7 | Lead, client-request and RFQ document buckets are readable **and deletable** by any logged-in user, which bypasses lead-level access rules | `20260205220000_lead_documents.sql:65-71` |
| S8 | **Stored XSS** in the RFQ email log. It renders raw HTML, any user can insert rows, and Google refresh tokens sit in localStorage, so the attack ends in mailbox takeover. | `RfqDetail.tsx:598`, `AuthContext.tsx:33-37` |
| S9 | **RFQ integrity.** Any user can read vendors' magic-link tokens and UPDATE bids, award status and the sealed-until date. | `20260713120000_rfq_campaigns.sql:189-203` ✔︎ |
| S10 | **API keys give unrestricted access.** The expiry date is never checked, there are no scopes, any column is writable (`update(body)`), and the `developer` role can create keys. | `functions/api/index.ts:87-147`, `api-keys/index.ts:28` |
| S11 | An admin can reset the **Super Admin's** password or email, which is account takeover | `manage-user/index.ts:52-170` |

#### Medium

| # | Finding | Evidence |
|---|---|---|
| S12 | Any user can send a notification to any other user, which allows spoofed or phishing notifications | `20260205180000…` (`WITH CHECK (true)`) ✔︎ |
| S13 | The tightened lead-activity insert policy has no effect, because two older permissive policies still apply | — |
| S14 | Clients, client requests, device and warehouse pricing, and call logs are all `USING (true)`, so the `clients.use` / `vendors.use` / `rfq.use` permissions are UI-only | — |
| S15 | The Slack webhook URL can be read by every user (stored in `app_settings`) | — |
| S16 | `country_calling_codes` has RLS disabled, so it can be edited anonymously | — |
| S17 | Any user can fetch any call recording, regardless of which lead it belongs to (an IDOR) | `cloudtalk-recording` |
| S18 | AI agent output is rendered as unescaped HTML, an XSS route via prompt injection | `VendorAgent.tsx:103-109, 249` |
| S19 | No security headers (CSP, HSTS, X-Frame-Options) | `vercel.json` |
| S20 | `rfq-campaign` test-send lets any user send arbitrary HTML to any address | — |
| S21 | quote-ocr accepts every request if its secret is missing. Tokens are accepted in URLs and request bodies. CORS is `*` everywhere. | — |
| S22 | 18 high-severity dependency advisories (react-router, tiptap/prosemirror XSS, lodash, ws) | `npm audit` |

#### Low

- **S23:** Users can delete their own role row.
- **S24:** A user can edit every column of their own profile, which allows CloudTalk call attribution to be hijacked.
- **S25:** Lead and task owners are arbitrary on insert.
- **S26:** Internal error details are returned to callers.
- **S27:** Filter injection in the search used by the API and the Leads page.
- **S28:** "Send reset email" in admin doesn't actually send an email.

**Done well:** roles live in their own table. The database helper functions are hardened (`SECURITY DEFINER` with a fixed `search_path`). Every table but one has RLS. API keys are stored hashed. Gmail bodies are rendered as text. The CloudTalk webhook checks its secret.

### 3.2 Product and feature completeness

| Feature | Status | Key gaps |
|---|---|---|
| Leads list, filters, import | ✅ Complete | Search has no debounce and is open to filter injection |
| Lead create / edit | ⚠️ Partial | **Every edit resets `lead_score` to 0** ✔︎ (`LeadFormDialog.tsx:283`). No "created" activity. Status edits aren't logged and skip the Won rules. |
| Lead transfer | ⚠️ Partial | 3 paths, and only one writes the Transfer Log. None of them is atomic. |
| Pipeline | ✅ Works | Won rules exist only in the browser. They are duplicated in two places, and bulk edit, API, MCP and import bypass them. No stage history. |
| Tasks | ⚠️ Partial | No in-app notice to the assignee. The creator loses sight of a task once it's assigned to someone else. Completing a task ignores errors. No `completed_at` / `created_by`. |
| Follow-ups | ⚠️ Partial | "Recurring" is only a label. No snooze or reschedule. |
| Notifications | ⚠️ Partial | Reminders only fire while a tab is open, and **duplicate on every page change**. Realtime is not enabled in migrations ✔︎. The bell count is capped at the latest 20. Four preference toggles do nothing. No notice for lead created, task assigned, stage change or mentions. |
| Gmail inbox | ⚠️ Partial | Polls from the browser. Google tokens are stored in localStorage. |
| Google Calendar | ⚠️ Partial | Calls Google straight from the browser. The edge function has no caller. |
| Clients & requests | ✅ Complete | Database security is wide open (S14) |
| RFQ campaigns | ✅ / ⚠️ | Reminders are manual. No auto-close at the deadline. No confirmation before sending to real vendors. |
| Vendor discovery / AI agent | ✅ Complete | Unauthenticated (S5). The schedule setting is ignored because the cron time is hard-coded. |
| CloudTalk, Reports, Team Activity | ✅ Complete | — |
| CSM home | ⚠️ Thin | 4 cards. No account health or renewals. |
| Global search | ❌ Stub | Leads only, Enter only. The placeholder promises tasks too. |
| Settings integrations | ⚠️ | HubSpot, Zapier and Teams are "Coming soon" |
| README / docs | ❌ | Still the Lovable boilerplate |
| Dead code | — | `DevicePricing.tsx`, `WarehousePricing.tsx`, `NavLink.tsx`, `GoogleCalendarCard.tsx`, `api/rfq-parse-quotation.ts` |

**Data model:**
- Single-org; there is no `org_id` anywhere.
- No audit log and no soft delete. Lead deletes cascade and destroy the history.
- **Missing indexes** on `leads.owner_id/status_id`, `lead_activities.lead_id`, `tasks.assignee_id/due_date`, `follow_ups.user_id/scheduled_at` and `notifications(user_id, created_at)`. Every security check walks these unindexed columns.

### 3.3 UI/UX and perceived performance

**Why it feels slow** (fix these before adding animation):

1. **`<AppLayout>` is rendered inside 30 pages** ✔︎, so the sidebar, header, realtime channel and pollers all rebuild on every navigation. Page transitions are impossible in this setup, and it causes the duplicate-reminder bug.
2. **There is one 3.18 MB JavaScript file** with no lazy routes ✔︎. Admin, API docs, the rich-text editor, charts and maps all load on first visit.
3. **TanStack Query is installed but used 0 times.** As a result:
   - 52 files fetch data inside `useEffect`.
   - Statuses, countries and profiles are refetched about 100 times across screens.
   - Nothing is cached when you go back to a page.
4. **Every save puts the page back into its full loading state.** After a drag, the pipeline board turns into a skeleton, which undoes the optimistic move.
5. **A forced 3.2-second splash screen on every refresh.**

**Design system:**
- **What's good:** solid tokens (orange `#EA6E35`, warm dark `#30282B`, Manrope and Outfit fonts) and `tailwindcss-animate`.
- **What's missing:**
  - No `prefers-reduced-motion` support.
  - Two keyframe sets that clash.
  - A stagger flicker bug.
  - 615 hard-coded colour classes and 295 hex values.
  - White on orange is 3.1:1, which fails accessibility contrast (AA).
  - Six different page-heading styles.

**UX gaps:**
- **Toasts:** two toast systems, and the active one allows only one toast at a time, so toasts overwrite each other.
- **Deletes:** no Undo anywhere, and activity delete happens on a single click with no confirmation.
- **Navigation:** no ⌘K command palette or keyboard shortcuts, even though `cmdk` is installed.
- **Accessibility:** 49 icon buttons have no label, hover-only actions can't be reached by keyboard or touch, and table rows can't be used from the keyboard.
- **Forms:** several forms show validation errors only as toasts.
- **RFQ:** no unsaved-changes guard and no send confirmation.
- **Lead detail on mobile:** seven tabs squeezed into 375 px.

### 3.4 Code quality, testing and DevOps

- **Type errors:** `tsc` reports **168 errors**. About 70% come from out-of-date generated database types, which cover 10 of 32 tables. Strict mode is off.
- **Lint:** `eslint` reports **302 errors**. 280 are `any` (a symptom of the stale types) and 34 are hook-dependency bugs.
- **Failing test:** `normalizePhoneE164` turns `0044…` into `+0044…`. The code is wrong and the test is right; this breaks CloudTalk click-to-call for those numbers.
- **Error handling:**
  - 95 database calls ignore `error`, so a failure looks like an empty screen.
  - 48 database writes ignore their result.
  - No React error boundary.
- **Duplication:**
  - Edge functions have no shared code: the CORS and auth blocks are copy-pasted 21 times.
  - MRP lookup is implemented twice.
- **Size:** 18 files over 800 lines. `Admin.tsx` is 2,470 lines and `LeadDetail.tsx` is 1,741.
- **Tests:** coverage is `lib/` utilities only. Nothing tests components, database security rules, edge functions or end-to-end flows. The only CI workflow is a cron job.
- **Migrations:** some contain environment-specific `DELETE … WHERE id = '<uuid>'` statements, and there's no proof they apply cleanly to a fresh database.

---

## 4. Remediation plan

Each item lists the team role that owns it: **BE** backend/DB, **FE** frontend, **UX** design, **QA** testing, **DevOps** infrastructure, **PM** product.

### Phase 1: Security lockdown (highest priority)

| # | Work | Owner |
|---|---|---|
| 1.1 | Shared `_shared/` helpers for edge functions: `requireUser(permission)`, `requireCronSecret`, CORS allowlist (`connect.remoasset.in` and localhost), generic errors. Apply to **all 21 functions**. Switch the GitHub cron to a dedicated `CRON_SECRET`. | BE |
| 1.2 | Outreach email: require login and the `vendors.use` permission. Sender, CC and reply-to come from a server-side allowlist only. Clamp AI `max_tokens` and `count`, and allowlist models. | BE |
| 1.3 | Server-side signup domain check (in the `handle_new_user` trigger). New users get **no role** until invited. | BE |
| 1.4 | Make the storage buckets private and serve files through short-lived signed URLs. Scope document access to the lead, and restrict delete to the owner or admin. | BE |
| 1.5 | New RLS migration: enforce `clients.use`, `vendors.use` and `rfq.use`. Lock the RFQ bid/recipient token columns. Notifications insert only for self or via the server. Drop the stale activity policies. Enable RLS on `country_calling_codes`. Split the `user_roles` policies. Restrict profile updates to safe columns. Move secrets out of `app_settings`. | BE |
| 1.6 | API keys: enforce expiry and revocation, per-resource field allowlists, admin-only key creation, rate limiting, audit rows. | BE |
| 1.7 | `manage-user`: protect Super Admin targets, enforce a minimum password length of 10, fix "send reset email". | BE |
| 1.8 | Sanitize HTML with DOMPurify (RFQ email log, Help, RFQ wizard). Render AI output with `react-markdown`, with raw HTML disabled. | FE |
| 1.9 | `vercel.json` security headers (CSP, HSTS, frame-ancestors, nosniff, referrer policy) | DevOps |
| 1.10 | `npm audit fix`, and bump react-router-dom and tiptap. | FE |
| 1.11 | Untrack `.env`, `.vercel` and `supabase/.temp`. Read `create-admin.mjs` credentials from env or a prompt. Add gitleaks to CI. | DevOps |
| 1.12 | quote-ocr: refuse to start without its secret, use constant-time comparison, return generic errors. | BE |

### Phase 2: Foundation (stability and speed)

| # | Work | Owner |
|---|---|---|
| 2.1 | Regenerate the Supabase types, which clears about 120 type errors and many `any` casts. Fix the remaining real type bugs. | FE |
| 2.2 | **Move `AppLayout` into a single layout route** with `<Outlet/>`, and remove it from the 30 pages. | FE |
| 2.3 | **Lazy-load every route**, split vendor chunks (charts, editor, maps, dnd, radix), and lazy-load the heavy widgets. Target first-load JS under 600 KB. | FE |
| 2.4 | Show the splash once per session and close it as soon as auth is ready (800 ms or less). | FE/UX |
| 2.5 | Set up TanStack Query: shared hooks for statuses, countries and profiles, then Leads, Pipeline, Tasks, Follow-ups and Notifications with optimistic mutations. Background refetches never show a skeleton. | FE |
| 2.6 | Use a single toast system, **Sonner** (stacking, promise toasts, Undo action). Keep a compatibility wrapper so the 64 existing call sites still work. | FE |
| 2.7 | Global and per-route error boundaries. A shared `<QueryError retry/>` and `<EmptyState/>`. Handle the ignored `error` cases. | FE |
| 2.8 | Fix the phone normalization bug and the lead-score reset bug. Debounce and escape search. | FE |
| 2.9 | **CI on every PR:** typecheck, lint (with a ratchet so the error count can only go down), tests, build with a size budget, and gitleaks. | DevOps |
| 2.10 | Sentry for the web app and edge functions, tagged with the release version. | DevOps |
| 2.11 | Delete the dead files and `App.css`. Replace the README with real setup and architecture docs. | FE/PM |

### Phase 3: Make the workflows actually work (server-side)

| # | Work | Owner |
|---|---|---|
| 3.1 | **Notifications in the database.** Triggers create notifications for: lead created or assigned, task assigned or completed, stage change, follow-up scheduled. Add notifications to the realtime publication. Compute the bell count with a real count. Add `read_at`. | BE |
| 3.2 | **Server-side reminders.** A pg_cron job every minute finds tasks and follow-ups that are due soon or overdue, with a `notified_at` column to prevent duplicates. This removes the browser poller. | BE |
| 3.3 | A `transfer_lead()` database function (RPC) that is **atomic**: owner change, transfer log, activity and notification together. Used by all 3 UI paths and the API. | BE/FE |
| 3.4 | Enforce stage rules in the database: an `is_won`/`is_lost` flag on statuses, a `lead_stage_history` table, an NDA status column instead of text matching. Validated by trigger. | BE |
| 3.5 | Tasks: `created_by`, `completed_at`, creator visibility, any user can assign (with permission), overdue alert. | BE/FE |
| 3.6 | Follow-ups: real recurrence (interval, next occurrence), snooze and reschedule, `updated_at`. | BE/FE |
| 3.7 | Notification centre v2: click-through links, delete, filters, pagination, "mark all read", "9+" badge cap, and preferences honoured on the server. | FE |
| 3.8 | A generic **audit log** (who, what, before/after for leads, roles, permissions, settings, API keys). Activities become append-only. | BE |
| 3.9 | **Soft delete and restore** for leads, clients and RFQs. | BE/FE |
| 3.10 | Indexes on all the hot foreign-key and filter columns. | BE |
| 3.11 | RFQ: confirmation before a real send, an unsaved-changes guard, scheduled reminders, auto-close at the deadline. | FE/BE |

### Phase 4: "Fast and lively" UI (keeps the current orange/warm-dark theme)

**Approach:**
- **Animation library:** framer-motion (loaded lazily, about 18 KB) for interactions, plus the existing `tailwindcss-animate` for dialogs and menus.
- **Motion tokens:**
  - Durations: 150, 200 and 280 ms.
  - Easing: `cubic-bezier(.22,1,.36,1)`.
  - Spring: "snappy", for quick bounces.
- **Reduced motion:** honoured everywhere. Animation is subtle: no bounces longer than 300 ms and no flashy effects.

| Interaction | Animation |
|---|---|
| Page change | Content fades and rises 6 px (220 ms). The sidebar and header stay still. |
| Sidebar | The active item's highlight pill glides between links. |
| Add lead | The dialog closes, and the new row slides in at the top with a soft orange highlight that fades out. A "Lead created · Open" toast appears. |
| List add/remove (activities, follow-ups, notifications, docs) | Items fade and slide in. Removals collapse smoothly, and the remaining items reflow. |
| Complete a task or follow-up | The checkbox pops, then a strike-through line draws across. The row glides into "Done", and a "Completed · Undo" toast appears. |
| Delete (low-risk items) | The item is removed instantly. An Undo toast stays for 5 s, and the server delete happens after it closes. |
| Notification arrives | The bell wiggles, the badge count rolls and pulses once, and a toast with a "View" link appears. The new item glows briefly. |
| Pipeline drag | The card lifts (slight scale, tilt and shadow) and the target column's count bumps. A rejected drop (Won rules) shakes and springs back. No board reload. |
| Dialogs / sheets | Dialogs scale and fade from the centre (180 ms) instead of sliding from a corner. Sheets open in 260 ms instead of 500 ms. |
| Tabs | A sliding underline, and content cross-fades in the direction you moved. |
| RFQ wizard | Steps slide in the direction you move. The progress rail fills smoothly. |
| Dashboard KPIs | Numbers count up from the previous value. Cards lift on hover. |
| Buttons | Subtle press-down effect. The loading spinner swaps in without the button changing size. |
| Loading | Shimmer skeletons that match the real layout on first load only. A 2 px orange progress bar at the top during background refreshes. |
| Saved inline | A check mark draws next to the edited field. |
| **⌘K command palette** | Search leads, clients, RFQs and pages, and create a new lead or task. Shortcuts: `/` search, `n` new lead, `g l` / `g p` / `g t` to jump to Leads, Pipeline or Tasks, `?` help. |

**UX hygiene in the same phase:**
- Labels on the 49 icon buttons.
- Hover actions also show on keyboard focus and on touch screens.
- Keyboard-navigable table rows.
- Field-level validation for all forms (React Hook Form + zod).
- A scrollable tab bar on mobile.
- An accessible text shade of orange (AA contrast) without changing the brand fill.
- A shared `PageHeader` component and type scale.
- Status colours moved to tokens.

### Phase 5: Test suite (in parallel with Phases 2–4)

The first 20 tests to write:

**Unit**
1. Phone normalization.

**Database security rules (pgTAP)**
2. Lead ownership.
3. Notifications.
4. API-key table lockdown.
5. Permission matrix.
6. `transfer_lead`.

**Edge functions (Deno)**
7. API key accept/reject.
8. Key-management roles.
9. All 21 functions reject anonymous calls.
10. CloudTalk webhook secret and idempotency.
11. RFQ campaign and magic link.
12. User admin blocked for non-admins.

**Components**
13. Lead form validation.
14. Transfer dialog.
15. Auth guard.
16. HTML sanitization.

**End-to-end (Playwright)**
17. Log in → create a lead → appears in the Leads list and Pipeline → activity on the timeline.
18. Create a task → complete it → dashboard count updates.
19. Transfer a lead → the new owner gets a bell notification.
20. RFQ → vendor submits a quote via the magic link → appears in the comparison.

CI also gets a Supabase stage: rebuild a fresh database from the migrations, run the pgTAP tests, and check that the generated types haven't drifted.

### Phase 6: Feature backlog (PM recommendations)

**Should-have**
- Saved views and filters.
- Tags or labels on leads and vendors.
- Bulk actions for everyone (not only admins).
- SLA alerts: lead untouched for N days, RFQ with no bids, client request aging.
- Email digest per user.
- 2FA and a Google Workspace SSO-only mode. Google tokens moved to server-side storage.
- CSM workspace v2: account health and renewals.

**Nice-to-have**
- Email template library.
- Role-based dashboards.
- Team activity feed with @mentions.
- Import/export everywhere.
- Onboarding checklist.
- Data retention and GDPR tools.
- Ship or remove the HubSpot, Zapier and Teams cards.
- `org_id` groundwork if this will ever be sold externally.

---

## 5. Decisions I need from you

1. **Visibility model.** Should every logged-in user see all leads, clients, pricing and RFQs (today's behaviour), or only what their role permits? Phase 1.5 assumes **role-based**.
2. **Signups.** Invite-only (recommended), or keep self-signup for `@remoasset.in` with no role until an admin assigns one?
3. **Database changes.** Phases 1, 3 and 5 add Supabase migrations. I will write and test them locally. **You (or I, with your go-ahead) deploy** them with `supabase db push` and `supabase functions deploy`. Is there a staging Supabase project, or does everything go straight to production?
4. **Scope of the first batch.** Recommended: **Phase 1 + Phase 2** first (security plus foundation), then Phase 3 + 4 together. Phase 4 animations without Phase 2 would just animate a slow app.
5. **Git workflow.** Work on a branch (`audit/phase-1-security`, …) with one PR per phase?
