import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

const LAST_UPDATED = 'March 26, 2026';

const Section = ({ num, title, children }: { num: string; title: string; children: React.ReactNode }) => (
  <div className="space-y-2.5">
    <h2 className="text-sm font-semibold text-foreground flex items-baseline gap-2">
      <span className="text-primary font-bold">{num}.</span> {title}
    </h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2 pl-4 border-l border-border/50">
      {children}
    </div>
  </div>
);

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="RemoAsset Connect" className="h-7 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link to="/auth" className="text-primary font-semibold hover:text-primary/80 transition-colors">Sign in →</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
            <Shield className="h-3.5 w-3.5" /> Legal
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: <span className="text-foreground font-medium">{LAST_UPDATED}</span>
          </p>
          <p className="text-sm text-muted-foreground max-w-xl">
            RemoAsset Connect is an internal platform. This policy explains how we handle your
            data when you use it.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          <Section num="1" title="Overview">
            <p>
              RemoAsset Connect ("Connect", "we", "us") is a vendor resource management platform
              operated by RemoAsset. This Privacy Policy describes how we collect, use, and protect
              information when authorised team members access the platform.
            </p>
          </Section>

          <Section num="2" title="Who Uses This Application">
            <p>
              Access is restricted to authorised employees and contractors of RemoAsset with verified
              organisational email addresses (e.g.{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">@remoasset.in</code>{' '}
              or{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">@remoasset.us</code>
              ). It is not intended for use by the general public.
            </p>
          </Section>

          <Section num="3" title="Information We Collect">
            <ul className="list-disc pl-4 space-y-1">
              <li><strong className="text-foreground">Account information</strong> — Name, email, and profile picture obtained via Google OAuth at sign-in.</li>
              <li><strong className="text-foreground">Usage data</strong> — Pages visited, actions performed, and timestamps recorded for audit purposes.</li>
              <li><strong className="text-foreground">Business data</strong> — Lead and vendor records, activity logs, tasks, and pipeline information entered by authorised users.</li>
            </ul>
          </Section>

          <Section num="4" title="How We Use Your Information">
            <ul className="list-disc pl-4 space-y-1">
              <li>To authenticate and authorise access to the platform.</li>
              <li>To enable core CRM and vendor management features.</li>
              <li>To maintain audit logs and team activity records.</li>
              <li>To send internal notifications and follow-up reminders.</li>
            </ul>
          </Section>

          <Section num="5" title="Google OAuth & Workspace Data">
            <p>
              When you sign in with Google, we receive your name, email, and profile picture. If you
              optionally connect your Google Workspace account for Gmail integration, we access only
              the permissions you explicitly grant (e.g. sending emails on your behalf). We do not
              store your Google credentials. You may revoke access at any time via your{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Google Account permissions page
              </a>
              .
            </p>
          </Section>

          <Section num="6" title="Data Storage & Security">
            <p>
              All data is stored in a Supabase-managed PostgreSQL database with row-level security
              policies enforced. Data is encrypted in transit (TLS) and at rest. Access is limited to
              authenticated users with appropriate role-based permissions.
            </p>
          </Section>

          <Section num="7" title="Data Sharing">
            <p>
              We do not sell, trade, or transfer your personal information to third parties. Data may
              be shared with third-party services solely to operate the platform (e.g. Supabase for
              database hosting, Google for authentication). These providers are bound by their own
              privacy policies.
            </p>
          </Section>

          <Section num="8" title="Data Retention">
            <p>
              Business data is retained for as long as needed to support operations. Account data is
              removed upon termination of employment or access revocation. You may request deletion of
              your personal data by contacting the platform administrator.
            </p>
          </Section>

          <Section num="9" title="Your Rights">
            <p>
              Authorised users may request access to, correction of, or deletion of their personal
              data by contacting the RemoAsset platform administrator at{' '}
              <a href="mailto:admin@remoasset.in" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
                admin@remoasset.in
              </a>
              .
            </p>
          </Section>

          <Section num="10" title="Changes to This Policy">
            <p>
              We may update this policy from time to time. Continued use of the platform after
              changes are posted constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section num="11" title="Contact">
            <p>
              For questions about this Privacy Policy, please contact{' '}
              <a href="mailto:admin@remoasset.in" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
                admin@remoasset.in
              </a>
              .
            </p>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} RemoAsset. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-primary font-medium">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Privacy;
