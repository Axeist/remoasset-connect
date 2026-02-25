import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { Check, ExternalLink, Zap } from 'lucide-react';

function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.316 5.684H5.684v12.632h12.632V5.684z" fill="#fff" />
      <path d="M18.316 24l5.684-5.684h-5.684V24z" fill="#EA4335" />
      <path d="M24 5.684V0h-5.684v5.684H24z" fill="#188038" />
      <path d="M18.316 18.316H24V5.684h-5.684v12.632z" fill="#34A853" />
      <path d="M0 18.316v5.684h5.684v-5.684H0z" fill="#4285F4" />
      <path d="M0 5.684h5.684V0H0v5.684z" fill="#FBBC04" />
      <path d="M5.684 18.316h12.632v-5.684H5.684v5.684z" fill="#4285F4" opacity=".12" />
      <path d="M0 18.316h5.684V5.684H0v12.632z" fill="#FBBC04" />
      <path d="M5.684 5.684h12.632V0H5.684v5.684z" fill="#EA4335" opacity=".25" />
      <path d="M5.684 18.316h12.632V5.684H5.684v12.632z" fill="none" stroke="none" />
      <path d="M8.954 16.087c-.618-.42-1.044-1.032-1.278-1.836l1.272-.522c.132.504.36.9.684 1.188.324.288.714.432 1.17.432.468 0 .864-.156 1.188-.468.324-.312.486-.702.486-1.17 0-.48-.168-.87-.504-1.176-.336-.306-.756-.456-1.26-.456h-.78v-1.254h.702c.432 0 .798-.138 1.098-.414.3-.276.45-.636.45-1.08 0-.396-.138-.72-.414-.972s-.63-.378-1.062-.378c-.42 0-.756.126-1.008.378-.252.252-.432.564-.54.936l-1.254-.522c.168-.552.492-1.026.972-1.422.48-.396 1.086-.594 1.818-.594.54 0 1.026.114 1.458.342.432.228.768.546 1.008.954.24.408.36.87.36 1.386 0 .528-.114.984-.342 1.368a2.38 2.38 0 01-.882.888v.072c.42.216.77.54 1.05.972.28.432.42.93.42 1.494 0 .564-.144 1.068-.432 1.512a3.01 3.01 0 01-1.17 1.05c-.492.258-1.044.384-1.656.384-.72 0-1.362-.21-1.98-.63zM16.17 8.646l-1.398 1.008-.696-1.056 2.466-1.776h.96V16.2h-1.332V8.646z" fill="#4285F4" />
    </svg>
  );
}

export function GoogleCalendarCard() {
  const { connectGoogleCalendar } = useAuth();
  const { isConnected } = useGoogleCalendar();

  return (
    <Card className="card-shadow overflow-hidden border-border/60">
      <div className="relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#4285F4]/[0.03] rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#34A853]/[0.03] rounded-full translate-y-1/3 -translate-x-1/3" />

        <CardContent className="relative p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-black/[0.08]">
              <GoogleCalendarIcon className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
                Google Calendar
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Sync meetings & follow-ups. Google Meet links and invites sent automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-5">
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34A853]/10 px-3 py-1 text-xs font-semibold text-[#188038] ring-1 ring-[#34A853]/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#34A853] animate-pulse" />
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
              <div className="rounded-xl border border-[#34A853]/20 bg-[#34A853]/[0.04] p-3.5 flex items-start gap-2.5">
                <Zap className="h-4 w-4 text-[#188038] mt-0.5 shrink-0" />
                <div className="text-sm text-[#188038]/80">
                  <span className="font-medium text-[#188038]">Active.</span>{' '}
                  Meetings and follow-ups can be synced to Google Calendar with auto-generated Meet links.
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
                  'Create calendar events with Google Meet links',
                  'Send invites to leads via email',
                  'Sync follow-up reminders to calendar',
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#4285F4]/10">
                      <Check className="h-3 w-3 text-[#4285F4]" />
                    </div>
                    {text}
                  </div>
                ))}
              </div>
              <Button
                onClick={connectGoogleCalendar}
                className="gap-2.5 bg-[#4285F4] hover:bg-[#3367D6] shadow-md shadow-[#4285F4]/20 text-white font-medium"
              >
                <GoogleCalendarIcon className="h-4.5 w-4.5" />
                Sign in with Google
              </Button>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
