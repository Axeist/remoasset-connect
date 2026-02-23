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
import { Loader2, Mail, Lock, User, Eye, EyeOff, BarChart3, Users, Shield, Zap, ExternalLink, ArrowLeft, CheckCircle2 } from 'lucide-react';

const ALLOWED_SIGNUP_DOMAIN = 'remoasset.com';

// Strong password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special
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

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
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
  const justLoggedInRef = useRef(false);

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      toast({ title: 'Email verified!', description: 'Your account is ready. Please sign in.' });
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (justLoggedInRef.current || showSuccessSplash) return;
    navigate('/dashboard');
  }, [user, navigate, showSuccessSplash]);

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
    <div className="min-h-screen flex">
      {/* Left: Branding — visible on larger screens */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden bg-sidebar flex-col justify-between p-12 xl:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--sidebar-primary)/0.3),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_80%,hsl(var(--accent)/0.15),transparent)]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\' fill=\'%23fff\'/%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative z-10 animate-fade-in-right">
          <img src="/logo.png" alt="RemoAsset" className="h-10 w-auto object-contain drop-shadow-sm" />
        </div>
        <div className="relative z-10 space-y-8">
          <div className="space-y-6 animate-fade-in-right animate-fade-in-right-delay-1">
            <h1 className="font-display text-3xl xl:text-4xl font-bold text-sidebar-foreground tracking-tight leading-tight">
              Vendor Resource Management
            </h1>
            <p className="text-sidebar-foreground/80 text-lg max-w-md leading-relaxed">
              Manage leads, track activities, and close deals in one place. Built for teams that move fast.
            </p>
          </div>
          <ul className="space-y-4 animate-fade-in-right animate-fade-in-right-delay-2">
            <li className="flex items-center gap-3 text-sidebar-foreground/90">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Users className="h-5 w-5" />
              </span>
              <span><strong className="text-sidebar-foreground">Lead pipeline</strong> — Track status, score, and ownership</span>
            </li>
            <li className="flex items-center gap-3 text-sidebar-foreground/90">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
                <BarChart3 className="h-5 w-5" />
              </span>
              <span><strong className="text-sidebar-foreground">Tasks & follow-ups</strong> — Never miss a touchpoint</span>
            </li>
            <li className="flex items-center gap-3 text-sidebar-foreground/90">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/20 text-success">
                <Zap className="h-5 w-5" />
              </span>
              <span><strong className="text-sidebar-foreground">Activity timeline</strong> — Calls, emails, meetings in one log</span>
            </li>
            <li className="flex items-center gap-3 text-sidebar-foreground/90">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary/20 text-sidebar-primary">
                <Shield className="h-5 w-5" />
              </span>
              <span><strong className="text-sidebar-foreground">Secure & role-based</strong> — Admin controls and team visibility</span>
            </li>
          </ul>
          <p className="text-sidebar-foreground/50 text-sm pt-4 animate-fade-in-up animate-fade-in-up-delay-2">
            Trusted by teams to centralize vendor and lead workflows.
          </p>
          <a
            href="https://cuephoriatech.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg py-2 px-3 text-sm font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground/90 hover:bg-sidebar-accent/30 transition-all duration-200 border border-sidebar-border/40 animate-fade-in-up animate-fade-in-up-delay-2"
            title="Developed by Cuephoria Tech"
          >
            <span>Developed by Cuephoria Tech</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </a>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_50%,hsl(var(--primary)/0.06),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_70%_at_100%_80%,hsl(var(--accent)/0.05),transparent)]" />
        <div className="w-full max-w-[420px] relative z-10">
          <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5 p-8 sm:p-10 animate-fade-in-up">
            <div className="lg:hidden mb-6">
              <img src="/logo.png" alt="RemoAsset" className="h-9 w-auto object-contain" />
            </div>
            <div className="mb-8">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Welcome back</h2>
              <p className="text-muted-foreground mt-2">Sign in or create an account to continue.</p>
            </div>

            <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/60 p-1 rounded-xl">
              <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">
                Sign up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-8 space-y-5">
              {!forgotMode ? (
                <>
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@company.com"
                          value={loginForm.email}
                          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                          className="pl-10 h-11 rounded-xl border-border/80 bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
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
                          className="pl-10 pr-10 h-11 rounded-xl border-border/80 bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
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
                      className="w-full h-11 rounded-xl gradient-primary text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 hover:opacity-95"
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Sign in
                    </Button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => { setForgotMode(true); setForgotSent(false); setForgotEmail(loginForm.email); }}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Forgot your password?
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="space-y-5 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setForgotSent(false); }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </button>

                  {forgotSent ? (
                    <div className="text-center py-6 space-y-4">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/10">
                        <CheckCircle2 className="h-7 w-7 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Check your email</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          We sent a password reset link to <strong>{forgotEmail}</strong>. Click the link in the email to set a new password.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="mt-2"
                        onClick={() => { setForgotMode(false); setForgotSent(false); }}
                      >
                        Back to sign in
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-5">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold">Reset your password</h3>
                        <p className="text-sm text-muted-foreground">
                          Enter your email address and we&apos;ll send you a link to reset your password.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email" className="text-sm font-medium">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="you@company.com"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            className="pl-10 h-11 rounded-xl border-border/80 bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
                            autoFocus
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full h-11 rounded-xl gradient-primary text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 hover:opacity-95"
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

            <TabsContent value="signup" className="mt-8 space-y-5">
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
                      className="pl-10 h-11 rounded-xl border-border/80 bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
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
                      className="pl-10 h-11 rounded-xl border-border/80 bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
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
                      className="pl-10 pr-10 h-11 rounded-xl border-border/80 bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
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
                    {PASSWORD_REQUIREMENTS.map((req) => (
                      <li key={req}>{req}</li>
                    ))}
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
                      className="pl-10 pr-10 h-11 rounded-xl border-border/80 bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
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
                  className="w-full h-11 rounded-xl gradient-primary text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 hover:opacity-95"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          </div>
          <a
            href="https://cuephoriatech.in"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            title="Developed by Cuephoria Tech"
          >
            <span>Developed by Cuephoria Tech</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </a>
        </div>
      </div>
    </div>
    </>
  );
}
