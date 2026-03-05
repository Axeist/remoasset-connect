import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { SplashScreen } from '@/components/SplashScreen';
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, ShieldCheck, X, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?]).{8,}$/;

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(strongPasswordRegex, 'Password does not meet requirements'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

interface Requirement {
  label: string;
  test: (pw: string) => boolean;
}

const REQUIREMENTS: Requirement[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /\d/.test(pw) },
  { label: 'One special character (!@#$%^&*…)', test: (pw) => /[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?]/.test(pw) },
];

function getStrength(pw: string): { score: number; label: string; color: string } {
  const passed = REQUIREMENTS.filter((r) => r.test(pw)).length;
  if (pw.length === 0) return { score: 0, label: '', color: '' };
  if (passed <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
  if (passed <= 2) return { score: 2, label: 'Fair', color: 'bg-orange-400' };
  if (passed <= 3) return { score: 3, label: 'Good', color: 'bg-yellow-400' };
  if (passed <= 4) return { score: 4, label: 'Strong', color: 'bg-emerald-400' };
  return { score: 5, label: 'Very strong', color: 'bg-emerald-500' };
}

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [userName, setUserName] = useState('');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const isInvite = searchParams.get('invite') === 'true';

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
        // Fetch name for welcome message
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', session.user.id)
            .maybeSingle();
          const name = profile?.full_name?.trim()
            || session.user.user_metadata?.full_name
            || session.user.email?.split('@')[0]
            || '';
          if (name) setUserName(name);
        }
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', session.user.id)
          .maybeSingle();
        const name = profile?.full_name?.trim()
          || session.user.user_metadata?.full_name
          || session.user.email?.split('@')[0]
          || '';
        if (name) setUserName(name);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = resetSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setIsLoading(false);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }

    setIsLoading(false);
    setSuccess(true);

    if (isInvite) {
      // Invited users: already signed in — show splash then go straight to dashboard
      setShowSplash(true);
    }
    // Password reset users: sign them out, they'll click "Sign in"
    else {
      await supabase.auth.signOut();
    }
  };

  const strength = getStrength(password);

  if (showSplash) {
    return (
      <SplashScreen
        variant="success"
        duration={2200}
        onComplete={() => navigate('/dashboard')}
      />
    );
  }

  if (!sessionReady && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5 p-8 sm:p-10 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Verifying your link…</p>
            <p className="text-xs text-muted-foreground">
              If this takes too long, the link may have expired.{' '}
              <button onClick={() => navigate('/auth')} className="text-primary hover:underline font-medium">
                Go back
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* Left branding pane — mirrors Auth.tsx */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden auth-left-pane flex-col justify-between p-12 xl:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_30%_0%,hsl(var(--sidebar-primary)/0.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_85%_90%,hsl(var(--accent)/0.18),transparent_50%)]" />
        <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-primary/20 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-1/3 -right-20 w-64 h-64 rounded-full bg-accent/15 blur-[70px] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="relative z-10 animate-fade-in-right">
          <img src="/logo.png" alt="RemoAsset Connect" className="h-11 w-auto object-contain drop-shadow-md" />
        </div>
        <div className="relative z-10 space-y-6 animate-fade-in-right animate-fade-in-right-delay-1">
          {isInvite ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50 mb-1">Welcome to</p>
                  <h1 className="font-display text-3xl xl:text-4xl font-bold text-sidebar-foreground tracking-tight leading-tight">
                    RemoAsset Connect
                  </h1>
                </div>
              </div>
              <p className="text-sidebar-foreground/80 text-lg max-w-md leading-relaxed">
                {userName ? `Hi ${userName}! ` : ''}You're just one step away. Set a strong password to activate your account.
              </p>
              <ul className="space-y-3">
                {[
                  'Manage leads & vendor pipeline',
                  'Track tasks, follow-ups & activities',
                  'Collaborate with your team in real time',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sidebar-foreground/75 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h1 className="font-display text-4xl xl:text-5xl font-bold text-sidebar-foreground tracking-tight leading-tight">
                Secure your account
              </h1>
              <p className="text-sidebar-foreground/80 text-lg max-w-md leading-relaxed">
                Choose a strong password to keep your RemoAsset Connect account safe.
              </p>
            </>
          )}
        </div>
        <p className="relative z-10 text-sidebar-foreground/40 text-sm">Internal tool for RemoAsset teams.</p>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 auth-right-pane relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_40%,hsl(var(--primary)/0.12),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_90%_60%,hsl(var(--accent)/0.08),transparent_50%)]" />
        <div className="auth-form-dots absolute inset-0 pointer-events-none" aria-hidden />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full border border-border/50 bg-card/90 backdrop-blur-md shadow-md hover:bg-muted/80 transition-all duration-200"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <div className="w-full max-w-[420px] relative z-10">
          <div className="auth-form-card rounded-2xl border border-border/60 bg-card/95 dark:bg-card/90 backdrop-blur-xl shadow-2xl shadow-black/5 dark:shadow-black/40 p-8 sm:p-10 animate-fade-in-up">

            {/* Mobile logo */}
            <div className="lg:hidden mb-6 flex justify-center">
              <div className="rounded-xl bg-sidebar/90 px-5 py-2.5 inline-flex items-center justify-center border border-white/10">
                <img src="/logo.png" alt="RemoAsset Connect" className="h-9 w-auto object-contain" />
              </div>
            </div>

            {success && !isInvite ? (
              /* Password reset success state */
              <div className="text-center py-4 space-y-5 animate-fade-in">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Password updated</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your password has been changed. Sign in with your new password to continue.
                  </p>
                </div>
                <Button
                  className="w-full h-11 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-primary/25"
                  onClick={() => navigate('/auth')}
                >
                  Sign in
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  {isInvite ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Invitation
                        </span>
                      </div>
                      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                        {userName ? `Welcome, ${userName.split(' ')[0]}!` : 'Welcome!'}
                      </h2>
                      <p className="text-muted-foreground mt-2 text-[15px]">
                        Set a password to activate your account and access the dashboard.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                        Set new password
                      </h2>
                      <p className="text-muted-foreground mt-2 text-[15px]">
                        Choose a strong password for your account.
                      </p>
                    </>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Password field */}
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm font-medium">
                      {isInvite ? 'Create password' : 'New password'}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-11 rounded-xl border-border/70 bg-background/80 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/30 transition-all duration-200"
                        autoFocus
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Strength bar */}
                    {password.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                'h-1 flex-1 rounded-full transition-all duration-300',
                                i <= strength.score ? strength.color : 'bg-muted'
                              )}
                            />
                          ))}
                        </div>
                        {strength.label && (
                          <p className={cn('text-xs font-medium', {
                            'text-red-500': strength.score <= 1,
                            'text-orange-500': strength.score === 2,
                            'text-yellow-500': strength.score === 3,
                            'text-emerald-500': strength.score >= 4,
                          })}>
                            {strength.label}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Requirements checklist */}
                    <ul className="space-y-1 pt-1">
                      {REQUIREMENTS.map((req) => {
                        const met = req.test(password);
                        return (
                          <li key={req.label} className={cn('flex items-center gap-2 text-xs transition-colors', met ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                            {met
                              ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              : <X className="h-3.5 w-3.5 shrink-0 opacity-40" />}
                            {req.label}
                          </li>
                        );
                      })}
                    </ul>

                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>

                  {/* Confirm field */}
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={cn(
                          'pl-10 pr-10 h-11 rounded-xl border-border/70 bg-background/80 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/30 transition-all duration-200',
                          confirmPassword && password === confirmPassword && 'border-emerald-400/60'
                        )}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && password === confirmPassword && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
                      </p>
                    )}
                    {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {isInvite ? 'Activate account' : 'Update password'}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
