import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PASSWORD_REQUIREMENTS } from '@/pages/Auth';
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, ExternalLink } from 'lucide-react';

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

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
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

    // Sign out so user must login with the new password
    await supabase.auth.signOut();
    setIsLoading(false);
    setSuccess(true);
  };

  if (!sessionReady && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5 p-8 sm:p-10 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Verifying your reset link...</p>
            <p className="text-xs text-muted-foreground">
              If this takes too long, the link may have expired.{' '}
              <button
                onClick={() => navigate('/auth')}
                className="text-primary hover:underline font-medium"
              >
                Request a new one
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_50%,hsl(var(--primary)/0.06),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_70%_at_100%_80%,hsl(var(--accent)/0.05),transparent)]" />

      <div className="w-full max-w-[420px] relative z-10">
        <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5 p-8 sm:p-10 animate-fade-in-up">
          <div className="mb-6">
            <img src="/logo.png" alt="RemoAsset" className="h-9 w-auto object-contain" />
          </div>

          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/10">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Password updated</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your password has been changed successfully. Please sign in with your new password.
                </p>
              </div>
              <Button
                className="w-full h-11 rounded-xl gradient-primary text-white font-medium"
                onClick={() => navigate('/auth')}
              >
                Sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  Set new password
                </h2>
                <p className="text-muted-foreground mt-2">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm font-medium">New password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 rounded-xl border-border/80 bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
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
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                    {PASSWORD_REQUIREMENTS.map((req) => (
                      <li key={req}>{req}</li>
                    ))}
                  </ul>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

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
                      className="pl-10 pr-10 h-11 rounded-xl border-border/80 bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-shadow"
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
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl gradient-primary text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 hover:opacity-95"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update password
                </Button>
              </form>
            </>
          )}
        </div>
        <a
          href="https://cuephoriatech.in"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Developed by Cuephoria Tech</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </a>
      </div>
    </div>
  );
}
