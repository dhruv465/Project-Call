import { useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export function PageTitle() {
  const location = useLocation();
  const pathname = location.pathname;

  // Map routes to readable titles
  const getTitleFromPath = (path: string): string => {
    const routes: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/leads': 'Lead Management',
      '/campaigns': 'Campaigns',
      '/calls': 'Call History',
      '/analytics': 'Analytics',
      '/configuration': 'Configuration',
    };
    
    return routes[path] || 'Page';
  };

  // Get breadcrumb segments
  const getSegments = () => {
    if (pathname === '/dashboard') {
      return [{ path: '/dashboard', name: 'Dashboard' }];
    }
    
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      return {
        path,
        name: getTitleFromPath(path) || segment.charAt(0).toUpperCase() + segment.slice(1),
      };
    });
  };

  const segments = getSegments();
  const pageTitle = getTitleFromPath(pathname);

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-medium tracking-tight mb-1">{pageTitle}</h1>
      
      <div className="flex items-center text-sm text-muted-foreground">
        <span className="flex items-center">
          <Home size={14} className="mr-1" />
          <span>Home</span>
        </span>
        
        {segments.map((segment, index) => (
          <span key={segment.path} className="flex items-center">
            <ChevronRight size={14} className="mx-1" />
            <span className={index === segments.length - 1 ? "text-foreground" : ""}>
              {segment.name}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
