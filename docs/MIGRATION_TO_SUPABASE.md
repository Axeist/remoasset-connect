# Migrating from Lovable Cloud to Your Own Supabase

This app already uses Supabase for auth and data. These steps switch it from the Lovable-created Supabase project to **your own** Supabase project.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. **New project** → choose org, name, database password, region.
3. Wait for the project to be ready.

## 2. Apply the database schema (migrations)

You can do either **A** (Dashboard) or **B** (CLI).

### Option A: Run SQL in Supabase Dashboard

1. In your project: **SQL Editor** → **New query**.
2. Copy the contents of:
   ```
   supabase/migrations/20260205144637_6c15e2f8-0411-4e4a-854f-82a8bec61c80.sql
   ```
3. Paste into the editor and **Run**.  
   This creates tables, RLS policies, triggers, and seed data (countries, lead statuses).

### Option B: Use Supabase CLI

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) if needed.
2. In the project root:
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   (`YOUR_PROJECT_REF` is in Dashboard → **Settings** → **General** → Reference ID.)
3. Push migrations:
   ```bash
   npx supabase db push
   ```

## 3. Point the app at your project

1. In Supabase Dashboard: **Settings** → **API**.
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
3. In this repo, create or update `.env` (see `.env.example`):

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_public_key
   ```

4. Restart the dev server so Vite picks up the new env.

## 4. (Optional) Migrate existing data from Lovable’s Supabase

If you have important data in the **Lovable** Supabase project:

1. In the **Lovable** project (old): **Table Editor** or **SQL Editor** → export or copy data from:
   - `profiles`, `user_roles`, `leads`, `lead_activities`, `tasks`, `follow_ups`, `notifications`, etc.
2. In **your** Supabase project: use **SQL Editor** or **Table Editor** to insert that data, keeping UUIDs and `auth.users` in mind:
   - Users must exist in **Authentication** first; then you can insert into `profiles` and `user_roles` with the same `user_id`.
   - For tables that reference `auth.users`, ensure those user IDs exist in the new project’s `auth.users` (e.g. re-create users or import via Supabase Auth if needed).

If you only need schema and seed data (countries, lead statuses), skip this step; the migration file already seeds those.

## 5. (Optional) Link local Supabase config to your project

If you use Supabase CLI for migrations or local dev:

- Either run:
  ```bash
  npx supabase link --project-ref YOUR_PROJECT_REF
  ```
  (this updates `supabase/config.toml`),  
- Or edit `supabase/config.toml` and set:
  ```toml
  project_id = "YOUR_PROJECT_REF"
  ```

## Deploying to Vercel

Set these **Environment Variables** in your Vercel project (Settings → Environment Variables) so the deployed app uses your Supabase project:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://snashlomudlvooanyqwt.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon (public) key from Dashboard → Settings → API |

Add them for **Production**, **Preview**, and **Development** if you use Vercel preview deployments. Redeploy after saving so the build picks up the new variables.

## Summary

| Step | Action |
|------|--------|
| 1 | Create project at supabase.com |
| 2 | Run migration SQL (Dashboard or `supabase db push`) |
| 3 | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (and on Vercel) |
| 4 | (Optional) Export/import data from Lovable project |
| 5 | (Optional) Link CLI via `supabase link` or `config.toml` |

After this, the app uses your Supabase project instead of Lovable’s.
