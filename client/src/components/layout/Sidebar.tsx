import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  PhoneCall,
  Settings,
  Megaphone,
  BarChart3,
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
  collapsed?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ href, icon, title, onNavigate, collapsed }) => {
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
          'w-full justify-start gap-3 transition-all duration-300 ease-in-out h-10 my-1 rounded-md',
          isActive ? 'bg-muted font-medium text-primary' : 'font-normal hover:bg-muted/50',
          collapsed ? 'justify-center px-2' : ''
        )}
        title={collapsed ? title : undefined}
      >
        <span className={cn(
          'transition-transform duration-300 ease-in-out',
          collapsed ? 'transform scale-125' : '',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}>
          {icon}
        </span>
        <span className={cn(
          'transition-all duration-300 ease-in-out whitespace-nowrap text-sm font-medium',
          collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}>
          {title}
        </span>
      </Button>
    </Link>
  );
};

interface SidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ onNavigate, collapsed = false }) => {
  const { logout } = useAuth();

  return (
    <div className={cn(
      "flex flex-col border-r bg-card h-full transition-all duration-300 ease-in-out shadow-sm",
      collapsed ? "w-[70px]" : "w-64"
    )}>
      {/* Logo and title */}
      <div className="h-16 flex items-center px-4 border-b bg-muted/30">
        <div className="flex items-center gap-3 overflow-hidden">
          <Logo width={collapsed ? 36 : 32} height={collapsed ? 36 : 32} className="transition-all duration-300" />
          <h1 className={`font-semibold tracking-tight whitespace-nowrap transition-all duration-300 origin-left ${collapsed ? 'opacity-0 scale-90 w-0' : 'opacity-100 w-auto text-lg'}`}>
            Lumina <span className="font-bold text-primary">Outreach</span>
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-6">
        <nav className="space-y-0.5">
          <SidebarItem
            href="/dashboard"
            icon={<LayoutDashboard size={20} />}
            title="Dashboard"
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
          <SidebarItem
            href="/leads"
            icon={<Users size={20} />}
            title="Lead Management"
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
          <SidebarItem
            href="/campaigns"
            icon={<Megaphone size={20} />}
            title="Campaigns"
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
          <SidebarItem
            href="/calls"
            icon={<PhoneCall size={20} />}
            title="Call History"
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
          <SidebarItem
            href="/analytics"
            icon={<BarChart3 size={20} />}
            title="Analytics"
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
          <SidebarItem
            href="/configuration"
            icon={<Settings size={20} />}
            title="Configuration"
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        </nav>
      </ScrollArea>

      {/* Logout */}
      <div className="p-3 border-t bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full gap-3 text-muted-foreground transition-all duration-300 ease-in-out h-10 rounded-md hover:bg-muted/70 hover:text-destructive",
            collapsed ? "justify-center px-2" : "justify-start"
          )}
          onClick={logout}
          title={collapsed ? "Sign Out" : undefined}
        >
          <span className={cn(
            'transition-transform duration-300 ease-in-out',
            collapsed ? 'transform scale-125' : ''
          )}>
            <LogOut size={20} />
          </span>
          <span className={cn(
            'transition-all duration-300 ease-in-out whitespace-nowrap text-sm font-medium',
            collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
          )}>
            Sign Out
          </span>
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
