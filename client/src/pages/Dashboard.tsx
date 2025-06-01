import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, PieChart, Phone, Users, Calendar, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from "@/components/ui/skeleton";

// Type definitions
interface RecentCall {
  id: string;
  leadName: string;
  time: string;
  duration: string;
  status: string;
  outcome: string;
}

interface UpcomingCallback {
  id: string;
  leadName: string;
  time: string;
  campaign: string;
  company: string;
  date: string;
}

interface DashboardData {
  totalCalls: number;
  connectedCalls: number;
  activeLeads: number;
  callsToday: number;
  averageCallDuration: string;
  conversionRate: number;
  recentCalls: RecentCall[];
  upcomingCallbacks: UpcomingCallback[];
}

// Dashboard data will be fetched from the server

const Dashboard = () => {
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState('week'); // week, month, year

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error } = useQuery(
    ['dashboardOverview', timeframe],
    async () => {
      try {
        // Fetch data from API
        const response = await fetch(`/api/dashboard/overview?timeframe=${timeframe}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          // For 404 Not Found errors, return empty data instead of throwing
          if (response.status === 404) {
            return {
              totalCalls: 0,
              connectedCalls: 0,
              activeLeads: 0,
              callsToday: 0,
              averageCallDuration: "0",
              conversionRate: 0,
              recentCalls: [],
              upcomingCallbacks: []
            };
          }
          throw new Error('Failed to fetch dashboard data');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Return empty data for new installations
        return {
          totalCalls: 0,
          connectedCalls: 0,
          activeLeads: 0,
          callsToday: 0,
          averageCallDuration: "0",
          conversionRate: 0,
          recentCalls: [],
          upcomingCallbacks: []
        };
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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Skeleton className="h-8 w-48 mb-2" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Card className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-40 w-full" />
          </Card>
          <Card className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-40 w-full" />
          </Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Card className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-6 w-full mb-2" />
            ))}
          </Card>
          <Card className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-6 w-full mb-2" />
            ))}
          </Card>
        </div>
      </div>
    );
  }
  
  // Create a display data object with default values when data is not available
  const displayData: DashboardData = {
    totalCalls: dashboardData?.totalCalls || 0,
    connectedCalls: dashboardData?.connectedCalls || 0,
    activeLeads: dashboardData?.activeLeads || 0,
    callsToday: dashboardData?.callsToday || 0,
    averageCallDuration: dashboardData?.averageCallDuration || "0",
    conversionRate: dashboardData?.conversionRate || 0,
    recentCalls: dashboardData?.recentCalls || [],
    upcomingCallbacks: dashboardData?.upcomingCallbacks || []
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        
        <div className="flex flex-wrap items-center gap-2">
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
          <p className="text-2xl font-bold mt-2">{displayData.totalCalls}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {displayData.totalCalls > 0 
              ? `${Math.round((displayData.connectedCalls / displayData.totalCalls) * 100)}%` 
              : "0%"} Connected
          </p>
        </Card>
        
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Active Leads</h3>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{displayData.activeLeads}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {displayData.callsToday} calls today
          </p>
        </Card>
        
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Avg. Call Duration</h3>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{displayData.averageCallDuration}</p>
          <p className="text-xs text-muted-foreground mt-1">
            minutes per call
          </p>
        </Card>
        
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Conversion Rate</h3>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{displayData.conversionRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            of connected calls
          </p>
        </Card>
      </div>

      {/* Charts and Data Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Chart */}
        <Card className="xl:col-span-2 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-medium">Call Volume Trends</h3>
            <LineChart className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[250px] sm:h-[300px] flex items-center justify-center border-t pt-4">
            {!dashboardData ? (
              <p className="text-muted-foreground text-xs sm:text-sm text-center px-4">No data available for chart visualization</p>
            ) : (
              <p className="text-muted-foreground text-xs sm:text-sm text-center px-4">Chart visualization will be implemented with Chart.js</p>
            )}
          </div>
        </Card>

        {/* Call Outcomes */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-medium">Call Outcomes</h3>
            <PieChart className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[250px] sm:h-[300px] flex items-center justify-center border-t pt-4">
            {!dashboardData ? (
              <p className="text-muted-foreground text-xs sm:text-sm text-center px-4">No data available for chart visualization</p>
            ) : (
              <p className="text-muted-foreground text-xs sm:text-sm text-center px-4">Pie chart visualization will be implemented with Chart.js</p>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Activity and Callbacks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Calls */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-base sm:text-lg font-medium">Recent Calls</h3>
            <div className="flex-shrink-0">
              <Button variant="outline" size="sm">View All</Button>
            </div>
          </div>
          {displayData.recentCalls && displayData.recentCalls.length > 0 ? (
            <div className="divide-y">
              {displayData.recentCalls.map((call: RecentCall) => (
                <div key={call.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{call.leadName}</p>
                    <p className="text-sm text-muted-foreground">{call.time} • {call.duration}</p>
                  </div>
                  <div className="flex-shrink-0">
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
          ) : (
            <div className="py-8 text-center border-t">
              <p className="text-muted-foreground text-sm">No recent calls to display</p>
            </div>
          )}
        </Card>

        {/* Upcoming Callbacks */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-base sm:text-lg font-medium">Upcoming Callbacks</h3>
            <Button variant="outline" size="sm">View All</Button>
          </div>
          {displayData.upcomingCallbacks && displayData.upcomingCallbacks.length > 0 ? (
            <div className="divide-y">
              {displayData.upcomingCallbacks.map((callback: UpcomingCallback) => (
                <div key={callback.id} className="py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{callback.leadName}</p>
                      <p className="text-sm text-muted-foreground truncate">{callback.company}</p>
                    </div>
                    <Button variant="outline" size="sm">Call Now</Button>
                  </div>
                  <div className="flex items-center mt-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span className="truncate">{callback.date}, {callback.time}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center border-t">
              <p className="text-muted-foreground text-sm">No upcoming callbacks scheduled</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
