import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  acceptAllCookies,
  getConsent,
  hasDecidedConsent,
  OPEN_CONSENT_EVENT,
  rejectOptionalCookies,
  saveConsent,
} from '@/lib/cookie-consent';

export function CookieConsentBanner() {
  const existing = getConsent();
  const [visible, setVisible] = useState(() => !hasDecidedConsent());
  const [customize, setCustomize] = useState(false);
  const [preferences, setPreferences] = useState(existing?.preferences ?? true);
  const [analytics, setAnalytics] = useState(existing?.analytics ?? true);

  useEffect(() => {
    const open = () => {
      const latest = getConsent();
      setPreferences(latest?.preferences ?? true);
      setAnalytics(latest?.analytics ?? true);
      setCustomize(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  if (!visible) return null;

  const finish = () => {
    setCustomize(false);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-border/80 bg-card/95 shadow-2xl shadow-black/10 backdrop-blur-md">
        <div className="flex gap-3 p-4 sm:p-5">
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Cookies on RemoAsset Connect</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                We use necessary cookies to keep you signed in. With your permission we also store
                layout preferences and a first-party usage cookie so we can reopen your last page
                after login. We do not use advertising cookies.{' '}
                <Link to="/privacy" className="text-primary font-medium underline-offset-2 hover:underline">
                  Privacy policy
                </Link>
              </p>
            </div>

            {customize && (
              <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label className="text-sm">Necessary</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sign-in session and this consent choice. Always on.
                    </p>
                  </div>
                  <Switch checked disabled aria-label="Necessary cookies always on" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label htmlFor="cookie-prefs" className="text-sm">Preferences</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sidebar layout, last page after login, and theme on this device.
                    </p>
                  </div>
                  <Switch
                    id="cookie-prefs"
                    checked={preferences}
                    onCheckedChange={setPreferences}
                  />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label htmlFor="cookie-analytics" className="text-sm">Analytics</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      First-party visit count and last path. No third-party trackers.
                    </p>
                  </div>
                  <Switch
                    id="cookie-analytics"
                    checked={analytics}
                    onCheckedChange={setAnalytics}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={() => setCustomize((v) => !v)}
              >
                {customize ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {customize ? 'Hide options' : 'Customize'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  rejectOptionalCookies();
                  finish();
                }}
              >
                Necessary only
              </Button>
              {customize ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    saveConsent({ preferences, analytics });
                    finish();
                  }}
                >
                  Save choices
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    acceptAllCookies();
                    finish();
                  }}
                >
                  Accept all
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
