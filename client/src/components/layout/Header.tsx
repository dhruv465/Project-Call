import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Menu, Moon, Sun, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import Sidebar from './Sidebar';

const Header = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-10 border-b bg-background">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left side - Mobile menu and title */}
        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Application navigation links and options
              </SheetDescription>
              <Sidebar onNavigate={() => setIsOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Page title - can be dynamically set based on current route */}
          <h1 className="text-lg font-semibold lg:hidden">Lumina Outreach</h1>
        </div>

        {/* Right side actions - moved to absolute right */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Theme toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <User size={20} />
                <span className="sr-only">User menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-4 py-2 border-b">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuItem asChild>
                <button className="w-full cursor-pointer" onClick={logout}>
                  Sign out
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
