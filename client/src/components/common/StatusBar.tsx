import { useState, useEffect } from 'react';
import { Wifi, Clock, Info } from 'lucide-react';

export function StatusBar() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  return (
    <div className="h-6 border-t bg-muted/30 text-xs text-muted-foreground flex items-center px-4">
      <div className="flex items-center">
        <Info size={12} className="mr-1.5" />
        <span>Lumina Outreach v2.4.1</span>
      </div>
      
      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center">
          <Wifi size={12} className={`mr-1.5 ${isOnline ? 'text-green-500' : 'text-red-500'}`} />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        
        <div className="flex items-center">
          <Clock size={12} className="mr-1.5" />
          <span>{formatTime(currentTime)} • {formatDate(currentTime)}</span>
        </div>
      </div>
    </div>
  );
}
