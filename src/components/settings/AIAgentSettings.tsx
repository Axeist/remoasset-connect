import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Play, CheckCircle2, XCircle, Plus, Trash2 } from 'lucide-react';

interface RegionConfig {
  region: string;
  enabled: boolean;
  count: number;
}

interface VendorTypeConfig {
  type: string;
  enabled: boolean;
  label: string;
}

interface AIAgentSettingsData {
  ai_enabled: boolean;
  ai_model: string;
  ai_max_tokens: number;
  ai_temperature: number;
  vendor_cron_enabled: boolean;
  vendor_cron_schedule: string;
  vendor_cron_last_run: string | null;
  vendor_cron_last_run_count: number | null;
  vendor_cron_regions: RegionConfig[];
  vendor_cron_types: VendorTypeConfig[];
  vendor_email_enabled: boolean;
  vendor_email_from_name: string;
  vendor_email_from_address: string;
  vendor_email_reply_to: string;
  vendor_email_cc: string;
  vendor_email_subject_template: string;
  vendor_email_tone: string;
  agni_agent_user_id: string | null;
  vendor_default_status_id: string | null;
  vendor_auto_assign: boolean;
  vendor_dedup_enabled: boolean;
  vendor_dedup_window_days: number;
  slack_notify_vendor_discovered: boolean;
  slack_notify_vendor_email_sent: boolean;
  slack_notify_cron_summary: boolean;
}

const DEFAULT_SETTINGS: AIAgentSettingsData = {
  ai_enabled: true,
  ai_model: 'claude-haiku-4-5-20251001',
  ai_max_tokens: 4096,
  ai_temperature: 0.7,
  vendor_cron_enabled: false,
  vendor_cron_schedule: '0 9 * * *',
  vendor_cron_last_run: null,
  vendor_cron_last_run_count: null,
  vendor_cron_regions: [
    { region: 'APAC', enabled: true, count: 20 },
    { region: 'US', enabled: true, count: 20 },
    { region: 'EU', enabled: true, count: 20 },
    { region: 'LATAM', enabled: false, count: 10 },
    { region: 'MEA', enabled: false, count: 10 },
  ],
  vendor_cron_types: [
    { type: 'refurbished', enabled: true, label: 'Refurbished Devices' },
    { type: 'new_device', enabled: true, label: 'New Devices' },
    { type: 'rental', enabled: true, label: 'Rental' },
    { type: 'warehouse', enabled: false, label: 'Warehouse & Storage' },
  ],
  vendor_email_enabled: true,
  vendor_email_from_name: 'RemoAsset Procurement',
  vendor_email_from_address: 'outreach@remoasset.in',
  vendor_email_reply_to: '',
  vendor_email_cc: 'ranjith@remoasset.com',
  vendor_email_subject_template: 'Partnership Inquiry — IT Device Procurement | RemoAsset',
  vendor_email_tone: 'professional',
  agni_agent_user_id: null,
  vendor_default_status_id: null,
  vendor_auto_assign: false,
  vendor_dedup_enabled: true,
  vendor_dedup_window_days: 90,
  slack_notify_vendor_discovered: true,
  slack_notify_vendor_email_sent: true,
  slack_notify_cron_summary: true,
};

const AI_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 3.5 — Fast & economical (~$7/mo)' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Sonnet 3.5 — Balanced quality (~$40/mo)' },
  { value: 'claude-3-opus-20240229', label: 'Opus 3 — Most capable (~$200/mo)' },
];

const EMAIL_TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'concise', label: 'Concise' },
  { value: 'formal', label: 'Formal' },
];

interface AIAgentSettingsProps {
  onRunNow?: () => void;
  runNowLoading?: boolean;
}

export function AIAgentSettings({ onRunNow, runNowLoading }: AIAgentSettingsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AIAgentSettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadSettings();
    loadProfiles();
    loadStatuses();
  }, []);

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      toast({ title: 'Failed to load settings', variant: 'destructive' });
    } else if (data) {
      setSettingsId(data.id);
      setSettings((prev) => ({
        ...prev,
        ai_enabled: data.ai_enabled ?? prev.ai_enabled,
        ai_model: data.ai_model ?? prev.ai_model,
        ai_max_tokens: data.ai_max_tokens ?? prev.ai_max_tokens,
        ai_temperature: Number(data.ai_temperature ?? prev.ai_temperature),
        vendor_cron_enabled: data.vendor_cron_enabled ?? prev.vendor_cron_enabled,
        vendor_cron_schedule: data.vendor_cron_schedule ?? prev.vendor_cron_schedule,
        vendor_cron_last_run: data.vendor_cron_last_run ?? null,
        vendor_cron_last_run_count: data.vendor_cron_last_run_count ?? null,
        vendor_cron_regions: (data.vendor_cron_regions as RegionConfig[]) ?? prev.vendor_cron_regions,
        vendor_cron_types: (data.vendor_cron_types as VendorTypeConfig[]) ?? prev.vendor_cron_types,
        vendor_email_enabled: data.vendor_email_enabled ?? prev.vendor_email_enabled,
        vendor_email_from_name: data.vendor_email_from_name ?? prev.vendor_email_from_name,
        vendor_email_from_address: data.vendor_email_from_address ?? prev.vendor_email_from_address,
        vendor_email_reply_to: data.vendor_email_reply_to ?? '',
        vendor_email_cc: data.vendor_email_cc ?? 'ranjith@remoasset.com',
        vendor_email_subject_template: data.vendor_email_subject_template ?? prev.vendor_email_subject_template,
        vendor_email_tone: data.vendor_email_tone ?? prev.vendor_email_tone,
        agni_agent_user_id: data.agni_agent_user_id ?? null,
        vendor_default_status_id: data.vendor_default_status_id ?? null,
        vendor_auto_assign: data.vendor_auto_assign ?? prev.vendor_auto_assign,
        vendor_dedup_enabled: data.vendor_dedup_enabled ?? prev.vendor_dedup_enabled,
        vendor_dedup_window_days: data.vendor_dedup_window_days ?? prev.vendor_dedup_window_days,
        slack_notify_vendor_discovered: data.slack_notify_vendor_discovered ?? prev.slack_notify_vendor_discovered,
        slack_notify_vendor_email_sent: data.slack_notify_vendor_email_sent ?? prev.slack_notify_vendor_email_sent,
        slack_notify_cron_summary: data.slack_notify_cron_summary ?? prev.slack_notify_cron_summary,
      }));
    }
    setLoading(false);
  }

  async function loadProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name');
    setProfiles(data || []);
  }

  async function loadStatuses() {
    const { data } = await supabase
      .from('lead_statuses')
      .select('id, name')
      .order('sort_order');
    setStatuses(data || []);
  }

  async function save() {
    setSaving(true);

    const payload = {
      ai_enabled: settings.ai_enabled,
      ai_model: settings.ai_model,
      ai_max_tokens: settings.ai_max_tokens,
      ai_temperature: settings.ai_temperature,
      vendor_cron_enabled: settings.vendor_cron_enabled,
      vendor_cron_schedule: settings.vendor_cron_schedule,
      vendor_cron_regions: settings.vendor_cron_regions,
      vendor_cron_types: settings.vendor_cron_types,
      vendor_email_enabled: settings.vendor_email_enabled,
      vendor_email_from_name: settings.vendor_email_from_name,
      vendor_email_from_address: settings.vendor_email_from_address,
      vendor_email_reply_to: settings.vendor_email_reply_to || null,
      vendor_email_cc: settings.vendor_email_cc || null,
      vendor_email_subject_template: settings.vendor_email_subject_template,
      vendor_email_tone: settings.vendor_email_tone,
      agni_agent_user_id: settings.agni_agent_user_id || null,
      vendor_default_status_id: settings.vendor_default_status_id || null,
      vendor_auto_assign: settings.vendor_auto_assign,
      vendor_dedup_enabled: settings.vendor_dedup_enabled,
      vendor_dedup_window_days: settings.vendor_dedup_window_days,
      slack_notify_vendor_discovered: settings.slack_notify_vendor_discovered,
      slack_notify_vendor_email_sent: settings.slack_notify_vendor_email_sent,
      slack_notify_cron_summary: settings.slack_notify_cron_summary,
    };

    let error;
    if (settingsId) {
      // Update existing row by primary key
      ({ error } = await supabase.from('app_settings').update(payload).eq('id', settingsId));
    } else {
      // No row yet — insert one
      const { data: inserted, error: insertError } = await supabase
        .from('app_settings')
        .insert(payload)
        .select('id')
        .single();
      error = insertError;
      if (inserted?.id) setSettingsId(inserted.id);
    }

    if (error) {
      toast({ title: 'Failed to save settings', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Settings saved', description: 'AI Agent settings updated successfully.' });
    }
    setSaving(false);
  }

  function updateRegion(index: number, field: keyof RegionConfig, value: any) {
    const updated = [...settings.vendor_cron_regions];
    updated[index] = { ...updated[index], [field]: value };
    setSettings((s) => ({ ...s, vendor_cron_regions: updated }));
  }

  function addRegion() {
    setSettings((s) => ({
      ...s,
      vendor_cron_regions: [...s.vendor_cron_regions, { region: '', enabled: true, count: 10 }],
    }));
  }

  function removeRegion(index: number) {
    setSettings((s) => ({
      ...s,
      vendor_cron_regions: s.vendor_cron_regions.filter((_, i) => i !== index),
    }));
  }

  function updateVendorType(index: number, enabled: boolean) {
    const updated = [...settings.vendor_cron_types];
    updated[index] = { ...updated[index], enabled };
    setSettings((s) => ({ ...s, vendor_cron_types: updated }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Claude AI */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Claude AI</CardTitle>
              <CardDescription>Configure the AI model used for vendor discovery and email drafting</CardDescription>
            </div>
            <Switch
              checked={settings.ai_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, ai_enabled: v }))}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Select value={settings.ai_model} onValueChange={(v) => setSettings((s) => ({ ...s, ai_model: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                min={512}
                max={8192}
                value={settings.ai_max_tokens}
                onChange={(e) => setSettings((s) => ({ ...s, ai_max_tokens: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Temperature: {settings.ai_temperature} <span className="text-muted-foreground text-xs">(0 = precise, 1 = creative)</span></Label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.ai_temperature}
              onChange={(e) => setSettings((s) => ({ ...s, ai_temperature: Number(e.target.value) }))}
              className="w-full accent-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Daily Automation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Daily Automation</CardTitle>
              <CardDescription>Automatically discover vendors every day via GitHub Actions cron</CardDescription>
            </div>
            <Switch
              checked={settings.vendor_cron_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, vendor_cron_enabled: v }))}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cron Schedule (UTC)</Label>
              <Input
                value={settings.vendor_cron_schedule}
                onChange={(e) => setSettings((s) => ({ ...s, vendor_cron_schedule: e.target.value }))}
                placeholder="0 9 * * *"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Default: 9:00 AM UTC daily</p>
            </div>
            <div className="space-y-1.5">
              <Label>Last Run</Label>
              <div className="text-sm text-muted-foreground pt-2">
                {settings.vendor_cron_last_run
                  ? <>
                      {new Date(settings.vendor_cron_last_run).toLocaleString()}
                      {settings.vendor_cron_last_run_count !== null &&
                        <Badge variant="secondary" className="ml-2">{settings.vendor_cron_last_run_count} leads</Badge>
                      }
                    </>
                  : 'Never run'
                }
              </div>
            </div>
          </div>
          {onRunNow && (
            <Button variant="outline" size="sm" onClick={onRunNow} disabled={runNowLoading}>
              {runNowLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Run Now
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Regions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Regions</CardTitle>
          <CardDescription>Configure which regions to search and how many vendors per region per day</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.vendor_cron_regions.map((r, i) => (
            <div key={i} className="flex items-center gap-3">
              <Switch
                checked={r.enabled}
                onCheckedChange={(v) => updateRegion(i, 'enabled', v)}
              />
              <Input
                value={r.region}
                onChange={(e) => updateRegion(i, 'region', e.target.value)}
                className="w-32 font-medium"
                placeholder="Region"
              />
              <div className="flex items-center gap-2 flex-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">vendors/day:</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={r.count}
                  onChange={(e) => updateRegion(i, 'count', Number(e.target.value))}
                  className="w-20"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeRegion(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRegion}>
            <Plus className="h-4 w-4 mr-2" />
            Add Region
          </Button>
        </CardContent>
      </Card>

      {/* Vendor Types */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vendor Types</CardTitle>
          <CardDescription>Which types of vendors to search for in each cron run</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.vendor_cron_types.map((t, i) => (
            <div key={t.type} className="flex items-center gap-3">
              <Switch
                checked={t.enabled}
                onCheckedChange={(v) => updateVendorType(i, v)}
              />
              <Label className="font-medium">{t.label}</Label>
              <Badge variant="outline" className="text-xs font-mono">{t.type}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Outreach Email */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Outreach Email</CardTitle>
              <CardDescription>Configure how outreach emails are sent via Resend</CardDescription>
            </div>
            <Switch
              checked={settings.vendor_email_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, vendor_email_enabled: v }))}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>From Name</Label>
              <Input
                value={settings.vendor_email_from_name}
                onChange={(e) => setSettings((s) => ({ ...s, vendor_email_from_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>From Address</Label>
              <Input
                value={settings.vendor_email_from_address}
                onChange={(e) => setSettings((s) => ({ ...s, vendor_email_from_address: e.target.value }))}
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reply-To <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={settings.vendor_email_reply_to}
                onChange={(e) => setSettings((s) => ({ ...s, vendor_email_reply_to: e.target.value }))}
                type="email"
                placeholder="sales@remoasset.in"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CC <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
              <Input
                value={settings.vendor_email_cc}
                onChange={(e) => setSettings((s) => ({ ...s, vendor_email_cc: e.target.value }))}
                placeholder="ranjith@remoasset.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email Tone</Label>
              <Select value={settings.vendor_email_tone} onValueChange={(v) => setSettings((s) => ({ ...s, vendor_email_tone: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Default Subject Template</Label>
            <Input
              value={settings.vendor_email_subject_template}
              onChange={(e) => setSettings((s) => ({ ...s, vendor_email_subject_template: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lead Assignment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lead Assignment</CardTitle>
          <CardDescription>Configure how discovered vendor leads are assigned</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Agent Owner (Agni)</Label>
              <Select
                value={settings.agni_agent_user_id || 'none'}
                onValueChange={(v) => setSettings((s) => ({ ...s, agni_agent_user_id: v === 'none' ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || p.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default Stage</Label>
              <Select
                value={settings.vendor_default_status_id || 'none'}
                onValueChange={(v) => setSettings((s) => ({ ...s, vendor_default_status_id: v === 'none' ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((st) => (
                    <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Duplicate Prevention */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Duplicate Prevention</CardTitle>
              <CardDescription>Skip vendors already discovered within the time window</CardDescription>
            </div>
            <Switch
              checked={settings.vendor_dedup_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, vendor_dedup_enabled: v }))}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label className="whitespace-nowrap">Skip if seen within</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={settings.vendor_dedup_window_days}
              onChange={(e) => setSettings((s) => ({ ...s, vendor_dedup_window_days: Number(e.target.value) }))}
              className="w-24"
            />
            <Label>days</Label>
          </div>
        </CardContent>
      </Card>

      {/* Slack Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Slack Notifications</CardTitle>
          <CardDescription>Control which AI agent events post to Slack</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'slack_notify_vendor_discovered' as const, label: 'New vendor lead created' },
            { key: 'slack_notify_vendor_email_sent' as const, label: 'Outreach email sent' },
            { key: 'slack_notify_cron_summary' as const, label: 'Daily cron summary' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <Switch
                checked={settings[key]}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, [key]: v }))}
              />
              <Label>{label}</Label>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
