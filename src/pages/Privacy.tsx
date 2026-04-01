const Privacy = () => {
  return (
    <div className="min-h-screen bg-white text-gray-800 px-6 py-12 max-w-3xl mx-auto">
      <div className="mb-10">
        <img src="/favicon.png" alt="RemoAsset" className="h-8 w-8 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mt-1">Last updated: March 26, 2026</p>
      </div>

      <section className="space-y-8 text-sm leading-relaxed text-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Overview</h2>
          <p>
            RemoAsset Connect ("Connect", "we", "us") is an internal vendor resource management
            platform operated by RemoAsset. This Privacy Policy describes how we collect, use, and
            protect information when authorised team members access the platform.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Who Uses This Application</h2>
          <p>
            Access to Connect is restricted to authorised employees and contractors of RemoAsset
            with verified organisational email addresses (e.g. <code className="bg-gray-100 px-1 rounded">@remoasset.in</code> or{" "}
            <code className="bg-gray-100 px-1 rounded">@remoasset.us</code>). It is not intended for
            use by the general public.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account information</strong>: Name, email address, and profile picture obtained
              via Google OAuth at sign-in.
            </li>
            <li>
              <strong>Usage data</strong>: Pages visited, actions performed, and timestamps recorded
              for audit and operational purposes.
            </li>
            <li>
              <strong>Business data</strong>: Lead and vendor records, activity logs, tasks, and
              pipeline information entered by authorised users.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To authenticate and authorise access to the platform.</li>
            <li>To enable core CRM and vendor management features.</li>
            <li>To maintain audit logs and team activity records.</li>
            <li>To send internal notifications and follow-up reminders.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Google OAuth &amp; Workspace Data</h2>
          <p>
            When you sign in with Google, we receive your name, email, and profile picture. If you
            optionally connect your Google Workspace account for Gmail integration, we access only
            the permissions you explicitly grant (e.g. sending emails on your behalf). We do not
            store your Google credentials. You may revoke access at any time via your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Google Account permissions page
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Storage &amp; Security</h2>
          <p>
            All data is stored in a Supabase-managed PostgreSQL database with row-level security
            policies enforced. Data is encrypted in transit (TLS) and at rest. Access is limited to
            authenticated users with appropriate role-based permissions.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Data Sharing</h2>
          <p>
            We do not sell, trade, or transfer your personal information to third parties. Data may
            be shared with third-party services solely to operate the platform (e.g. Supabase for
            database hosting, Google for authentication). These providers are bound by their own
            privacy policies.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Data Retention</h2>
          <p>
            Business data is retained for as long as needed to support operations. Account data is
            removed upon termination of employment or access revocation. You may request deletion of
            your personal data by contacting the platform administrator.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Your Rights</h2>
          <p>
            Authorised users may request access to, correction of, or deletion of their personal
            data by contacting the RemoAsset platform administrator at{" "}
            <a href="mailto:admin@remoasset.in" className="text-blue-600 underline">
              admin@remoasset.in
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Continued use of the platform after changes
            are posted constitutes acceptance of the revised policy.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Contact</h2>
          <p>
            For questions about this Privacy Policy, please contact{" "}
            <a href="mailto:admin@remoasset.in" className="text-blue-600 underline">
              admin@remoasset.in
            </a>
            .
          </p>
        </div>
      </section>

      <div className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-400">
        © {new Date().getFullYear()} RemoAsset. All rights reserved.
      </div>
    </div>
  );
};

export default Privacy;
