import { Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { cloudtalkDialHref, toE164Display } from '@/lib/phone';
import { recordCloudTalkDialIntent } from '@/lib/cloudtalk';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Settings = { enabled: boolean; from: string | null };

let cached: Settings | null = null;
let inflight: Promise<Settings> | null = null;

async function loadSettings(): Promise<Settings> {
  if (cached) return cached;
  if (!inflight) {
    inflight = supabase
      .from('app_settings')
      .select('cloudtalk_enabled, cloudtalk_default_from_e164')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        cached = {
          enabled: Boolean((data as { cloudtalk_enabled?: boolean } | null)?.cloudtalk_enabled),
          from: (data as { cloudtalk_default_from_e164?: string | null } | null)?.cloudtalk_default_from_e164 ?? null,
        };
        return cached;
      })
      .catch(() => ({ enabled: false, from: null }));
  }
  return inflight;
}

interface CloudTalkPhoneLinkProps {
  phone: string | null | undefined;
  iso2?: string | null;
  leadId?: string;
  className?: string;
  compact?: boolean;
}

export function CloudTalkPhoneLink({ phone, iso2, leadId, className, compact }: CloudTalkPhoneLinkProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(cached ?? { enabled: false, from: null });
  const display = toE164Display(phone, iso2);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  if (!display) return <span className={cn('text-muted-foreground', className)}>—</span>;

  const href = settings.enabled ? cloudtalkDialHref(display, settings.from) : `tel:${display}`;

  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center gap-1 font-medium tabular-nums tracking-tight text-foreground hover:text-primary transition-colors',
        compact ? 'text-xs' : 'text-sm',
        className,
      )}
      title={settings.enabled ? 'Call with CloudTalk' : 'Call'}
      onClick={(e) => {
        e.stopPropagation();
        if (settings.enabled && leadId && user?.id) {
          void recordCloudTalkDialIntent(leadId, display, user.id);
        }
      }}
    >
      <Phone className={cn('shrink-0 text-violet-500', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      <span>{display}</span>
    </a>
  );
}

