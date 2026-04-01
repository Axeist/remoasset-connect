import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

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

const Terms = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="RemoAsset Connect" className="h-7 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/auth" className="text-primary font-semibold hover:text-primary/80 transition-colors">Sign in →</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
            <FileText className="h-3.5 w-3.5" /> Legal
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: <span className="text-foreground font-medium">{LAST_UPDATED}</span>
          </p>
          <p className="text-sm text-muted-foreground max-w-xl">
            By accessing or using RemoAsset Connect, you agree to the following terms. Please read
            them carefully.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          <Section num="1" title="Acceptance of Terms">
            <p>
              By accessing or using RemoAsset Connect ("Connect", "the platform"), you agree to be
              bound by these Terms of Service and our{' '}
              <Link to="/privacy" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
                Privacy Policy
              </Link>
              . If you do not agree, you must not use the platform.
            </p>
          </Section>

          <Section num="2" title="Authorised Use Only">
            <p>
              Access to Connect is restricted exclusively to authorised employees and contractors of
              RemoAsset with verified organisational email addresses. Sharing credentials, granting
              unauthorised access, or using the platform for personal or commercial purposes outside
              of RemoAsset operations is strictly prohibited.
            </p>
          </Section>

          <Section num="3" title="User Accounts">
            <ul className="list-disc pl-4 space-y-1">
              <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
              <li>You must notify the platform administrator immediately of any unauthorised access to your account.</li>
              <li>Accounts are non-transferable and may be revoked at any time by an administrator.</li>
            </ul>
          </Section>

          <Section num="4" title="Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Use the platform for any unlawful purpose or in violation of any applicable regulations.</li>
              <li>Attempt to gain unauthorised access to any part of the platform or its infrastructure.</li>
              <li>Introduce malware, viruses, or any other harmful code.</li>
              <li>Scrape, harvest, or systematically extract data from the platform without written consent.</li>
              <li>Circumvent any access controls, security features, or authentication mechanisms.</li>
            </ul>
          </Section>

          <Section num="5" title="Data & Intellectual Property">
            <p>
              All business data entered into Connect (leads, vendor records, pipeline data, etc.)
              remains the property of RemoAsset. You may not export, share, or disclose proprietary
              business data outside of authorised workflows without explicit approval.
            </p>
            <p>
              The platform itself, including its design, code, and content, is the intellectual
              property of RemoAsset and may not be reproduced or distributed without permission.
            </p>
          </Section>

          <Section num="6" title="Third-Party Integrations">
            <p>
              Connect integrates with third-party services including Google Workspace and Supabase.
              Use of these services is subject to their respective terms and privacy policies.
              RemoAsset is not responsible for the practices of third-party providers.
            </p>
          </Section>

          <Section num="7" title="Availability & Modifications">
            <p>
              We strive to maintain platform availability but do not guarantee uninterrupted access.
              The platform may be updated, modified, or taken offline for maintenance at any time
              without prior notice. Features may be added, changed, or removed at our discretion.
            </p>
          </Section>

          <Section num="8" title="Limitation of Liability">
            <p>
              To the maximum extent permitted by law, RemoAsset shall not be liable for any indirect,
              incidental, or consequential damages arising from your use of the platform, including
              loss of data, business interruption, or unauthorised access.
            </p>
          </Section>

          <Section num="9" title="Termination">
            <p>
              RemoAsset reserves the right to suspend or terminate your access to Connect at any
              time, with or without cause, including for violation of these Terms. Upon termination,
              your right to use the platform ceases immediately.
            </p>
          </Section>

          <Section num="10" title="Changes to These Terms">
            <p>
              We may update these Terms from time to time. Continued use of the platform after
              changes are posted constitutes your acceptance of the revised Terms. Material changes
              will be communicated where reasonably practicable.
            </p>
          </Section>

          <Section num="11" title="Governing Law">
            <p>
              These Terms are governed by and construed in accordance with the laws of India. Any
              disputes arising under these Terms shall be subject to the exclusive jurisdiction of
              the competent courts in India.
            </p>
          </Section>

          <Section num="12" title="Contact">
            <p>
              For questions about these Terms, please contact{' '}
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
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-primary font-medium">Terms of Service</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Terms;
