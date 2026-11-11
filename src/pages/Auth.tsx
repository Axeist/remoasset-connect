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
  Loader2, Eye, EyeOff, ArrowLeft, ArrowRight, Sun, Moon, Lock, Mail, CheckCircle2, Clock, IndianRupee, ShieldCheck,
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

/** Floating product cards shown beside the form on large screens. */
function ShowcaseCards() {
  const items = [
    { Icon: CheckCircle2, tone: 'bg-success/20 text-success', title: 'Lead created', sub: 'Acme Devices · United Kingdom', delay: '0s', offset: 'ml-0' },
    { Icon: Clock, tone: 'bg-primary/20 text-primary', title: 'Follow-up due in 15 min', sub: 'Dell Technologies', delay: '.9s', offset: 'ml-10' },
    { Icon: IndianRupee, tone: 'bg-accent/25 text-accent', title: 'New RFQ bid received', sub: 'Lenovo Nordics · ₹42,500', delay: '1.8s', offset: 'ml-4' },
  ];
  return (
    <ul className="space-y-3.5" aria-hidden="true">
      {items.map((it, i) => (
        <li
          key={it.title}
          className={cn('auth2-in', it.offset)}
          style={{ animationDelay: `${0.25 + i * 0.15}s` }}
        >
          <div
            className="auth2-float flex max-w-sm items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-md"
            style={{ animationDelay: it.delay }}
          >
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', it.tone)}>
              <it.Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{it.title}</p>
              <p className="truncate text-xs text-white/60">{it.sub}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
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
  const justLoggedInRef = useRef(false);

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
    navigate(getPostLoginPath());
  }, [user, navigate, showSuccessSplash, handoffDone]);

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
    setShowSuccessSplash(true);
    setIsLoading(false);
    let displayName = signedInUser?.user_metadata?.full_name || signedInUser?.email?.split('@')[0] || '';
    if (signedInUser?.id) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', signedInUser.id).maybeSingle();
      if (profile?.full_name?.trim()) displayName = profile.full_name.trim();
    }
    if (!displayName) displayName = 'there';
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
          duration={2200}
          onComplete={() => {
            justLoggedInRef.current = false;
            setShowSuccessSplash(false);
            navigate(getPostLoginPath());
          }}
        />
      )}

      <div className="auth2-bg relative min-h-dvh overflow-clip lg:grid lg:grid-cols-[1.08fr_1fr]">
        {/* drifting light, clipped in its own layer so it can never widen or scroll the page */}
        <div className="pointer-events-none absolute inset-0 overflow-clip" aria-hidden="true">
          <div className="auth2-blob left-[-80px] top-[8%] h-72 w-72 bg-primary/30" />
          <div className="auth2-blob right-[-60px] top-[40%] h-64 w-64 bg-accent/20" style={{ animationDuration: '26s', animationDelay: '-8s' }} />
        </div>

        {/* ── Brand panel (large screens) ── */}
        <aside className="relative z-10 hidden flex-col justify-between p-12 xl:p-16 lg:flex">
          <div className="auth2-in"><BrandLogo tone="onDark" size={42} /></div>
          <div className="space-y-9">
            <div className="auth2-in space-y-4" style={{ animationDelay: '.1s' }}>
              <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-white xl:text-5xl">
                Every vendor.<br />Every deal.<br /><span className="text-primary">One place.</span>
              </h1>
              <p className="max-w-md text-lg leading-relaxed text-white/70">
                RemoAsset's internal workspace for leads, pipeline, RFQs and follow-ups.
              </p>
            </div>
            <ShowcaseCards />
          </div>
          <p className="auth2-in flex items-center gap-2 text-sm text-white/50" style={{ animationDelay: '.6s' }}>
            <ShieldCheck className="h-4 w-4" /> Private workspace · access by invitation only
          </p>
        </aside>

        {/* ── Form panel ── */}
        <main className="relative z-10 flex min-h-dvh flex-col lg:min-h-0 lg:bg-background lg:rounded-l-[2.25rem]">
          {/* mobile header */}
          <header className="flex items-center justify-between px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] lg:absolute lg:inset-x-0 lg:top-0 lg:justify-end lg:p-6">
            <div className="lg:hidden auth2-in"><BrandLogo tone="onDark" size={34} /></div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => toggleThemeWithReveal(resolvedTheme, setTheme, e)}
              className="h-11 w-11 rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:text-white lg:border-border lg:bg-card lg:text-foreground lg:hover:bg-muted"
              aria-label="Toggle light and dark theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </header>

          <div className="mt-auto flex flex-1 flex-col justify-end lg:mt-0 lg:items-center lg:justify-center lg:px-10">
            <div
              className="auth2-in auth2-card w-full rounded-t-[2rem] bg-background px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:mx-auto sm:max-w-[460px] sm:rounded-[2rem] sm:mb-10 sm:px-9 lg:mb-0 lg:max-w-[440px] lg:shadow-none lg:ring-0"
              style={{ animationDelay: '.15s' }}
            >
              <div key={view + shake} className={cn('auth2-view', shake > 0 && view !== 'sent' && 'auth2-shake')}>
                {view === 'signin' && (
                  <div className="space-y-6">
                    <div className="space-y-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        <Lock className="h-3.5 w-3.5" /> Invite-only workspace
                      </span>
                      <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
                      <p className="text-[15px] text-muted-foreground">Sign in with the account you were invited with.</p>
                    </div>

                    {notice && (
                      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive auth2-view">
                        {notice}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full gap-3 rounded-xl border-border bg-background text-[15px] font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0 active:scale-[.98]"
                      onClick={handleGoogleSignIn}
                      disabled={isGoogleLoading || isLoading}
                    >
                      {isGoogleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon className="h-5 w-5 shrink-0" />}
                      Continue with Google
                    </Button>

                    <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                      <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
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
                            className={cn('h-12 rounded-xl pl-11 text-base transition-shadow focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/.15)]', errors.email && 'border-destructive')}
                          />
                        </div>
                        {errors.email && <p id="login-email-err" className="text-sm text-destructive">{errors.email}</p>}
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
                            className={cn('h-12 rounded-xl pl-11 pr-12 text-base transition-shadow focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/.15)]', errors.password && 'border-destructive')}
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
                        {errors.password && <p id="login-password-err" className="text-sm text-destructive">{errors.password}</p>}
                      </div>

                      <Button
                        type="submit"
                        className="group h-12 w-full rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 active:translate-y-0 active:scale-[.98]"
                        disabled={isLoading || isGoogleLoading}
                      >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                          <>Sign in <ArrowRight className="ml-2 h-[18px] w-[18px] transition-transform group-hover:translate-x-1" /></>
                        )}
                      </Button>
                    </form>

                    <p className="rounded-xl bg-muted/60 px-4 py-3 text-center text-[13px] leading-relaxed text-muted-foreground">
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
                      <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Reset your password</h2>
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
                          className={cn('h-12 rounded-xl pl-11 text-base', errors.forgotEmail && 'border-destructive')}
                        />
                      </div>
                      {errors.forgotEmail && <p className="text-sm text-destructive">{errors.forgotEmail}</p>}
                    </div>
                    <Button
                      type="submit"
                      className="h-12 w-full rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/25 active:scale-[.98]"
                      disabled={isLoading}
                    >
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
                      <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Check your inbox</h2>
                      <p className="text-[15px] text-muted-foreground">
                        If <span className="font-semibold text-foreground">{forgotEmail}</span> belongs to an invited account, a reset link is on its way.
                      </p>
                    </div>
                    <Button variant="outline" className="h-12 w-full rounded-xl font-semibold" onClick={() => goView('signin')}>
                      Back to sign in
                    </Button>
                  </div>
                )}
              </div>

              <p className="mt-7 text-center text-xs text-muted-foreground">
                <a href="/privacy" className="hover:text-foreground hover:underline">Privacy Policy</a>
                <span className="mx-2" aria-hidden="true">·</span>
                <a href="/terms" className="hover:text-foreground hover:underline">Terms of Service</a>
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default Auth;
