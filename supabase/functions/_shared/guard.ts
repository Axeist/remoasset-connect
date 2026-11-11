// Shared authentication/authorization guard for edge functions.
//
// Every function in config.toml runs with verify_jwt = false, so each handler
// MUST call requireCaller() itself. Callers are either:
//   - a signed-in user (Supabase JWT in the Authorization header), optionally
//     required to hold one of the given permissions, or
//   - a trusted server (cron / another edge function), identified by the service
//     role key or the dedicated CRON_SECRET (x-cron-secret header).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

export type Caller =
  | { kind: 'service' }
  | { kind: 'user'; userId: string; email: string | null }

export interface GuardOptions {
  /** Which kinds of callers may use this function. */
  allow: Array<'user' | 'service'>
  /** For users: must hold at least one of these permissions (via has_permission). */
  permissions?: string[]
}

const encoder = new TextEncoder()

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a)
  const y = encoder.encode(b)
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

function deny(status: number, message: string, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export async function requireCaller(
  req: Request,
  corsHeaders: Record<string, string>,
  opts: GuardOptions,
): Promise<{ caller: Caller } | { response: Response }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const cronHeader = (req.headers.get('x-cron-secret') ?? '').trim()

  // Trusted server-to-server caller.
  if (opts.allow.includes('service')) {
    if (serviceKey && token && safeEqual(token, serviceKey)) return { caller: { kind: 'service' } }
    if (cronSecret && cronHeader && safeEqual(cronHeader, cronSecret)) return { caller: { kind: 'service' } }
  }

  if (!opts.allow.includes('user')) return { response: deny(401, 'Unauthorized', corsHeaders) }
  if (!token) return { response: deny(401, 'Missing bearer token', corsHeaders) }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return { response: deny(401, 'Invalid or expired session', corsHeaders) }

  const userId = data.user.id
  if (opts.permissions?.length) {
    let allowed = false
    for (const permission of opts.permissions) {
      const { data: ok, error: rpcError } = await admin.rpc('has_permission', {
        _user_id: userId,
        _permission: permission,
      })
      if (!rpcError && ok === true) {
        allowed = true
        break
      }
    }
    if (!allowed) return { response: deny(403, 'Forbidden', corsHeaders) }
  }

  return { caller: { kind: 'user', userId, email: data.user.email ?? null } }
}

const ALLOWED_MAIL_DOMAINS = ['remoasset.in', 'remoasset.com']

/** True when the address belongs to a RemoAsset-owned domain. */
export function isCompanyEmail(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const m = value.trim().toLowerCase().match(/^[^\s@<>,;]+@([a-z0-9.-]+)$/)
  return !!m && ALLOWED_MAIL_DOMAINS.includes(m[1])
}

const ALLOWED_AI_MODELS = new Set([
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
])

/** Clamp client-supplied AI parameters so callers cannot inflate spend. */
export function clampAi(model: unknown, maxTokens: unknown, fallbackModel = 'claude-haiku-4-5-20251001') {
  const m = typeof model === 'string' && ALLOWED_AI_MODELS.has(model) ? model : fallbackModel
  const t = Math.min(Math.max(Number(maxTokens) || 2048, 256), 4096)
  return { model: m, maxTokens: t }
}
