import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { CalendarDays, Check, ExternalLink } from 'lucide-react';

export function GoogleCalendarCard() {
  const { connectGoogleCalendar } = useAuth();
  const { isConnected } = useGoogleCalendar();

  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Sync meetings, follow-ups, and tasks with your Google Calendar. Invites are sent automatically to leads.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Status:</span>
          {isConnected ? (
            <Badge variant="outline" className="gap-1.5 border-green-500/40 text-green-700 bg-green-50">
              <Check className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Not connected
            </Badge>
          )}
        </div>

        {isConnected ? (
          <div className="rounded-lg border border-green-500/20 bg-green-50/50 p-3 text-sm text-green-800 space-y-1">
            <p className="font-medium">Google Calendar is active</p>
            <p className="text-green-700">
              When you log meetings or schedule follow-ups, you'll see an option to add them to your Google Calendar and automatically send invites.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground space-y-1">
              <p>Connecting gives the app permission to:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Create calendar events for meetings & follow-ups</li>
                <li>Send meeting invites to your leads via email</li>
                <li>Add task reminders to your calendar</li>
              </ul>
            </div>
            <Button onClick={connectGoogleCalendar} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Connect Google Calendar
            </Button>
          </div>
        )}

        {isConnected && (
          <Button
            variant="outline"
            size="sm"
            onClick={connectGoogleCalendar}
            className="gap-2 text-muted-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            Reconnect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
