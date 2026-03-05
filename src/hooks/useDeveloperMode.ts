import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cache: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

export function notifyDeveloperModeChange(value: boolean) {
  cache = value;
  listeners.forEach((fn) => fn(value));
}

export function useDeveloperMode() {
  const [enabled, setEnabled] = useState<boolean>(cache ?? false);

  useEffect(() => {
    const listener = (v: boolean) => setEnabled(v);
    listeners.add(listener);

    if (cache === null) {
      supabase
        .from('app_settings')
        .select('developer_mode_enabled')
        .limit(1)
        .single()
        .then(({ data }) => {
          const val = data?.developer_mode_enabled ?? false;
          cache = val;
          listeners.forEach((fn) => fn(val));
        });
    }

    return () => { listeners.delete(listener); };
  }, []);

  return enabled;
}
