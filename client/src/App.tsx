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
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import NotFound from '@/pages/NotFound';

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const isDevelopment = import.meta.env.VITE_ENV === 'development';

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // In development mode, always allow access
  if (isDevelopment || isAuthenticated) {
    return <>{children}</>;
  }

  return <Navigate to="/login" replace />;
};

function App() {
  const isDevelopment = import.meta.env.VITE_ENV === 'development';
  
  return (
    <>
      <Routes>
        {/* Auth routes */}
        <Route path="/" element={<AuthLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          {/* Only show auth routes in production or if explicitly accessed */}
          {!isDevelopment && (
            <>
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
            </>
          )}
          {/* In development, redirect auth routes to dashboard */}
          {isDevelopment && (
            <>
              <Route path="login" element={<Navigate to="/dashboard" replace />} />
              <Route path="register" element={<Navigate to="/dashboard" replace />} />
            </>
          )}
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
