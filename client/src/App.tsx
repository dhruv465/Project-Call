import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster as UIToaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

// Layouts
import DashboardLayout from '@/layouts/DashboardLayout';
import AuthLayout from '@/layouts/AuthLayout';

// Pages
import Dashboard from '@/pages/Dashboard';
import Leads from '@/pages/Leads';
import Campaigns from '@/pages/Campaigns';
import Calls from '@/pages/Calls';
import Analytics from '@/pages/Analytics';
import Configuration from '@/pages/Configuration';
import VoiceAI from '@/pages/VoiceAI';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import NotFound from '@/pages/NotFound';

// Test Components
import NotificationTest from '@/components/NotificationTest';

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <>
      <Routes>
        {/* Auth routes */}
        <Route path="/" element={<AuthLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>

        {/* Dashboard routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="calls" element={<Calls />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="configuration" element={<Configuration />} />
          <Route path="voice-ai" element={<VoiceAI />} />
          <Route path="test-notifications" element={<NotificationTest />} />
        </Route>

        {/* 404 route */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      <UIToaster />
      <SonnerToaster />
    </>
  );
}

export default App;
