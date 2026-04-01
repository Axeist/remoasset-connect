import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'employee';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  googleAccessToken: string | null;
  allowedEmailDomain: string;
  allowedEmailDomains: string[];
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; user?: User | null }>;
  signOut: () => Promise<void>;
  connectGoogleCalendar: () => Promise<void>;
  disconnectGoogleCalendar: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function captureProviderToken(session: Session | null, setToken: (t: string | null) => void) {
  if (session?.provider_token) {
    setToken(session.provider_token);
    localStorage.setItem('google_access_token', session.provider_token);
    localStorage.setItem('google_token_ts', String(Date.now()));
  }
  if (session?.provider_refresh_token) {
    localStorage.setItem('google_refresh_token', session.provider_refresh_token);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [allowedEmailDomain, setAllowedEmailDomain] = useState('remoasset.com');
  // Ref keeps the auth subscription from capturing a stale value
  const allowedEmailDomainRef = useRef('remoasset.com');
  const intentionalSignOut = useRef(false);

  // Helper: parse comma-separated domain string into a trimmed lowercase array
  const parseDomains = (raw: string) =>
    raw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

  // Load the allowed domain(s) from app_settings (falls back to hardcoded default)
  useEffect(() => {
    supabase
      .from('app_settings')
      .select('allowed_email_domain')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.allowed_email_domain) {
          setAllowedEmailDomain(data.allowed_email_domain);
          allowedEmailDomainRef.current = data.allowed_email_domain;
        }
      });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Block any Google (or other OAuth) sign-in from non-allowed-domain accounts
        if (session?.user) {
          const email = session.user.email ?? '';
          const isOAuth = session.user.app_metadata?.provider !== 'email';
          const allowedDomains = parseDomains(allowedEmailDomainRef.current);
          const domainAllowed = allowedDomains.some((d) => email.toLowerCase().endsWith(`@${d}`));
          if (isOAuth && !domainAllowed) {
            await supabase.auth.signOut();
            window.dispatchEvent(new CustomEvent('auth:domain-blocked', { detail: { email, allowedDomains } }));
            setLoading(false);
            return;
          }
        }

        // On TOKEN_REFRESHED, just update tokens — don't clear state
        if (event === 'TOKEN_REFRESHED') {
          captureProviderToken(session, setGoogleAccessToken);
          setSession(session);
          return;
        }

        // SIGNED_OUT fired by Supabase can happen when a provider token (Google)
        // expires mid-session even though the Supabase session itself is still valid.
        // Only treat it as a real logout if there's no active session recoverable.
        if (event === 'SIGNED_OUT') {
          // Skip recovery check if we triggered sign-out intentionally
          if (intentionalSignOut.current) {
            intentionalSignOut.current = false;
            setSession(null);
            setUser(null);
            setRole(null);
            setGoogleAccessToken(null);
            setLoading(false);
            return;
          }
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            // Session still alive — this was a provider token event, not a real logout
            captureProviderToken(currentSession, setGoogleAccessToken);
            setSession(currentSession);
            setUser(currentSession.user);
            return;
          }
          // Genuine sign-out
          setSession(null);
          setUser(null);
          setRole(null);
          setGoogleAccessToken(null);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        captureProviderToken(session, setGoogleAccessToken);

        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
        }
        // Always mark loading done once we have an auth state
        setLoading(false);
      }
    );

    // Initial session check — also handles page load after OAuth redirect
    supabase.auth.getSession().then(({ data: { session } }) => {
      // onAuthStateChange will fire for this session too, so just handle tokens/loading here
      captureProviderToken(session, setGoogleAccessToken);

      if (!session?.provider_token) {
        const storedGoogleToken = localStorage.getItem('google_access_token');
        if (storedGoogleToken) {
          setGoogleAccessToken(storedGoogleToken);
        }
      }
      // Only set loading false here if onAuthStateChange hasn't already
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      setRole(data.role as AppRole);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const allowedDomains = parseDomains(allowedEmailDomain);
    const domainAllowed = allowedDomains.some((d) => email.toLowerCase().endsWith(`@${d}`));
    if (!domainAllowed) {
      const domainList = allowedDomains.map((d) => `@${d}`).join(' or ');
      return { error: new Error(`Sign up is only allowed with a ${domainList} email address.`) };
    }
    const redirectUrl = `${window.location.origin}/auth?verified=true`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) return { error: error as Error | null };
    return { error: null, user: data.user };
  };

  const connectGoogleCalendar = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.modify',
        redirectTo: `${window.location.origin}/settings`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  };

  const disconnectGoogleCalendar = () => {
    setGoogleAccessToken(null);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_ts');
    localStorage.removeItem('google_refresh_token');
  };

  const signOut = async () => {
    intentionalSignOut.current = true;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    disconnectGoogleCalendar();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, googleAccessToken, allowedEmailDomain, allowedEmailDomains: parseDomains(allowedEmailDomain), signUp, signIn, signOut, connectGoogleCalendar, disconnectGoogleCalendar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
