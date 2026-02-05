import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Mail } from 'lucide-react';

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  designation: string | null;
  phone: string | null;
  avatar_url: string | null;
  updated_at: string;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, designation, phone, avatar_url, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load profile' });
        setLoading(false);
        return;
      }
      const row = data as ProfileRow | null;
      if (row) {
        setFullName(row.full_name ?? '');
        setDesignation(row.designation ?? '');
        setPhone(row.phone ?? '');
        setAvatarUrl(row.avatar_url ?? '');
      }
      setLoading(false);
    })();
  }, [user?.id, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      full_name: fullName.trim() || null,
      designation: designation.trim() || null,
      phone: phone.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    };
    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in max-w-2xl">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile and preferences</p>
        </div>

        {/* Profile */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Update your name, designation, and contact info. This is shown to teammates and in lead assignments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl || undefined} alt={fullName || user?.email ?? ''} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {(fullName || user?.email ?? 'U').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm text-muted-foreground">
                <p>Profile photo is set via avatar URL below.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {user?.email ?? '—'}
                </div>
                <p className="text-xs text-muted-foreground">Email is managed by your account and cannot be changed here.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Sales Manager, Account Executive"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1 234 567 8900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar_url">Avatar URL</Label>
                <Input
                  id="avatar_url"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                />
                <p className="text-xs text-muted-foreground">Optional. Link to a profile image.</p>
              </div>

              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Account info */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your login and role are managed by your organization.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p><span className="font-medium text-foreground">Signed in as</span> {user?.email}</p>
            <p>To change your password or security settings, use the link sent to your email or contact your admin.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
