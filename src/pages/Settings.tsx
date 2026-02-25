import { AppLayout } from '@/components/layout/AppLayout';
import { ProfileCard } from '@/components/settings/ProfileCard';
import { GoogleCalendarCard } from '@/components/settings/GoogleCalendarCard';

export default function Settings() {
  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in max-w-2xl">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile and preferences</p>
        </div>
        <ProfileCard />
        <GoogleCalendarCard />
      </div>
    </AppLayout>
  );
}
