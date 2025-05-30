import React, { useState } from 'react';
import { BellRing, BellOff, PhoneCall, X, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import useCallNotifications from '@/hooks/useCallNotifications';
import { useAuth } from '@/hooks/useAuth';

interface CallNotificationsProps {
  className?: string;
}

const CallNotifications: React.FC<CallNotificationsProps> = ({ className }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications,
    isConnected 
  } = useCallNotifications(user?._id);

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} min${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-500" />;
      case 'in-progress':
        return <PhoneCall className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'ringing':
        return <PhoneCall className="h-4 w-4 text-yellow-500 animate-pulse" />;
      default:
        return <PhoneCall className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleNotificationClick = (id: string) => {
    markAsRead(id);
    // In a real app, we might navigate to the call details page
    // navigate(`/calls/${id}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`relative ${className}`}
          onClick={() => setOpen(!open)}
        >
          {isConnected ? (
            <BellRing className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium">Call Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 px-2 text-xs"
                onClick={markAllAsRead}
              >
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 px-2 text-xs"
                onClick={clearNotifications}
              >
                Clear all
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <PhoneCall className="h-12 w-12 text-muted-foreground opacity-20 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="space-y-0">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={`p-4 flex gap-3 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/50 last:border-b-0 ${notification.read ? 'opacity-70' : ''}`}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  <div className="mt-0.5">
                    {getStatusIcon(notification.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">
                        {notification.leadName}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {notification.campaignName} · {notification.leadPhone}
                    </p>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {notification.status.replace('-', ' ')}
                      </Badge>
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-primary mt-1"></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {!isConnected && (
          <div className="p-3 border-t bg-muted/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <BellOff className="h-3 w-3" />
              Notification service disconnected
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default CallNotifications;
