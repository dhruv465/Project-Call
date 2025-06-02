import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  Phone,
  Settings,
  Megaphone,
  BarChart4,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import Logo from '@/components/Logo';

interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  onNavigate?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ href, icon, title, onNavigate }) => {
  const { pathname } = useLocation();
  const isActive = pathname === href;

  const handleClick = () => {
    onNavigate?.();
  };

  return (
    <Link to={href} className="block" onClick={handleClick}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'w-full justify-start gap-2',
          isActive ? 'bg-muted font-medium' : 'font-normal'
        )}
      >
        {icon}
        {title}
      </Button>
    </Link>
  );
};

interface SidebarProps {
  onNavigate?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const { logout } = useAuth();

  return (
    <div className="flex flex-col w-64 border-r bg-card lg:w-64">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b">
        <div className="flex items-center gap-2">
          <Logo width={32} height={32} />
          <h1 className="text-xl font-bold">Lumina Outreach</h1>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-4 py-6">
        <nav className="space-y-2">
          <SidebarItem
            href="/dashboard"
            icon={<LayoutDashboard size={18} />}
            title="Dashboard"
            onNavigate={onNavigate}
          />
          <SidebarItem
            href="/leads"
            icon={<Users size={18} />}
            title="Lead Management"
            onNavigate={onNavigate}
          />
          <SidebarItem
            href="/campaigns"
            icon={<Megaphone size={18} />}
            title="Campaigns"
            onNavigate={onNavigate}
          />
          <SidebarItem
            href="/calls"
            icon={<Phone size={18} />}
            title="Call History"
            onNavigate={onNavigate}
          />
          <SidebarItem
            href="/analytics"
            icon={<BarChart4 size={18} />}
            title="Analytics"
            onNavigate={onNavigate}
          />
          <SidebarItem
            href="/configuration"
            icon={<Settings size={18} />}
            title="Configuration"
            onNavigate={onNavigate}
          />
        </nav>
      </ScrollArea>

      {/* Logout */}
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={logout}
        >
          <LogOut size={18} />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
