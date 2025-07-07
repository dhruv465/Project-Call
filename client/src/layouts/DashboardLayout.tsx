import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useState } from 'react';

const DashboardLayout = () => {
  const { user, isLoading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className={`hidden lg:flex transition-all duration-300 ease-in-out ${collapsed ? 'lg:w-[70px]' : 'lg:w-64'}`}>
        <Sidebar collapsed={collapsed} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-in-out">
        {/* Header */}
        <Header toggleSidebar={() => setCollapsed(!collapsed)} sidebarCollapsed={collapsed} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 md:p-6 bg-background">
          <div className="max-w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
