import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const AuthLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-6 space-y-6 bg-card rounded-lg shadow-lg">
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
