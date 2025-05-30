import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';

interface CallNotification {
  id: string;
  leadName: string;
  leadPhone: string;
  campaignName: string;
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed';
  timestamp: Date;
  read: boolean;
}

interface UseCallNotificationsReturn {
  notifications: CallNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  isConnected: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const isDevelopment = import.meta.env.MODE === 'development';

export const useCallNotifications = (userId?: string): UseCallNotificationsReturn => {
  const { toast } = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<CallNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Connect to socket when component mounts
  useEffect(() => {
    // Only connect if we have a userId
    if (!userId) return;

    const socketInstance = io(API_URL, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      console.log('Connected to notification service');
      setIsConnected(true);
      
      // Join user-specific room for notifications
      socketInstance.emit('join-user-room', userId);
      
      // Join call monitoring for all campaigns
      socketInstance.emit('join-call-monitoring', 'all');
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from notification service');
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
      
      // In development mode, don't show errors if server is not available
      if (!isDevelopment) {
        toast({
          title: 'Notification Service',
          description: 'Unable to connect to real-time notification service',
          variant: 'destructive',
        });
      }
    });

    setSocket(socketInstance);

    // Handle cleanup
    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [userId, toast]);

  // Listen for new call events
  useEffect(() => {
    if (!socket) return;

    // Listen for call status updates
    socket.on('call-status-update', (data: {
      callId: string;
      leadName: string;
      leadPhone: string;
      campaignName: string;
      status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed';
    }) => {
      const newNotification: CallNotification = {
        id: data.callId,
        leadName: data.leadName,
        leadPhone: data.leadPhone,
        campaignName: data.campaignName,
        status: data.status,
        timestamp: new Date(),
        read: false,
      };

      setNotifications(prev => [newNotification, ...prev]);

      // Show toast for important statuses
      if (['completed', 'failed'].includes(data.status)) {
        toast({
          title: `Call ${data.status === 'completed' ? 'Completed' : 'Failed'}`,
          description: `Call with ${data.leadName} from ${data.campaignName} has ${data.status}`,
        });
      }
    });

    // Clean up the listeners
    return () => {
      socket.off('call-status-update');
    };
  }, [socket, toast]);

  // Fetch initial notifications on mount (if needed)
  useEffect(() => {
    const fetchInitialNotifications = async () => {
      if (!userId) return;
      
      try {
        // In a real app, we would fetch recent notifications from the API
        // const response = await api.get('/api/notifications');
        // setNotifications(response.data.notifications);
        
        // For development, use mock data
        if (isDevelopment) {
          const mockNotifications: CallNotification[] = [
            {
              id: '1',
              leadName: 'John Smith',
              leadPhone: '+1-555-0101',
              campaignName: 'Q4 Outreach',
              status: 'completed',
              timestamp: new Date(Date.now() - 25 * 60000), // 25 minutes ago
              read: false,
            },
            {
              id: '2',
              leadName: 'Sarah Johnson',
              leadPhone: '+1-555-0102',
              campaignName: 'New Product Launch',
              status: 'failed',
              timestamp: new Date(Date.now() - 120 * 60000), // 2 hours ago
              read: true,
            },
          ];
          setNotifications(mockNotifications);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchInitialNotifications();
  }, [userId]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Mark a notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true } 
          : notification
      )
    );
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    isConnected,
  };
};

export default useCallNotifications;
