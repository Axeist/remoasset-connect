import { Suspense, lazy, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { PersistentShell } from "@/components/layout/PersistentShell";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
const CsmHome = lazy(() => import("./pages/CsmHome"));
const CsmCoverage = lazy(() => import("./pages/CsmCoverage"));
import { RequirePermission } from "@/components/RequirePermission";
import { SplashScreen } from "@/components/SplashScreen";
import Auth from "./pages/Auth";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Admin = lazy(() => import("./pages/Admin"));
const Settings = lazy(() => import("./pages/Settings"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Reports = lazy(() => import("./pages/Reports"));
const Help = lazy(() => import("./pages/Help"));
const FollowUps = lazy(() => import("./pages/FollowUps"));
const TeamActivity = lazy(() => import("./pages/TeamActivity"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorAgent = lazy(() => import("./pages/VendorAgent"));
const Inbox = lazy(() => import("./pages/Inbox"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const ApiTester = lazy(() => import("./pages/ApiTester"));
const Developer = lazy(() => import("./pages/Developer"));
const TransferLog = lazy(() => import("./pages/TransferLog"));
const RfqHub = lazy(() => import("./pages/RfqHub"));
const RfqNew = lazy(() => import("./pages/RfqNew"));
const RfqDetail = lazy(() => import("./pages/RfqDetail"));
const RfqRespond = lazy(() => import("./pages/RfqRespond"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { PageVisitTracker } from "@/components/PageVisitTracker";
import { VersionReloader } from "@/components/VersionReloader";
import { CelebrationHost } from "@/components/CelebrationHost";
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const MrpLookup = lazy(() => import("./pages/MrpLookup"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

const WELCOME_SPLASH_DURATION = 1000;
const SPLASH_SEEN_KEY = 'remoasset:splash-seen';

function splashAlreadySeen() {
  try { return sessionStorage.getItem(SPLASH_SEEN_KEY) === '1'; } catch { return false; }
}

function shouldSkipWelcomeSplash() {
  if (typeof window === 'undefined') return false;
  if (splashAlreadySeen()) return true;
  const p = window.location.pathname;
  return (
    p.startsWith('/auth')
    || p.startsWith('/reset-password')
    || p.startsWith('/rfq/respond')
    || p === '/privacy'
    || p === '/terms'
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.querySelector('main.page-bg')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

const App = () => {
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(() => !shouldSkipWelcomeSplash());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <CelebrationHost />
        <VersionReloader />
        {showWelcomeSplash && (
          <SplashScreen
            variant="welcome"
            duration={WELCOME_SPLASH_DURATION}
            onComplete={() => {
              try { sessionStorage.setItem(SPLASH_SEEN_KEY, '1'); } catch { /* ignore */ }
              setShowWelcomeSplash(false);
            }}
          />
        )}
        <BrowserRouter>
          <AuthProvider>
            <ScrollToTop />
            <PageVisitTracker />
            <CookieConsentBanner />
            <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/rfq/respond/:token" element={<RfqRespond />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
              <Route element={<ProtectedRoute><PersistentShell /></ProtectedRoute>}>
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
                <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
                <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
                <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
                <Route path="/mrp-lookup" element={<ProtectedRoute><MrpLookup /></ProtectedRoute>} />
                <Route path="/rfq" element={<ProtectedRoute><RfqHub /></ProtectedRoute>} />
                <Route path="/rfq/new" element={<ProtectedRoute><RfqNew /></ProtectedRoute>} />
                <Route path="/rfq/:id" element={<ProtectedRoute><RfqDetail /></ProtectedRoute>} />
                <Route path="/csm" element={<ProtectedRoute><RequirePermission permission="csm.workspace"><CsmHome /></RequirePermission></ProtectedRoute>} />
                <Route path="/csm/coverage" element={<ProtectedRoute><RequirePermission permission="coverage.view"><CsmCoverage /></RequirePermission></ProtectedRoute>} />
                <Route path="/vendor-agent" element={<AdminRoute><VendorAgent /></AdminRoute>} />
                <Route path="/leads/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
                <Route path="/pipeline" element={<ProtectedRoute><Pipeline pageTitle="My Pipeline" /></ProtectedRoute>} />
                <Route path="/admin/pipeline" element={<AdminRoute><Pipeline pageTitle="Pipeline Overview" adminOnly /></AdminRoute>} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                <Route path="/admin/api-docs" element={<AdminRoute><ApiDocs /></AdminRoute>} />
                <Route path="/admin/api-tester" element={<AdminRoute><ApiTester /></AdminRoute>} />
                <Route path="/developer" element={<RequirePermission permission="developer.tools"><Developer /></RequirePermission>} />
                <Route path="/admin/team-activity" element={<ProtectedRoute><TeamActivity /></ProtectedRoute>} />
                <Route path="/admin/transfer-log" element={<AdminRoute><TransferLog /></AdminRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
                <Route path="/follow-ups" element={<ProtectedRoute><FollowUps /></ProtectedRoute>} />
                <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
              </Route>
            </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
