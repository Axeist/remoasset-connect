import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { CalendarDays, Check, ExternalLink, Zap } from 'lucide-react';

export function GoogleCalendarCard() {
  const { connectGoogleCalendar } = useAuth();
  const { isConnected } = useGoogleCalendar();

  return (
    <Card className="card-shadow overflow-hidden border-border/60">
      <div className="relative">
        <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-bl from-blue-500/5 via-indigo-500/5 to-transparent rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-gradient-to-tr from-violet-500/5 to-transparent rounded-full translate-y-1/3 -translate-x-1/3" />

        <CardContent className="relative p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
              <CalendarDays className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-foreground">Google Calendar</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Sync meetings & follow-ups. Invites sent to leads automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-5">
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-700 dark:text-green-400 ring-1 ring-green-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                Not connected
              </span>
            )}
          </div>

          {isConnected ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-green-500/20 bg-green-50/50 dark:bg-green-950/10 p-3.5 flex items-start gap-2.5">
                <Zap className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div className="text-sm text-green-700/80 dark:text-green-400/70">
                  <span className="font-medium text-green-800 dark:text-green-300">Active.</span>{' '}
                  When you log meetings or schedule follow-ups, you'll see an option to add them to Google Calendar.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={connectGoogleCalendar}
                className="gap-2 text-muted-foreground"
              >
                <ExternalLink className="h-4 w-4" />
                Reconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {[
                  'Create calendar events for meetings',
                  'Send invites to leads via email',
                  'Sync follow-up reminders to calendar',
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                      <Check className="h-3 w-3 text-blue-600" />
                    </div>
                    {text}
                  </div>
                ))}
              </div>
              <Button
                onClick={connectGoogleCalendar}
                className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/20 text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Connect Google Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
