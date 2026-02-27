import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface CurrentUserProfile {
  fullName: string | null;
  designation: string | null;
  avatarUrl: string | null;
}

export function useCurrentUserProfile(): CurrentUserProfile {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CurrentUserProfile>({
    fullName: null,
    designation: null,
    avatarUrl: null,
  });

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile({ fullName: null, designation: null, avatarUrl: null });
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('full_name, designation, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    setProfile({
      fullName: (data as { full_name?: string } | null)?.full_name ?? null,
      designation: (data as { designation?: string } | null)?.designation ?? null,
      avatarUrl: (data as { avatar_url?: string } | null)?.avatar_url ?? null,
    });
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return profile;
}
