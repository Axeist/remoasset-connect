import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { SplashScreen } from '@/components/SplashScreen';
import { BrandLogo } from '@/components/BrandLogo';
import {
  Loader2, Eye, EyeOff, ArrowLeft, ArrowRight, Sun, Moon, Lock, Mail, ShieldCheck,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { getPostLoginPath } from '@/lib/cookie-consent';
import { toggleThemeWithReveal } from '@/lib/theme-transition';

const OAUTH_PENDING_KEY = 'remoasset:oauth-pending';

// Kept for the password-setup screens (invite acceptance and reset).
export const PASSWORD_REQUIREMENTS = [
  'At least 8 characters',
  'One uppercase letter',
  'One lowercase letter',
  'One number',
  'One special character (!@#$%^&* etc.)',
];

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

type View = 'signin' | 'forgot' | 'sent';

function useCountUp(target: number, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** A live mini pipeline: a lead card glides from stage to stage. Scales with its container. */
function HeroBoard({ chips = true }: { chips?: boolean }) {
  return (
    <div className="hb" aria-hidden="true">
      <div className="hb-card">
        <div className="hb-top">
          <span className="hb-title">My pipeline</span>
          <span className="hb-dots"><i /><i /><i /></span>
        </div>
        <div className="hb-board">
          <div className="hb-col"><h5>Qualified <span>3</span></h5><div className="hb-ph" /><div className="hb-ph s" /><div className="hb-ph" /></div>
          <div className="hb-col"><h5>NDA sent <span>2</span></h5><div className="hb-ph s" /><div className="hb-ph" /></div>
          <div className="hb-col"><h5>Won <span>5</span></h5><div className="hb-ph" /><div className="hb-ph s" /></div>
          <div className="hb-mover"><div>Acme Devices<small>United Kingdom</small></div></div>
        </div>
      </div>
      {chips && (
        <>
          <div className="hb-chip" style={{ top: '-5cqw', right: '3cqw' }}>
            <b style={{ background: 'hsl(var(--success) / .25)', color: 'hsl(var(--success))' }}>✓</b> Lead created
          </div>
          <div className="hb-chip" style={{ bottom: '-5cqw', left: '5cqw', animationDelay: '-2.5s' }}>
            <b style={{ background: 'hsl(var(--primary) / .25)', color: 'hsl(var(--primary))' }}>₹</b> New RFQ bid · 42,500
          </div>
        </>
      )}
    </div>
  );
}

function StatStrip() {
  const leads = useCountUp(128);
  const rfqs = useCountUp(14);
  const won = useCountUp(9);
  const items = [
    { n: leads, l: 'Active leads' },
    { n: rfqs, l: 'Open RFQs' },
    { n: won, l: 'Won this month' },
  ];
  return (
    <dl className="grid grid-cols-3 gap-3" aria-hidden="true">
      {items.map((it) => (
        <div key={it.l} className="glass rounded-2xl border px-3.5 py-2.5">
          <dt className="sr-only">{it.l}</dt>
          <dd className="font-display text-xl font-bold tabular-nums text-foreground">{it.n}</dd>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground xl:text-xs">{it.l}</p>
        </div>
      ))}
    </dl>
  );
}

async function resolveDisplayName(u: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): Promise<string> {
  const meta = (u?.user_metadata ?? {}) as { full_name?: string; name?: string };
  let name = (meta.full_name || meta.name || '').toString().trim();
  if (u?.id) {
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', u.id).maybeSingle();
      if (profile?.full_name?.trim()) name = profile.full_name.trim();
    } catch { /* use metadata */ }
  }
  if (!name) name = (u?.email ?? '').split('@')[0] || 'there';
  return name;
}

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessSplash, setShowSuccessSplash] = useState(false);
  const [view, setView] = useState<View>('signin');
  const [forgotEmail, setForgotEmail] = useState('');
  const [shake, setShake] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [greetName, setGreetName] = useState('');
  const justLoggedInRef = useRef(false);
  const greetedRef = useRef(false);

  const { signIn, signOut, user, allowedEmailDomains } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { resolvedTheme, setTheme } = useTheme();
  const skipAutoNavRef = useRef(false);
  // True when this page load is the return leg of a Google sign-in that we started.
  // (Accounts created with email+password keep app_metadata.provider === 'email' even
  // after signing in with Google, so the provider alone cannot tell the two apart.)
  const oauthReturnRef = useRef<boolean | null>(null);
  if (oauthReturnRef.current === null) {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem(OAUTH_PENDING_KEY) === 'google';
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
    } catch { /* storage unavailable */ }
    oauthReturnRef.current = flagged;
  }
  const [handoffDone, setHandoffDone] = useState(() => {
    if (typeof window === 'undefined') return true;
    const p = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const type = p.get('type') || h.get('type');
    return !(p.has('code') || p.get('verified') === 'true' || type === 'signup' || type === 'email');
  });

  // Friendly message when a not-invited Google account is rejected by the database.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const desc = p.get('error_description') || h.get('error_description') || '';
    if (!desc) return;
    if (/invite|database error saving new user|signups? not allowed/i.test(desc)) {
      setNotice("That account hasn't been invited yet. Ask your administrator to send you an invite.");
    } else {
      setNotice(desc.replace(/\+/g, ' '));
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('error');
    url.searchParams.delete('error_code');
    url.searchParams.delete('error_description');
    url.hash = '';
    window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ''));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const email = (e as CustomEvent).detail?.email ?? '';
      const blocked = (e as CustomEvent).detail?.allowedDomains as string[] | undefined;
      const domainList = (blocked ?? allowedEmailDomains).map((d) => `@${d}`).join(' or ');
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: `${email || 'That account'} is not allowed. Sign in is restricted to ${domainList} accounts.`,
      });
    };
    window.addEventListener('auth:domain-blocked', handler);
    return () => window.removeEventListener('auth:domain-blocked', handler);
  }, [allowedEmailDomains, toast]);

  useEffect(() => {
    let cancelled = false;
    const params = searchParams;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = params.get('code');
    const type = params.get('type') || hash.get('type');
    const verifiedFlag = params.get('verified') === 'true';
    const isEmailConfirm = type === 'signup' || type === 'email' || verifiedFlag;

    const stripAuthParams = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('verified');
      url.searchParams.delete('type');
      url.hash = '';
      const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '');
      window.history.replaceState({}, document.title, next);
    };

    const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), ms)),
      ]);

    (async () => {
      try {
        if (code) {
          try {
            await withTimeout(supabase.auth.exchangeCodeForSession(window.location.href), 8000);
          } catch {
            /* exchange failed or timed out — still show the sign-in form */
          }
        }
        if (cancelled) return;

        const { data: { session } } = await supabase.auth.getSession();
        const provider = session?.user?.app_metadata?.provider;
        const confirmSession = isEmailConfirm || (!!code && provider === 'email' && !oauthReturnRef.current);

        if (confirmSession) {
          skipAutoNavRef.current = true;
          if (session) await signOut();
          if (!cancelled) {
            toast({ title: 'Email verified!', description: 'Your account is ready. Please sign in.' });
          }
        } else {
          skipAutoNavRef.current = false;
        }
        stripAuthParams();
      } finally {
        if (!cancelled) setHandoffDone(true);
      }
    })();

    return () => { cancelled = true; };
    // Run once on landing from the email/OAuth redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!handoffDone) return;
    if (!user) return;
    if (showSuccessSplash) return;
    if (skipAutoNavRef.current) return;
    // Email sign-in is greeting the user (splash is about to show): do not redirect yet.
    if (justLoggedInRef.current && !oauthReturnRef.current) return;
    // Returning from Google: greet by name with the success splash, like email sign-in does.
    if (oauthReturnRef.current && !greetedRef.current) {
      greetedRef.current = true;
      justLoggedInRef.current = true;
      void resolveDisplayName(user).then((name) => {
        setGreetName(name);
        setShowSuccessSplash(true);
        toast({ title: `Welcome back, ${name}!` });
      });
      return;
    }
    navigate(getPostLoginPath());
  }, [user, navigate, showSuccessSplash, handoffDone, toast]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setNotice(null);
    try { sessionStorage.setItem(OAUTH_PENDING_KEY, 'google'); } catch { /* ignore */ }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.modify',
        redirectTo: `${window.location.origin}/auth`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
      setIsGoogleLoading(false);
      try { sessionStorage.removeItem(OAUTH_PENDING_KEY); } catch { /* ignore */ }
      toast({ variant: 'destructive', title: 'Google sign-in failed', description: error.message });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setNotice(null);
    const result = loginSchema.safeParse(loginForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      setShake((n) => n + 1);
      return;
    }
    setIsLoading(true);
    const { error, user: signedInUser } = await signIn(result.data.email, loginForm.password);
    if (error) {
      setIsLoading(false);
      setShake((n) => n + 1);
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: error.message === 'Invalid login credentials' ? 'Invalid email or password.' : error.message,
      });
      return;
    }
    justLoggedInRef.current = true;
    const displayName = await resolveDisplayName(signedInUser);
    setGreetName(displayName);
    setShowSuccessSplash(true);
    setIsLoading(false);
    toast({ title: `Welcome back, ${displayName}!` });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setErrors({ forgotEmail: 'Enter the email you were invited with' });
      setShake((n) => n + 1);
      return;
    }
    setErrors({});
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    setView('sent');
  };

  const goView = (v: View) => {
    setErrors({});
    setView(v);
  };

  return (
    <>
      {showSuccessSplash && (
        <SplashScreen
          variant="success"
          name={greetName}
          duration={2200}
          onComplete={() => {
            justLoggedInRef.current = false;
            setShowSuccessSplash(false);
            navigate(getPostLoginPath());
          }}
        />
      )}

      <div className="auth2-bg relative min-h-dvh overflow-clip">
        <div className="auth2-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        {/* drifting light, clipped in its own layer so it can never widen or scroll the page */}
        <div className="pointer-events-none absolute inset-0 overflow-clip" aria-hidden="true">
          <div className="auth2-blob left-[-80px] top-[8%] h-80 w-80 bg-primary/30" />
          <div className="auth2-blob right-[-60px] top-[46%] h-72 w-72 bg-accent/20" style={{ animationDuration: '26s', animationDelay: '-8s' }} />
        </div>

        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1320px] flex-col px-4 sm:px-8 lg:px-10 xl:px-14">
          {/* top bar */}
          <header className="flex items-center justify-between pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] lg:pt-6">
            <div className="auth2-in"><BrandLogo tone="adaptive" size={34} /></div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => toggleThemeWithReveal(resolvedTheme, setTheme, e)}
              className="glass h-11 w-11 rounded-full border text-foreground hover:bg-card/80"
              aria-label="Toggle light and dark theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </header>

          <div className="grid flex-1 items-center gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(400px,440px)] lg:gap-12 xl:gap-20">
            {/* ── Hero (large screens): centred in its column, board tilts toward the card ── */}
            <section className="hidden lg:block">
              <div className="mx-auto max-w-[560px] space-y-6 py-2">
                <div className="auth2-in space-y-4" style={{ animationDelay: '.1s' }}>
                  <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Connect <span className="text-foreground/70">by RemoAsset</span>
                  </p>
                  <h1
                    className="font-display font-bold leading-[1.03] tracking-tight text-foreground"
                    style={{ fontSize: 'clamp(2rem, 1rem + 1.9vw, 3rem)' }}
                  >
                    Every vendor. Every deal.<br /><span className="auth2-gradient-text">One place.</span>
                  </h1>
                  <p className="max-w-md text-[clamp(.9rem,.8rem+.25vw,1.05rem)] leading-relaxed text-muted-foreground">
                    The workspace for leads, pipeline, RFQs and follow-ups, built for speed.
                  </p>
                </div>
                <div className="auth2-in pb-4" style={{ animationDelay: '.25s' }}>
                  <div className="auth2-tilt"><HeroBoard /></div>
                </div>
                <div className="auth2-in" style={{ animationDelay: '.4s' }}><StatStrip /></div>
              </div>
            </section>

            {/* ── Phone / tablet hero: only when there is room, so the form stays in reach ── */}
            <div className="auth2-in hidden w-full max-w-[460px] justify-self-center [@media(min-height:900px)]:block lg:!hidden" style={{ animationDelay: '.1s' }}>
              <h1 className="mb-4 font-display text-[clamp(1.5rem,1rem+2.4vw,2.1rem)] font-bold leading-tight tracking-tight text-foreground">
                Every vendor. Every deal. <span className="auth2-gradient-text">One place.</span>
              </h1>
              <HeroBoard chips={false} />
            </div>

            {/* ── Sign-in card ── */}
            <main className="flex w-full items-end justify-center lg:items-center">
              <div
                className="auth2-in auth2-glass -mx-4 w-[calc(100%+2rem)] rounded-t-[2rem] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:mx-0 sm:w-full sm:max-w-[460px] sm:rounded-[2rem] sm:px-8 sm:pb-8 lg:max-w-[440px] lg:pt-7"
                style={{ animationDelay: '.15s' }}
              >
                <div key={view + shake} className={cn('auth2-view relative z-[2]', shake > 0 && view !== 'sent' && 'auth2-shake')}>
                  {view === 'signin' && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          <Lock className="h-3.5 w-3.5" /> Invite-only workspace
                        </span>
                        <h2 className="font-display text-[clamp(1.5rem,1.25rem+.6vw,1.85rem)] font-bold tracking-tight text-foreground">Welcome back</h2>
                        <p className="text-[15px] text-muted-foreground">Sign in with the account you were invited with.</p>
                      </div>

                      {notice && (
                        <div role="alert" className="auth2-view rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-ink">
                          {notice}
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        className="glass h-12 w-full gap-3 rounded-xl border text-[15px] lg:h-11 font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:bg-card/90 hover:text-foreground hover:shadow-md active:translate-y-0 active:scale-[.98]"
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleLoading || isLoading}
                      >
                        {isGoogleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon className="h-5 w-5 shrink-0" />}
                        Continue with Google
                      </Button>

                      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                        <span className="h-px flex-1 bg-border/70" /> or with email <span className="h-px flex-1 bg-border/70" />
                      </div>

                      <form onSubmit={handleLogin} className="space-y-4" noValidate>
                        <div className="auth2-field space-y-2">
                          <Label htmlFor="login-email" className="text-sm font-semibold transition-colors">Email</Label>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="login-email"
                              type="email"
                              inputMode="email"
                              autoComplete="username"
                              autoCapitalize="none"
                              placeholder="you@company.com"
                              value={loginForm.email}
                              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                              aria-invalid={!!errors.email}
                              aria-describedby={errors.email ? 'login-email-err' : undefined}
                              className={cn('h-12 lg:h-11 rounded-xl border-border/70 bg-background/50 pl-11 text-base backdrop-blur-sm transition-shadow focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/.15)]', errors.email && 'border-destructive')}
                            />
                          </div>
                          {errors.email && <p id="login-email-err" className="text-sm text-destructive-ink">{errors.email}</p>}
                        </div>

                        <div className="auth2-field space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="login-password" className="text-sm font-semibold transition-colors">Password</Label>
                            <button
                              type="button"
                              onClick={() => { setForgotEmail(loginForm.email); goView('forgot'); }}
                              className="rounded px-1 text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                              Forgot password?
                            </button>
                          </div>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="login-password"
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="current-password"
                              placeholder="Your password"
                              value={loginForm.password}
                              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                              aria-invalid={!!errors.password}
                              aria-describedby={errors.password ? 'login-password-err' : undefined}
                              className={cn('h-12 lg:h-11 rounded-xl border-border/70 bg-background/50 pl-11 pr-12 text-base backdrop-blur-sm transition-shadow focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/.15)]', errors.password && 'border-destructive')}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                            </button>
                          </div>
                          {errors.password && <p id="login-password-err" className="text-sm text-destructive-ink">{errors.password}</p>}
                        </div>

                        <Button
                          type="submit"
                          className="group h-12 w-full rounded-xl text-[15px] lg:h-11 font-semibold shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/35 active:translate-y-0 active:scale-[.98]"
                          disabled={isLoading || isGoogleLoading}
                        >
                          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                            <>Sign in <ArrowRight className="ml-2 h-[18px] w-[18px] transition-transform group-hover:translate-x-1" /></>
                          )}
                        </Button>
                      </form>

                      <p className="rounded-xl border border-border/40 bg-background/40 px-4 py-3 text-center text-[13px] leading-relaxed text-muted-foreground">
                        Don't have an account? Access is by invitation only. Ask your administrator to send you an invite.
                      </p>
                    </div>
                  )}

                  {view === 'forgot' && (
                    <form onSubmit={handleForgotPassword} className="space-y-6" noValidate>
                      <button
                        type="button"
                        onClick={() => goView('signin')}
                        className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <ArrowLeft className="h-4 w-4" /> Back to sign in
                      </button>
                      <div className="space-y-2.5">
                        <h2 className="font-display text-[clamp(1.5rem,1.25rem+.6vw,1.85rem)] font-bold tracking-tight text-foreground">Reset your password</h2>
                        <p className="text-[15px] text-muted-foreground">Enter your email and we'll send you a link to choose a new password.</p>
                      </div>
                      <div className="auth2-field space-y-2">
                        <Label htmlFor="forgot-email" className="text-sm font-semibold transition-colors">Email</Label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="forgot-email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            placeholder="you@company.com"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            aria-invalid={!!errors.forgotEmail}
                            className={cn('h-12 lg:h-11 rounded-xl border-border/70 bg-background/50 pl-11 text-base backdrop-blur-sm', errors.forgotEmail && 'border-destructive')}
                          />
                        </div>
                        {errors.forgotEmail && <p className="text-sm text-destructive-ink">{errors.forgotEmail}</p>}
                      </div>
                      <Button type="submit" className="h-12 w-full rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/30 active:scale-[.98]" disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send reset link'}
                      </Button>
                    </form>
                  )}

                  {view === 'sent' && (
                    <div className="space-y-6 text-center" role="status">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                        <svg viewBox="0 0 52 52" className="h-11 w-11" aria-hidden="true">
                          <rect x="6" y="12" width="40" height="28" rx="6" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray="140" strokeDashoffset="140" style={{ animation: 'auth2-draw .6s .1s ease-out forwards' }} />
                          <path d="M9 17l17 12 17-12" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="60" style={{ animation: 'auth2-draw .5s .55s ease-out forwards' }} />
                        </svg>
                      </div>
                      <div className="space-y-2">
                        <h2 className="font-display text-[clamp(1.5rem,1.25rem+.6vw,1.85rem)] font-bold tracking-tight text-foreground">Check your inbox</h2>
                        <p className="text-[15px] text-muted-foreground">
                          If <span className="font-semibold text-foreground">{forgotEmail}</span> belongs to an invited account, a reset link is on its way.
                        </p>
                      </div>
                      <Button variant="outline" className="glass h-12 w-full rounded-xl border font-semibold" onClick={() => goView('signin')}>
                        Back to sign in
                      </Button>
                    </div>
                  )}
                </div>

                <p className="relative z-[2] mt-7 text-center text-xs text-muted-foreground">
                  <a href="/privacy" className="hover:text-foreground hover:underline">Privacy Policy</a>
                  <span className="mx-2" aria-hidden="true">·</span>
                  <a href="/terms" className="hover:text-foreground hover:underline">Terms of Service</a>
                </p>
              </div>
            </main>
          </div>

          <p className="hidden items-center justify-center gap-2 py-4 text-sm text-muted-foreground lg:flex">
            <ShieldCheck className="h-4 w-4" /> Private workspace · access by invitation only
          </p>
        </div>
      </div>
    </>
  );
};

export default Auth;
