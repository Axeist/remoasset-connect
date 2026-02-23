import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { SplashScreen } from "@/components/SplashScreen";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Tasks from "./pages/Tasks";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Reports from "./pages/Reports";
import Help from "./pages/Help";
import FollowUps from "./pages/FollowUps";
import TeamActivity from "./pages/TeamActivity";
import ResetPassword from "./pages/ResetPassword";
import Pipeline from "./pages/Pipeline";
import Vendors from "./pages/Vendors";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const WELCOME_SPLASH_DURATION = 3200;

const App = () => {
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {showWelcomeSplash && (
          <SplashScreen
            variant="welcome"
            duration={WELCOME_SPLASH_DURATION}
            onComplete={() => setShowWelcomeSplash(false)}
          />
        )}
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
              <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
              <Route path="/leads/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
              <Route path="/pipeline" element={<ProtectedRoute><Pipeline pageTitle="My Pipeline" /></ProtectedRoute>} />
              <Route path="/admin/pipeline" element={<AdminRoute><Pipeline pageTitle="Pipeline Overview" adminOnly /></AdminRoute>} />
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
              <Route path="/admin/team-activity" element={<ProtectedRoute><TeamActivity /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
              <Route path="/follow-ups" element={<ProtectedRoute><FollowUps /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
