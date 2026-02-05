/**
 * One-time script to create the initial admin user.
 * Requires: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in environment.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node scripts/create-admin.mjs
 *
 * Or add both to .env and run (with dotenv):
 *   node --env-file=.env scripts/create-admin.mjs
 *
 * Get the service role key from: Supabase Dashboard → Project Settings → API → service_role (secret)
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '..', 'package.json'));
const { createClient } = require('@supabase/supabase-js');

// Load .env from project root if present
function loadEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const value = m[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}
loadEnv();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing env. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
  console.error('Get service_role from: Supabase Dashboard → Settings → API');
  process.exit(1);
}

const ADMIN_EMAIL = 'ranjith@remoasset.com';
const ADMIN_PASSWORD = 'Sisacropole2198$';
const ADMIN_NAME = 'Ranjith';

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log('Creating admin user:', ADMIN_EMAIL);

  const { data: user, error: createError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_NAME },
  });

  if (createError) {
    if (createError.message?.includes('already been registered')) {
      console.log('User already exists. Ensuring admin role...');
      const { data: existing } = await supabase.auth.admin.listUsers();
      const existingUser = existing?.users?.find((u) => u.email === ADMIN_EMAIL);
      if (existingUser) {
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ role: 'admin' })
          .eq('user_id', existingUser.id);
        if (updateError) {
          console.error('Failed to set admin role:', updateError.message);
          process.exit(1);
        }
        console.log('Admin role set for existing user.');
        return;
      }
    }
    console.error('Create user error:', createError.message);
    process.exit(1);
  }

  const { error: roleError } = await supabase
    .from('user_roles')
    .update({ role: 'admin' })
    .eq('user_id', user.user.id);

  if (roleError) {
    console.error('Failed to set admin role:', roleError.message);
    process.exit(1);
  }

  console.log('Admin user created successfully.');
  console.log('Login at /auth with:', ADMIN_EMAIL);
}

main();
