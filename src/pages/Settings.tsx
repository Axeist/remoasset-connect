import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import {
  User, Puzzle, Bell, Palette, Mail, Phone, Loader2, Check,
  ExternalLink, Zap, Shield, RefreshCw, Sun, Moon, Monitor,
  BellRing, BellOff, AtSign, Calendar, MessageSquare,
} from 'lucide-react';

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  designation: string | null;
  phone: string | null;
  avatar_url: string | null;
  updated_at: string;
}

type Tab = 'profile' | 'integrations' | 'notifications' | 'appearance';

const NAV_ITEMS: { id: Tab; icon: React.ElementType; label: string; desc: string }[] = [
  { id: 'profile', icon: User, label: 'Profile', desc: 'Your personal info' },
  { id: 'integrations', icon: Puzzle, label: 'Integrations', desc: 'Connected services' },
  { id: 'notifications', icon: Bell, label: 'Notifications', desc: 'Alerts & sounds' },
  { id: 'appearance', icon: Palette, label: 'Appearance', desc: 'Theme & display' },
];

const NOTIF_KEY = 'remoasset_notif_prefs';

function loadNotifPrefs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}'); } catch { return {}; }
}
function saveNotifPrefs(prefs: Record<string, boolean>) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
}

export default function Settings() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { connectGoogleCalendar } = useAuth();
  const { isConnected } = useGoogleCalendar();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile state
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() => {
    const saved = loadNotifPrefs();
    return {
      email_reply: saved.email_reply ?? true,
      task_due: saved.task_due ?? true,
      follow_up: saved.follow_up ?? true,
      new_lead: saved.new_lead ?? true,
      mention: saved.mention ?? false,
      sound: saved.sound ?? true,
    };
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, designation, phone, avatar_url, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) { toast({ variant: 'destructive', title: 'Error', description: 'Could not load profile' }); }
      const row = data as ProfileRow | null;
      if (row) {
        setFullName(row.full_name ?? '');
        setDesignation(row.designation ?? '');
        setPhone(row.phone ?? '');
        setAvatarUrl(row.avatar_url ?? '');
      }
      setProfileLoading(false);
    })();
  }, [user?.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').upsert({
      user_id: user.id,
      full_name: fullName.trim() || null,
      designation: designation.trim() || null,
      phone: phone.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
  };

  const toggleNotif = (key: string, value: boolean) => {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    saveNotifPrefs(updated);
    toast({ title: value ? 'Notification enabled' : 'Notification disabled', description: key.replace(/_/g, ' ') });
  };

  const initials = ((fullName || user?.email) ?? 'U').slice(0, 2).toUpperCase();

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Manage your profile, integrations, and preferences</p>
        </div>

        {/* Landscape layout */}
        <div className="flex rounded-xl border bg-card overflow-hidden min-h-[580px]">
          {/* Side nav */}
          <div className="w-52 border-r bg-muted/20 shrink-0 flex flex-col py-3 px-2 gap-0.5">
            {/* User summary */}
            <div className="px-3 py-3 mb-2 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{fullName || user?.email?.split('@')[0] || 'You'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{designation || role || 'Member'}</p>
                </div>
              </div>
            </div>

            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group',
                  activeTab === item.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-4 w-4 shrink-0', activeTab === item.id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium leading-none', activeTab === item.id ? 'text-primary' : '')}>{item.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-none truncate">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">

            {/* ── PROFILE ── */}
            {activeTab === 'profile' && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Your Profile</h2>
                  <p className="text-sm text-muted-foreground">This information is shown to teammates and in lead assignments.</p>
                </div>

                {profileLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : (
                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    {/* Avatar + name header */}
                    <div className="flex items-center gap-5 p-4 rounded-xl border bg-muted/20">
                      <Avatar className="h-16 w-16 shrink-0">
                        <AvatarImage src={avatarUrl || undefined} alt={fullName} />
                        <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-base">{fullName || 'Your Name'}</p>
                        <p className="text-sm text-muted-foreground">{designation || 'Add your designation below'}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">{user?.email}</p>
                      </div>
                      <Badge variant="secondary" className="capitalize shrink-0">{role}</Badge>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="s-email">Email</Label>
                        <div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                          <AtSign className="h-4 w-4 shrink-0" />
                          <span className="truncate">{user?.email ?? '—'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Managed by your account</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="s-phone">Phone</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="s-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 8900" className="pl-9" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="s-name">Full Name</Label>
                        <Input id="s-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="s-designation">Designation</Label>
                        <Input id="s-designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Sales Manager" />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="s-avatar">Avatar URL</Label>
                        <Input id="s-avatar" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
                        <p className="text-xs text-muted-foreground">Optional. Paste a link to any image.</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Signed in as</span> {user?.email}
                      </div>
                      <Button type="submit" disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Save changes
                      </Button>
                    </div>
                  </form>
                )}

                {/* Account info */}
                <div className="rounded-xl border p-4 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Account & Security</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Your login and role are managed by your organization.</p>
                  <p className="text-sm text-muted-foreground">To change your password or security settings, use the link sent to your email or contact your admin.</p>
                </div>
              </div>
            )}

            {/* ── INTEGRATIONS ── */}
            {activeTab === 'integrations' && (
              <div className="space-y-4 max-w-2xl">
                <div>
                  <h2 className="text-lg font-semibold">Integrations</h2>
                  <p className="text-sm text-muted-foreground">Connect your account to external services</p>
                </div>

                {/* Google Workspace */}
                <div className="relative overflow-hidden rounded-xl border border-border/60">
                  <div className="absolute top-0 right-0 w-52 h-52 bg-[#4285F4]/[0.03] rounded-full -translate-y-1/3 translate-x-1/3" />
                  <div className="absolute bottom-0 left-0 w-36 h-36 bg-[#34A853]/[0.03] rounded-full translate-y-1/3 -translate-x-1/3" />
                  <div className="relative p-5">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-black/[0.08]">
                          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><path d="M18.316 5.684H5.684v12.632h12.632V5.684z" fill="#fff" /><path d="M18.316 24l5.684-5.684h-5.684V24z" fill="#EA4335" /><path d="M24 5.684V0h-5.684v5.684H24z" fill="#188038" /><path d="M18.316 18.316H24V5.684h-5.684v12.632z" fill="#34A853" /><path d="M0 18.316v5.684h5.684v-5.684H0z" fill="#4285F4" /><path d="M0 5.684h5.684V0H0v5.684z" fill="#FBBC04" /><path d="M0 18.316h5.684V5.684H0v12.632z" fill="#FBBC04" /><path d="M5.684 5.684h12.632V0H5.684v5.684z" fill="#EA4335" opacity=".25" /><path d="M8.954 16.087c-.618-.42-1.044-1.032-1.278-1.836l1.272-.522c.132.504.36.9.684 1.188.324.288.714.432 1.17.432.468 0 .864-.156 1.188-.468.324-.312.486-.702.486-1.17 0-.48-.168-.87-.504-1.176-.336-.306-.756-.456-1.26-.456h-.78v-1.254h.702c.432 0 .798-.138 1.098-.414.3-.276.45-.636.45-1.08 0-.396-.138-.72-.414-.972s-.63-.378-1.062-.378c-.42 0-.756.126-1.008.378-.252.252-.432.564-.54.936l-1.254-.522c.168-.552.492-1.026.972-1.422.48-.396 1.086-.594 1.818-.594.54 0 1.026.114 1.458.342.432.228.768.546 1.008.954.24.408.36.87.36 1.386 0 .528-.114.984-.342 1.368a2.38 2.38 0 01-.882.888v.072c.42.216.77.54 1.05.972.28.432.42.93.42 1.494 0 .564-.144 1.068-.432 1.512a3.01 3.01 0 01-1.17 1.05c-.492.258-1.044.384-1.656.384-.72 0-1.362-.21-1.98-.63zM16.17 8.646l-1.398 1.008-.696-1.056 2.466-1.776h.96V16.2h-1.332V8.646z" fill="#4285F4" /></svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">Google Workspace</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Calendar, Meet & Gmail</p>
                        </div>
                      </div>
                      {isConnected ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34A853]/10 px-3 py-1 text-xs font-semibold text-[#188038] ring-1 ring-[#34A853]/20 shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#34A853] animate-pulse" />Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />Not connected
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      {[
                        { color: '#4285F4', text: 'Calendar events with Google Meet links' },
                        { color: '#34A853', text: 'Send and read Gmail in the Emails tab' },
                        { color: '#FBBC04', text: 'Sync follow-up reminders to calendar' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${item.color}18` }}>
                            <Check className="h-3 w-3" style={{ color: item.color }} />
                          </div>
                          {item.text}
                        </div>
                      ))}
                    </div>

                    {isConnected ? (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 rounded-lg border border-[#34A853]/20 bg-[#34A853]/[0.04] px-3 py-2 flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5 text-[#188038] shrink-0" />
                          <p className="text-xs text-[#188038]/80"><span className="font-medium text-[#188038]">Active.</span> All Google services connected.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={connectGoogleCalendar} className="gap-1.5 text-muted-foreground shrink-0">
                          <RefreshCw className="h-3.5 w-3.5" />Reconnect
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={connectGoogleCalendar} className="gap-2 bg-[#4285F4] hover:bg-[#3367D6] shadow-md shadow-[#4285F4]/20 text-white font-medium">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><path d="M18.316 5.684H5.684v12.632h12.632V5.684z" fill="#fff" /><path d="M18.316 24l5.684-5.684h-5.684V24z" fill="#EA4335" /><path d="M24 5.684V0h-5.684v5.684H24z" fill="#188038" /><path d="M18.316 18.316H24V5.684h-5.684v12.632z" fill="#34A853" /><path d="M0 18.316h5.684V5.684H0v12.632z" fill="#fff" opacity=".6" /></svg>
                        Sign in with Google
                      </Button>
                    )}
                  </div>
                </div>

                {/* Placeholder integrations */}
                {[
                  { name: 'Slack', desc: 'Notifications for new leads, tasks, and activities' },
                  { name: 'Microsoft Teams', desc: 'Collaborate on leads and share updates' },
                ].map((int) => (
                  <div key={int.name} className="rounded-xl border p-4 flex items-center justify-between opacity-60">
                    <div>
                      <p className="text-sm font-medium">{int.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{int.desc}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">Coming soon</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeTab === 'notifications' && (
              <div className="space-y-6 max-w-xl">
                <div>
                  <h2 className="text-lg font-semibold">Notification Preferences</h2>
                  <p className="text-sm text-muted-foreground">Choose which notifications you receive</p>
                </div>

                <div className="rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-muted/30 border-b">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">In-App Alerts</p>
                  </div>
                  {[
                    { key: 'email_reply', icon: Mail, label: 'New email from lead', desc: 'When a lead replies to an email thread' },
                    { key: 'task_due', icon: Calendar, label: 'Task due soon', desc: 'Reminders for tasks approaching their due date' },
                    { key: 'follow_up', icon: BellRing, label: 'Follow-up due', desc: 'When a scheduled follow-up is due' },
                    { key: 'new_lead', icon: User, label: 'New lead assigned', desc: 'When a lead is assigned to you' },
                    { key: 'mention', icon: MessageSquare, label: 'Mentions & comments', desc: 'When someone mentions you in an activity' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between px-4 py-3.5 border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <item.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                        </div>
                      </div>
                      <Switch
                        checked={notifPrefs[item.key] ?? true}
                        onCheckedChange={(v) => toggleNotif(item.key, v)}
                        className="shrink-0 ml-4"
                      />
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-muted/30 border-b">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sound</p>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {notifPrefs.sound ? <BellRing className="h-4 w-4 text-muted-foreground" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">Notification sounds</p>
                        <p className="text-xs text-muted-foreground">Play a sound when you receive a notification</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifPrefs.sound ?? true}
                      onCheckedChange={(v) => toggleNotif('sound', v)}
                      className="shrink-0 ml-4"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Preferences are saved locally to this browser. Email notification settings are managed by your admin.
                </p>
              </div>
            )}

            {/* ── APPEARANCE ── */}
            {activeTab === 'appearance' && (
              <div className="space-y-6 max-w-xl">
                <div>
                  <h2 className="text-lg font-semibold">Appearance</h2>
                  <p className="text-sm text-muted-foreground">Customize how the app looks on this device</p>
                </div>

                {/* Theme */}
                <div className="rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-muted/30 border-b">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Theme</p>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'light', icon: Sun, label: 'Light' },
                        { value: 'dark', icon: Moon, label: 'Dark' },
                        { value: 'system', icon: Monitor, label: 'System' },
                      ].map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setTheme(t.value)}
                          className={cn(
                            'flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all text-center',
                            theme === t.value
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border hover:border-primary/40 hover:bg-muted/30 text-muted-foreground'
                          )}
                        >
                          <div className={cn(
                            'h-10 w-10 rounded-lg flex items-center justify-center',
                            theme === t.value ? 'bg-primary/10' : 'bg-muted'
                          )}>
                            <t.icon className="h-5 w-5" />
                          </div>
                          <span className="text-sm font-medium">{t.label}</span>
                          {theme === t.value && (
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <Check className="h-3 w-3" />Active
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Display info */}
                <div className="rounded-xl border p-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Display info</p>
                  {[
                    { label: 'Color scheme', value: theme === 'system' ? 'System default' : theme === 'dark' ? 'Dark mode' : 'Light mode' },
                    { label: 'Language', value: 'English (US)' },
                    { label: 'Time zone', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
