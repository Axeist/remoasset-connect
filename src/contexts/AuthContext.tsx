import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'employee';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  googleAccessToken: string | null;
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
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
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      captureProviderToken(session, setGoogleAccessToken);

      if (!session?.provider_token) {
        const storedGoogleToken = localStorage.getItem('google_access_token');
        if (storedGoogleToken) {
          setGoogleAccessToken(storedGoogleToken);
        }
      }
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
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
    const allowedDomain = 'remoasset.com';
    if (!email.toLowerCase().endsWith(`@${allowedDomain}`)) {
      return { error: new Error('Sign up is only allowed with a @remoasset.com email address.') };
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
        scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    disconnectGoogleCalendar();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, googleAccessToken, signUp, signIn, signOut, connectGoogleCalendar, disconnectGoogleCalendar }}>
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
