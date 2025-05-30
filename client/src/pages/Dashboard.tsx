import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, PieChart, Phone, Users, Calendar, Clock, CheckCircle, AlertTriangle, Bell } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { triggerMultipleToasts } from '@/utils/testNotifications';

// Mock data for initial development
const mockDashboardData = {
  totalCalls: 1250,
  connectedCalls: 875,
  successfulCalls: 320,
  activeLeads: 1800,
  callsToday: 78,
  averageCallDuration: '3:45',
  conversionRate: 18.5,
  callsByOutcome: [
    { name: 'Interested', value: 320 },
    { name: 'Not Interested', value: 450 },
    { name: 'Call Back', value: 230 },
    { name: 'No Answer', value: 150 },
    { name: 'Other', value: 100 },
  ],
  callsOverTime: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    calls: Math.floor(Math.random() * 50) + 70,
  })),
  upcomingCallbacks: [
    {
      id: '1',
      leadName: 'Rahul Sharma',
      company: 'ABC Technologies',
      time: '10:30 AM',
      date: 'Today',
      phone: '+91 98765 43210',
    },
    {
      id: '2',
      leadName: 'Priya Patel',
      company: 'XYZ Solutions',
      time: '2:15 PM',
      date: 'Today',
      phone: '+91 87654 32109',
    },
    {
      id: '3',
      leadName: 'Vikram Singh',
      company: 'Global Innovations',
      time: '11:00 AM',
      date: 'Tomorrow',
      phone: '+91 76543 21098',
    },
  ],
  recentCalls: [
    {
      id: '1',
      leadName: 'Amit Kumar',
      time: '45 minutes ago',
      duration: '4:12',
      outcome: 'Interested',
    },
    {
      id: '2',
      leadName: 'Sneha Reddy',
      time: '1 hour ago',
      duration: '2:45',
      outcome: 'Call Back',
    },
    {
      id: '3',
      leadName: 'Rajesh Gupta',
      time: '2 hours ago',
      duration: '3:30',
      outcome: 'Not Interested',
    },
    {
      id: '4',
      leadName: 'Meera Desai',
      time: '3 hours ago',
      duration: '5:15',
      outcome: 'Interested',
    },
  ],
};

const Dashboard = () => {
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState('week'); // week, month, year

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error } = useQuery(
    ['dashboardOverview', timeframe],
    async () => {
      try {
        // In a real app, we would fetch data from API
        // const response = await api.get('/dashboard/overview', { params: { timeframe } });
        // return response.data;
        
        // For now, use mock data
        return mockDashboardData;
      } catch (error) {
        throw error;
      }
    },
    {
      refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
      refetchOnWindowFocus: true,
    }
  );

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error loading dashboard data',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="mt-4 text-lg">No dashboard data available.</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerMultipleToasts(toast)}
            className="mr-2"
          >
            <Bell className="h-4 w-4 mr-2" />
            Test Notifications
          </Button>
          <Button
            variant={timeframe === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeframe('week')}
          >
            Week
          </Button>
          <Button
            variant={timeframe === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeframe('month')}
          >
            Month
          </Button>
          <Button
            variant={timeframe === 'year' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeframe('year')}
          >
            Year
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Total Calls</h3>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{dashboardData.totalCalls}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {Math.round((dashboardData.connectedCalls / dashboardData.totalCalls) * 100)}% Connected
          </p>
        </Card>
        
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Active Leads</h3>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{dashboardData.activeLeads}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {dashboardData.callsToday} calls today
          </p>
        </Card>
        
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Avg. Call Duration</h3>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{dashboardData.averageCallDuration}</p>
          <p className="text-xs text-muted-foreground mt-1">
            minutes per call
          </p>
        </Card>
        
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Conversion Rate</h3>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{dashboardData.conversionRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            of connected calls
          </p>
        </Card>
      </div>

      {/* Charts and Data Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <Card className="col-span-2 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Call Volume Trends</h3>
            <LineChart className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[300px] flex items-center justify-center border-t pt-4">
            <p className="text-muted-foreground text-sm">Chart visualization will be implemented with Chart.js</p>
            {/* Will be replaced with actual Chart.js implementation */}
          </div>
        </Card>

        {/* Call Outcomes */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Call Outcomes</h3>
            <PieChart className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[300px] flex items-center justify-center border-t pt-4">
            <p className="text-muted-foreground text-sm">Pie chart visualization will be implemented with Chart.js</p>
            {/* Will be replaced with actual Chart.js implementation */}
          </div>
        </Card>
      </div>

      {/* Recent Activity and Callbacks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Calls */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Recent Calls</h3>
            <Button variant="outline" size="sm">View All</Button>
          </div>
          <div className="divide-y">
            {dashboardData.recentCalls.map((call) => (
              <div key={call.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{call.leadName}</p>
                  <p className="text-sm text-muted-foreground">{call.time} • {call.duration}</p>
                </div>
                <div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    call.outcome === 'Interested' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                      : call.outcome === 'Not Interested'
                      ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
                  }`}>
                    {call.outcome}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming Callbacks */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Upcoming Callbacks</h3>
            <Button variant="outline" size="sm">View All</Button>
          </div>
          <div className="divide-y">
            {dashboardData.upcomingCallbacks.map((callback) => (
              <div key={callback.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{callback.leadName}</p>
                    <p className="text-sm text-muted-foreground">{callback.company}</p>
                  </div>
                  <Button variant="outline" size="sm">Call Now</Button>
                </div>
                <div className="flex items-center mt-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-1" />
                  {callback.date}, {callback.time}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
