import { Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

const DashboardLayout = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-x-hidden">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
