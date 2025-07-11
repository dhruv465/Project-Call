import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { PageTitle } from '@/components/common/PageTitle';
import { StatusBar } from '@/components/common/StatusBar';
import { useState } from 'react';

const DashboardLayout = () => {
  const { user, isLoading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
          <p className="text-sm text-muted-foreground">Loading resources...</p>
        </div>
      </div>
    );
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
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 bg-background/50">
          <div className="max-w-[1500px] mx-auto">
            <PageTitle />
            <Outlet />
          </div>
        </main>
        
        {/* Status bar */}
        <StatusBar />
      </div>
    </div>
  );
};

export default DashboardLayout;
