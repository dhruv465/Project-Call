import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCallNotifications } from '@/hooks/useCallNotifications';
import api from '@/services/api';

const NotificationTest: React.FC = () => {
  const { notifications, unreadCount, isConnected, markAsRead } = useCallNotifications('test-user-123');
  const [testCallId, setTestCallId] = useState('test-call-' + Date.now());
  const [status, setStatus] = useState('Initiated');

  const createTestCall = async () => {
    try {
      // Create a test call
      const response = await api.post('/api/calls/test', {
        id: testCallId,
        leadName: 'John Doe',
        leadPhone: '+1234567890',
        campaignName: 'Test Campaign',
        status: 'Initiated'
      });
      
      console.log('Test call created:', response.data);
    } catch (error) {
      console.error('Error creating test call:', error);
    }
  };

  const updateTestCallStatus = async () => {
    try {
      // Update the test call status to trigger notification
      const response = await api.put(`/api/calls/${testCallId}/status`, {
        status,
        notes: 'Test status update'
      });
      
      console.log('Test call status updated:', response.data);
    } catch (error) {
      console.error('Error updating test call status:', error);
    }
  };

  const statuses = ['Initiated', 'Ringing', 'In-Progress', 'Completed', 'Failed', 'No-Answer', 'Busy'];

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Real-time Notification Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <span className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm">
              {isConnected ? 'Connected to notification service' : 'Disconnected from notification service'}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Test Call ID:</label>
            <Input
              value={testCallId}
              onChange={(e) => setTestCallId(e.target.value)}
              placeholder="Enter test call ID"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status to Update:</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex space-x-2">
            <Button onClick={createTestCall} variant="outline">
              Create Test Call
            </Button>
            <Button onClick={updateTestCallStatus}>
              Update Call Status
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Notifications ({unreadCount} unread)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500">No notifications yet</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${
                    notification.read ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        Call to {notification.leadName} - {notification.status}
                      </p>
                      <p className="text-sm text-gray-600">
                        Phone: {notification.leadPhone} | Campaign: {notification.campaignName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {!notification.read && (
                      <span className="h-2 w-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationTest;
