# Admin account & creating users

## 1. Create the first admin (ranjith@remoasset.com)

Run the one-time script. It creates the user and sets their role to admin.

**Prerequisites:** Add your Supabase **service role key** to `.env` (do not commit it):

- Supabase Dashboard → **Project Settings** → **API** → copy **service_role** (secret).
- In project root `.env` add:
  - `SUPABASE_SERVICE_ROLE_KEY=your_service_role_key`
  - Ensure `VITE_SUPABASE_URL` is also set (same as for the app).

Then run:

```bash
npm run create-admin
```

This creates:

- **Email:** ranjith@remoasset.com  
- **Password:** Sisacropole2198$  
- **Role:** admin  

If the user already exists (e.g. from a previous run), the script only ensures their role is admin.

**Login:** Go to your app’s `/auth` and sign in with the email and password above.

---

## 2. Allow admins to create more users (including admins)

The **Add user** button in the Admin panel calls a Supabase Edge Function. You need to deploy it once.

### Deploy the Edge Function

1. Install Supabase CLI and log in: [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Link the project (if not already): `supabase link --project-ref YOUR_PROJECT_REF`
3. Set the secret (service role key is used inside the function):

   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

   `SUPABASE_URL` is provided automatically in the function environment.

4. Deploy the functions used by the Admin panel:

   ```bash
   supabase functions deploy create-user
   supabase functions deploy manage-user
   supabase functions deploy api-keys
   ```

   All three use the same `SUPABASE_SERVICE_ROLE_KEY` secret; `SUPABASE_URL` is provided automatically.

After deployment, admins can open **Admin Panel** → **Users** → **Add user**, create/list/manage users, and use the **API** tab to create and revoke API keys.

### If you see 404 or 401 on Admin → API or Users

- **404 on `api-keys`** or **401 on `manage-user`** usually means those Edge Functions are not deployed. Deploy them as above, then reload the Admin panel.
- When using a proxy (e.g. JioBase), ensure your app’s `VITE_SUPABASE_URL` points at the proxy URL so the browser sends the JWT to the same host. In DevTools → Network, check that the failing request has an **Authorization: Bearer …** header; if it’s missing, the proxy or client config may be stripping it.
