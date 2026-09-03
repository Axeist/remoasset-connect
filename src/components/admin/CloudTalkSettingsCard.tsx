import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Check, Copy, ExternalLink, Loader2, Phone, RefreshCw,
} from 'lucide-react';

type Agent = { id: number; name: string; email: string | null; availability: string | null };
type NumberRow = { id: number | null; e164: string; name: string | null };
type Member = { user_id: string; full_name: string | null; email: string | null; cloudtalk_agent_id: number | null };

export function CloudTalkSettingsCard() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [fromNumber, setFromNumber] = useState('');
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [apiConfigured, setApiConfigured] = useState(false);
  const [copied, setCopied] = useState<'url' | 'secret' | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [numbers, setNumbers] = useState<NumberRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const loadLocal = async () => {
    const { data } = await supabase
      .from('app_settings' as never)
      .select('id, cloudtalk_enabled, cloudtalk_default_from_e164')
      .limit(1)
      .maybeSingle();
    const row = data as { id: string; cloudtalk_enabled?: boolean; cloudtalk_default_from_e164?: string | null } | null;
    if (row) {
      setSettingsId(row.id);
      setEnabled(Boolean(row.cloudtalk_enabled));
      setFromNumber(row.cloudtalk_default_from_e164 ?? '');
    }
  };

  const loadRemote = async () => {
    const { data, error } = await supabase.functions.invoke('cloudtalk-admin', { body: { action: 'status' } });
    if (error) throw error;
    setWebhookUrl(data?.webhook_url ?? '');
    setWebhookSecret(data?.webhook_secret ?? '');
    setApiConfigured(Boolean(data?.api_configured));
  };

  const loadTeam = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id');
    const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    if (!ids.length) return;
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, cloudtalk_agent_id')
      .in('user_id', ids);
    const { data: auth } = await supabase.functions.invoke('manage-user', { body: { action: 'list_users' } });
    const emailMap: Record<string, string> = {};
    for (const u of auth?.users ?? []) emailMap[u.id] = u.email;
    setMembers((profiles ?? []).map((p: { user_id: string; full_name: string | null; cloudtalk_agent_id?: number | null }) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      email: emailMap[p.user_id] ?? null,
      cloudtalk_agent_id: p.cloudtalk_agent_id ?? null,
    })));
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadLocal(), loadRemote().catch(() => null), loadTeam()]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copy = async (kind: 'url' | 'secret', value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      cloudtalk_enabled: enabled,
      cloudtalk_default_from_e164: fromNumber.trim() || null,
    };
    try {
      if (settingsId) {
        const { error } = await supabase.from('app_settings' as never).update(payload as never).eq('id', settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('app_settings' as never).insert(payload as never).select('id').single();
        if (error) throw error;
        setSettingsId((data as { id: string }).id);
      }
      toast({ title: 'CloudTalk settings saved' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not save', description: (e as Error).message });
    }
    setSaving(false);
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('cloudtalk-admin', { body: { action: 'test' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Connected to CloudTalk', description: `${data.agent_count ?? 0} agents found.` });
      const agentsRes = await supabase.functions.invoke('cloudtalk-admin', { body: { action: 'agents' } });
      if (agentsRes.data?.agents) setAgents(agentsRes.data.agents);
      const nums = await supabase.functions.invoke('cloudtalk-admin', { body: { action: 'numbers' } });
      if (nums.data?.numbers) setNumbers(nums.data.numbers);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'CloudTalk API not reachable',
        description: (e as Error).message ?? 'Set CLOUDTALK_API_KEY_ID and CLOUDTALK_API_KEY_SECRET on the function secrets.',
      });
    }
    setTesting(false);
  };

  const mapAgent = async (userId: string, agentId: string) => {
    const value = agentId === 'none' ? null : Number(agentId);
    const { error } = await supabase.from('profiles').update({ cloudtalk_agent_id: value } as never).eq('user_id', userId);
    if (error) {
      toast({ variant: 'destructive', title: 'Could not map agent', description: error.message });
      return;
    }
    setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, cloudtalk_agent_id: value } : m)));
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading CloudTalk…
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-violet-500/20 h-full">
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/[0.06] rounded-full -translate-y-1/3 translate-x-1/3" />
      <div className="relative p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/25">
              <Phone className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-base">CloudTalk</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Click-to-call on lead phones and auto-log calls</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {enabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />On
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
                Off
              </span>
            )}
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <div className="space-y-2">
          {[
            'Click-to-call on lead phones (E.164 + Chrome extension)',
            'Calls and wrap-up notes log on the lead',
            'Listen or download recordings in the browser',
          ].map((text) => (
            <div key={text} className="flex items-start gap-2 text-sm text-muted-foreground">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-violet-500/10 mt-0.5">
                <Check className="h-3 w-3 text-violet-600" />
              </div>
              {text}
            </div>
          ))}
        </div>

        {enabled && (
          <div className="space-y-3 pt-2 border-t border-violet-500/15">
            <p className="text-xs text-muted-foreground">
              <a className="underline font-medium text-violet-700 dark:text-violet-300" href="https://chromewebstore.google.com/detail/cloudtalk-click-to-call/mbgbeafnenfaffpbpkincpgpepjhekbm" target="_blank" rel="noreferrer">
                Click to Call extension
              </a>
              {' '}and CloudTalk Desktop required. Numbers need a leading + country code.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Test API
              </Button>
              <span className="text-xs text-muted-foreground self-center">
                {apiConfigured ? 'API keys detected on the server.' : 'Add CLOUDTALK_API_KEY_ID and CLOUDTALK_API_KEY_SECRET to Edge Function secrets.'}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label>Default outbound number (optional)</Label>
              {numbers.length > 0 ? (
                <Select value={fromNumber || 'none'} onValueChange={(v) => setFromNumber(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="CloudTalk default" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Agent default</SelectItem>
                    {numbers.map((n) => (
                      <SelectItem key={n.e164} value={n.e164}>{n.name ? `${n.name} · ${n.e164}` : n.e164}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} placeholder="+442012345678" />
              )}
              <p className="text-[11px] text-muted-foreground">Used as <code className="text-[10px]">from=</code> on ct+tel links. Must be assigned to the agent in CloudTalk.</p>
            </div>

            <div className="space-y-3">
              <CopyField label="Webhook URL" value={webhookUrl} copied={copied === 'url'} onCopy={() => copy('url', webhookUrl)} />
              <CopyField label="Webhook secret" value={webhookSecret} copied={copied === 'secret'} onCopy={() => copy('secret', webhookSecret)} secret />
            </div>

            {agents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Map Connect users to CloudTalk agents</h4>
                <div className="rounded-lg border overflow-hidden max-h-40 overflow-y-auto">
                  {members.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3 px-3 py-2 border-b last:border-0 bg-card">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.full_name || 'User'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                      </div>
                      <Select
                        value={m.cloudtalk_agent_id != null ? String(m.cloudtalk_agent_id) : 'none'}
                        onValueChange={(v) => mapAgent(m.user_id, v)}
                      >
                        <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Agent" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not mapped</SelectItem>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)}>{a.name}{a.email ? ` · ${a.email}` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {agents.length === 0 && (
              <p className="text-xs text-muted-foreground">Run Test API to load agents, then map each salesperson.</p>
            )}

            <div className="flex gap-2">
              <Button onClick={save} disabled={saving} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save CloudTalk
              </Button>
              <Button variant="outline" size="sm" className="gap-1" asChild>
                <a href="https://dashboard.cloudtalk.io/menu/account/settings/API-keys" target="_blank" rel="noreferrer">
                  API keys <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        )}

        {!enabled && (
          <Button onClick={() => { setEnabled(true); }} variant="outline" className="gap-2">
            Enable CloudTalk
          </Button>
        )}
      </div>
    </div>
  );
}

function CopyField({
  label, value, copied, onCopy, secret,
}: {
  label: string; value: string; copied: boolean; onCopy: () => void; secret?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} type={secret ? 'password' : 'text'} className="font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" onClick={onCopy} disabled={!value} title="Copy">
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
