import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { SplashScreen } from '@/components/SplashScreen';
import { Loader2, Mail, Lock, User, Eye, EyeOff, BarChart3, Users, Shield, Zap, ArrowLeft, CheckCircle2, Sun, Moon, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const ALLOWED_SIGNUP_DOMAIN = 'remoasset.com';

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?]).{8,}$/;
export const PASSWORD_REQUIREMENTS = [
  'At least 8 characters',
  'One uppercase letter',
  'One lowercase letter',
  'One number',
  'One special character (!@#$%^&* etc.)',
];

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email')
    .refine((e) => e.toLowerCase().endsWith(`@${ALLOWED_SIGNUP_DOMAIN}`), {
      message: `Sign up is only allowed with a @${ALLOWED_SIGNUP_DOMAIN} email address.`,
    }),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(strongPasswordRegex, 'Password does not meet requirements'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ email: '', password: '', confirmPassword: '', fullName: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const [showSuccessSplash, setShowSuccessSplash] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const justLoggedInRef = useRef(false);

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      toast({ title: 'Email verified!', description: 'Your account is ready. Please sign in.' });
    }
    // Listen for domain-blocked events from AuthContext (non-remoasset.com Google accounts)
    const handler = (e: Event) => {
      const email = (e as CustomEvent).detail?.email ?? '';
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: `${email || 'That account'} is not a @remoasset.com address. Only RemoAsset team members can sign in.`,
      });
    };
    window.addEventListener('auth:domain-blocked', handler);
    return () => window.removeEventListener('auth:domain-blocked', handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (justLoggedInRef.current || showSuccessSplash) return;
    navigate('/dashboard');
  }, [user, navigate, showSuccessSplash]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.modify',
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
      setIsGoogleLoading(false);
      toast({ variant: 'destructive', title: 'Google sign-in failed', description: error.message });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = loginSchema.safeParse(loginForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setIsLoading(true);
    const { error, user: signedInUser } = await signIn(loginForm.email, loginForm.password);
    if (error) {
      setIsLoading(false);
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = signupSchema.safeParse(signupForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setIsLoading(true);
    const { error } = await signUp(signupForm.email, signupForm.password, signupForm.fullName);
    setIsLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        toast({ variant: 'destructive', title: 'Account exists', description: 'Please sign in instead.' });
      } else {
        toast({ variant: 'destructive', title: 'Signup failed', description: error.message });
      }
    } else {
      toast({ title: 'Account created!', description: 'Check your email to verify.' });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast({ variant: 'destructive', title: 'Email required' });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    setForgotSent(true);
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
            navigate('/dashboard');
          }}
        />
      )}
      <div className="min-h-screen flex bg-background">

        {/* ── Left: branding ── */}
        <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden auth-left-pane flex-col justify-between p-12 xl:p-16">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_30%_0%,hsl(var(--sidebar-primary)/0.35),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_85%_90%,hsl(var(--accent)/0.18),transparent_50%)]" />
          <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-primary/20 blur-[80px] pointer-events-none" />
          <div className="absolute bottom-1/3 -right-20 w-64 h-64 rounded-full bg-accent/15 blur-[70px] pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)', backgroundSize: '28px 28px' }} />
          <div className="relative z-10 animate-fade-in-right">
            <img src="/logo.png" alt="RemoAsset Connect" className="h-11 w-auto object-contain drop-shadow-md" />
          </div>
          <div className="relative z-10 space-y-10">
            <div className="space-y-6 animate-fade-in-right animate-fade-in-right-delay-1">
              <h1 className="font-display text-4xl xl:text-5xl font-bold text-sidebar-foreground tracking-tight leading-tight">Connect</h1>
              <p className="text-sidebar-foreground/85 text-lg xl:text-xl max-w-md leading-relaxed">
                RemoAsset's internal vendor resource management. Manage leads, track activities, and close deals in one place.
              </p>
            </div>
            <ul className="space-y-3 animate-fade-in-right animate-fade-in-right-delay-2">
              {[
                { Icon: Users, color: 'bg-primary/20 text-primary', title: 'Lead pipeline', desc: '— Track status, score, and ownership' },
                { Icon: BarChart3, color: 'bg-accent/20 text-accent', title: 'Tasks & follow-ups', desc: '— Never miss a touchpoint' },
                { Icon: Zap, color: 'bg-success/20 text-success', title: 'Activity timeline', desc: '— Calls, emails, meetings in one log' },
                { Icon: Shield, color: 'bg-sidebar-primary/20 text-sidebar-primary', title: 'Secure & role-based', desc: '— Admin controls and team visibility' },
              ].map((item) => (
                <li key={item.title} className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all duration-200">
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', item.color)}>
                    <item.Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="font-semibold text-sidebar-foreground">{item.title}</span>
                    <span className="text-sidebar-foreground/75"> {item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-sidebar-foreground/50 text-sm pt-2 animate-fade-in-up animate-fade-in-up-delay-2">
              Internal tool for RemoAsset teams.
            </p>
          </div>
        </div>

        {/* ── Right: form ── */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10 auth-right-pane relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_40%,hsl(var(--primary)/0.12),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_90%_60%,hsl(var(--accent)/0.08),transparent_50%)]" />
          <div className="auth-form-dots absolute inset-0 pointer-events-none" aria-hidden />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full border border-border/50 bg-card/90 backdrop-blur-md shadow-md hover:bg-muted/80 hover:border-primary/20 transition-all duration-200"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          <div className="w-full max-w-[420px] relative z-10">
            <div className="auth-form-card rounded-2xl border border-border/60 bg-card/95 dark:bg-card/90 backdrop-blur-xl shadow-2xl shadow-black/5 dark:shadow-black/40 p-8 sm:p-10 animate-fade-in-up">

              {/* mobile logo */}
              <div className="lg:hidden mb-6 flex justify-center">
                <div className="rounded-xl bg-sidebar/90 px-5 py-2.5 inline-flex items-center justify-center border border-white/10">
                  <img src="/logo.png" alt="RemoAsset Connect" className="h-9 w-auto object-contain" />
                </div>
              </div>

              <div className="mb-8">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Welcome back</h2>
                <p className="text-muted-foreground mt-2 text-[15px]">Sign in to continue to Connect.</p>
              </div>

              <Tabs defaultValue="login" className="w-full" onValueChange={() => { setShowEmailLogin(false); setErrors({}); }}>
                <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 p-1.5 rounded-xl border border-border/50">
                  <TabsTrigger value="login" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:border border border-transparent transition-all duration-200">
                    Sign in
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:border border border-transparent transition-all duration-200">
                    Sign up
                  </TabsTrigger>
                </TabsList>

                {/* ── SIGN IN TAB ── */}
                <TabsContent value="login" className="mt-8 space-y-4">
                  {!forgotMode ? (
                    <>
                      {/* Google — primary action */}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-12 rounded-xl border-border/70 bg-background/80 hover:bg-muted/50 font-semibold text-sm gap-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleLoading || isLoading}
                      >
                        {isGoogleLoading
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <GoogleIcon className="h-5 w-5 shrink-0" />}
                        Continue with Google
                      </Button>

                      {/* divider with expand toggle */}
                      <div className="flex items-center gap-3 py-1">
                        <div className="flex-1 h-px bg-border/60" />
                        <button
                          type="button"
                          onClick={() => setShowEmailLogin((v) => !v)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 rounded-md px-2 py-1 hover:bg-muted/60"
                        >
                          Sign in with email
                          {showEmailLogin
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        <div className="flex-1 h-px bg-border/60" />
                      </div>

                      {/* email/password form — smooth slide */}
                      <div className={cn(
                        'overflow-hidden transition-all duration-300 ease-in-out',
                        showEmailLogin ? 'max-h-[360px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                      )}>
                        <form onSubmit={handleLogin} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                              <Input
                                id="login-email"
                                type="email"
                                placeholder="you@remoasset.com"
                                value={loginForm.email}
                                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                                className="pl-10 h-11 rounded-xl border-border/70 bg-background/80 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/30 transition-all duration-200"
                              />
                            </div>
                            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                              <Input
                                id="login-password"
                                type={showLoginPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={loginForm.password}
                                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                className="pl-10 pr-10 h-11 rounded-xl border-border/70 bg-background/80 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/30 transition-all duration-200"
                              />
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => setShowLoginPassword((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                                aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                              >
                                {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                          </div>
                          <Button
                            type="submit"
                            className="w-full h-11 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                            disabled={isLoading}
                          >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Sign in with email
                          </Button>
                          <div className="text-center">
                            <button
                              type="button"
                              onClick={() => { setForgotMode(true); setForgotSent(false); setForgotEmail(loginForm.email); }}
                              className="text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                              Forgot your password?
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* subtle hint when email form is hidden */}
                      {!showEmailLogin && (
                        <p className="text-center text-xs text-muted-foreground/60 -mt-1">
                          Use your <span className="text-muted-foreground font-medium">@remoasset.com</span> Google account to sign in
                        </p>
                      )}
                    </>
                  ) : (
                    /* ── forgot password ── */
                    <div className="space-y-5 animate-fade-in">
                      <button
                        type="button"
                        onClick={() => { setForgotMode(false); setForgotSent(false); }}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back to sign in
                      </button>
                      {forgotSent ? (
                        <div className="text-center py-6 space-y-4">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 border border-success/20">
                            <CheckCircle2 className="h-7 w-7 text-success" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">Check your email</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              We sent a reset link to <strong>{forgotEmail}</strong>.
                            </p>
                          </div>
                          <Button variant="outline" onClick={() => { setForgotMode(false); setForgotSent(false); }}>
                            Back to sign in
                          </Button>
                        </div>
                      ) : (
                        <form onSubmit={handleForgotPassword} className="space-y-5">
                          <div className="space-y-1">
                            <h3 className="text-lg font-semibold">Reset your password</h3>
                            <p className="text-sm text-muted-foreground">Enter your email and we'll send a reset link.</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="forgot-email" className="text-sm font-medium">Email</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                              <Input
                                id="forgot-email"
                                type="email"
                                placeholder="you@remoasset.com"
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.target.value)}
                                className="pl-10 h-11 rounded-xl border-border/70 bg-background/80 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/30 transition-all duration-200"
                                autoFocus
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="w-full h-12 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                            disabled={isLoading}
                          >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Send reset link
                          </Button>
                        </form>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* ── SIGN UP TAB ── */}
                <TabsContent value="signup" className="mt-8 space-y-5">
                  {/* Google — primary */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 rounded-xl border-border/70 bg-background/80 hover:bg-muted/50 font-semibold text-sm gap-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading || isLoading}
                  >
                    {isGoogleLoading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <GoogleIcon className="h-5 w-5 shrink-0" />}
                    Sign up with Google
                  </Button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-xs text-muted-foreground shrink-0">or sign up with email</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>

                  <form onSubmit={handleSignup} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-sm font-medium">Full name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="John Doe"
                          value={signupForm.fullName}
                          onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                          className="pl-10 h-11 rounded-xl border-border/70 bg-background/80 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/30 transition-all duration-200"
                        />
                      </div>
                      {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder={`you@${ALLOWED_SIGNUP_DOMAIN}`}
                          value={signupForm.email}
                          onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                          className="pl-10 h-11 rounded-xl border-border/70 bg-background/80 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/30 transition-all duration-200"
                        />
                      </div>
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="signup-password"
                          type={showSignupPassword ? 'text' : 'password'}
                          placeholder="Strong password"
                          value={signupForm.password}
                          onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                          className="pl-10 pr-10 h-11 rounded-xl border-border/70 bg-background/80 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/30 transition-all duration-200"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowSignupPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                          aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                        >
                          {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                        {PASSWORD_REQUIREMENTS.map((req) => <li key={req}>{req}</li>)}
                      </ul>
                      {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm" className="text-sm font-medium">Confirm password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="signup-confirm"
                          type={showSignupConfirm ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={signupForm.confirmPassword}
                          onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                          className="pl-10 pr-10 h-11 rounded-xl border-border/70 bg-background/80 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/30 transition-all duration-200"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowSignupConfirm((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                          aria-label={showSignupConfirm ? 'Hide password' : 'Show password'}
                        >
                          {showSignupConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Create account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
