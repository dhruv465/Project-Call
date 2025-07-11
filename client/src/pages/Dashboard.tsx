import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, PieChart, Phone, Users, Calendar, Clock, CheckCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Skeleton } from "@/components/ui/skeleton";
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { useSocketIO } from '@/hooks/useSocketIO';
import api from '@/services/api';
import {
  Area,
  AreaChart,
  Pie,
  PieChart as RechartsPieChart,
  Cell,
  XAxis,
  YAxis,
} from 'recharts';

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
  // Optional additional metrics from consolidated analytics
  metrics?: {
    totalCalls: number;
    completedCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageDuration: number;
    totalDuration: number;
    successRate: number;
    conversionRate: number;
    negativeRate: number;
    outcomes: Record<string, number>;
  };
  timeline?: Array<{
    date: string;
    totalCalls: number;
    completedCalls: number;
    successfulCalls: number;
    averageDuration: number;
  }>;
}

// Dashboard data will be fetched from the server
const Dashboard = () => {
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState('week'); // week, month, year
  const { isConnected, systemMetrics, activeCalls } = useSocketIO();
  const [dashboardState, setDashboardState] = useState<DashboardData | null>(null);

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboardOverview', timeframe],
    queryFn: async () => {
      try {
        // Use the consolidated analytics endpoint for consistent data
        const params = new URLSearchParams();
        if (timeframe !== 'all') {
          const startDate = new Date();
          // Map timeframe to days
          const timeframeDays = {
            'week': 7,
            'month': 30,
            'quarter': 90,
            'year': 365
          };
          const days = timeframeDays[timeframe as keyof typeof timeframeDays] || 30;
          startDate.setDate(startDate.getDate() - days);
          params.append('startDate', startDate.toISOString());
        }
        
        const response = await api.get(`/analytics/unified-metrics?${params.toString()}`);
        
        if (response.data?.data) {
          // Transform analytics data to dashboard format for compatibility
          const analyticsData = response.data.data;
          return {
            totalCalls: analyticsData.summary.totalCalls,
            connectedCalls: analyticsData.summary.completedCalls,
            activeLeads: 0, // This would need to be fetched separately if needed
            callsToday: analyticsData.summary.totalCalls, // Simplified for now
            averageCallDuration: `${Math.floor(analyticsData.summary.averageDuration / 60)}:${(analyticsData.summary.averageDuration % 60).toString().padStart(2, '0')}`,
            conversionRate: Math.round(analyticsData.summary.conversionRate),
            recentCalls: [],
            upcomingCallbacks: [],
            // Add the comprehensive metrics from analytics
            metrics: analyticsData.summary,
            timeline: analyticsData.timeline
          };
        }
        
        throw new Error('No data received from API');
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
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    refetchOnWindowFocus: true,
  });

  // Update the local dashboard state when the query returns data
  useEffect(() => {
    if (dashboardData) {
      setDashboardState(dashboardData);
    }
  }, [dashboardData]);

  // Handle real-time metrics updates
  useEffect(() => {
    if (systemMetrics && dashboardState) {
      // Update dashboard data with real-time metrics
      setDashboardState(prevState => {
        if (!prevState) return prevState;
        
        return {
          ...prevState,
          totalCalls: systemMetrics.totalCalls24h || prevState.totalCalls,
          connectedCalls: systemMetrics.activeConnections || prevState.connectedCalls,
          averageCallDuration: systemMetrics.averageDuration 
            ? `${Math.floor(systemMetrics.averageDuration / 60)}:${(systemMetrics.averageDuration % 60).toString().padStart(2, '0')}`
            : prevState.averageCallDuration,
          conversionRate: systemMetrics.successRate24h 
            ? Math.round(systemMetrics.successRate24h * 100) 
            : prevState.conversionRate
        };
      });
    }
  }, [systemMetrics, dashboardState]);

  // Handle real-time active calls updates
  useEffect(() => {
    if (activeCalls && activeCalls.length > 0 && dashboardState) {
      // Update the recent calls list with active calls data
      const updatedRecentCalls = activeCalls.map(call => ({
        id: call.id,
        leadName: call.phoneNumber, // Use phone number if lead name is not available
        time: new Date(call.startTime).toLocaleTimeString(),
        duration: call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : '0:00',
        status: call.status,
        outcome: 'In Progress'
      }));
      
      // Update the dashboard data with the new recent calls
      setDashboardState(prevState => {
        if (!prevState) return prevState;
        
        return {
          ...prevState,
          recentCalls: updatedRecentCalls
        };
      });
    }
  }, [activeCalls, dashboardState]);

  // Generate chart data based on dashboard state
  const generateChartData = () => {
    // No default data for empty state - we want to show only real data
    // If we have no data, return empty arrays with proper typing
    if (!dashboardState) {
      return { 
        areaData: [] as { day: string, calls: number }[], 
        pieData: [] as { name: string, value: number, fill: string }[] 
      };
    }

    // Generate area chart data from timeline
    let areaData: { day: string, calls: number }[] = [];
    
    if (dashboardState?.timeline && dashboardState.timeline.length > 0) {
      // If we have timeline data from the API, use it (same as Analytics page)
      const recentData = dashboardState.timeline.slice(-7);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      // Generate data for the area chart based on timeline
      areaData = recentData.map((item) => {
        const date = new Date(item.date);
        const dayName = dayNames[date.getDay()];
        return {
          day: dayName,
          calls: item.totalCalls || 0
        };
      });
    }
    
    // Pie chart data based on metrics
    let pieData: { name: string, value: number, fill: string }[] = [];
    
    if (dashboardState?.metrics?.outcomes && Object.keys(dashboardState.metrics.outcomes).length > 0) {
      // If we have outcome data from the API, use it (same format as Analytics page)
      const outcomes = dashboardState.metrics.outcomes;
      
      pieData = Object.entries(outcomes).map(([outcome, value]) => {
        const name = outcome.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        let fill: string;
        
        switch (outcome.toLowerCase()) {
          case 'interested':
          case 'callback-requested':
            fill = '#22c55e';
            break;
          case 'not-interested':
          case 'do-not-call':
            fill = '#ef4444';
            break;
          case 'voicemail':
            fill = '#eab308';
            break;
          case 'no-answer':
            fill = '#9ca3af';
            break;
          default:
            fill = '#3b82f6';
            break;
        }
        
        return { name, value, fill };
      });
    } else {
      // We want to show only real data, so return empty array if no outcomes available
      pieData = [];
    }
    
    return { areaData, pieData };
  };
  
  const { areaData, pieData } = generateChartData();

  // Chart configuration for shadcn/ui
  const chartConfig = {
    calls: {
      label: "Calls",
      color: "hsl(var(--chart-1))",
    },
    connected: {
      label: "Connected",
      color: "#22c55e",
    },
    "not-connected": {
      label: "Not Connected",
      color: "#ef4444",
    },
    voicemail: {
      label: "Voicemail",
      color: "#eab308",
    },
    interested: {
      label: "Interested",
      color: "#22c55e",
    },
    "callback-requested": {
      label: "Callback Requested", 
      color: "#22c55e",
    },
    "not-interested": {
      label: "Not Interested",
      color: "#ef4444",
    },
    "do-not-call": {
      label: "Do Not Call",
      color: "#ef4444",
    },
    "no-answer": {
      label: "No Answer",
      color: "#9ca3af",
    },
  };

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error loading dashboard data',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  // Log socket connection status
  useEffect(() => {
    console.log('Socket connection status:', isConnected);
  }, [isConnected]);

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
  const displayData: DashboardData = dashboardState || {
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
        
        <div className="flex flex-row gap-2 flex-wrap">
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

      {/* Socket connection status indicator */}
      {isConnected && (
        <div className="flex items-center text-sm text-green-600 dark:text-green-400 mb-2">
          <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full mr-2"></div>
          <span>Real-time data connected</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Total Calls</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Total Calls</h4>
                    <p className="text-sm text-muted-foreground">
                      The total number of outbound calls made across all campaigns and time periods.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
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
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Active Leads</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Active Leads</h4>
                    <p className="text-sm text-muted-foreground">
                      The number of leads currently available for calling and follow-up activities.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{displayData.activeLeads}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {displayData.callsToday} calls today
          </p>
        </Card>
        
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Avg. Call Duration</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Average Call Duration</h4>
                    <p className="text-sm text-muted-foreground">
                      The average length of time for all completed calls, including talk time.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{displayData.averageCallDuration}</p>
          <p className="text-xs text-muted-foreground mt-1">
            minutes per call
          </p>
        </Card>
        
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Conversion Rate</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Conversion Rate</h4>
                    <p className="text-sm text-muted-foreground">
                      The percentage of connected calls that resulted in a positive outcome or next step.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
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
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-medium">Call Volume Trends</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Call Volume Trends</h4>
                    <p className="text-sm text-muted-foreground">
                      Weekly call volume trends showing the number of calls made over time to help identify patterns and optimize timing.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <LineChart className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[250px] sm:h-[300px] flex items-center justify-center border-t pt-4">
            {(!dashboardState || areaData.length === 0) ? (
              <p className="text-muted-foreground text-xs sm:text-sm text-center px-4">No data available for chart visualization</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart data={areaData}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="hsl(var(--chart-1))"
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </div>
        </Card>

        {/* Call Outcomes */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-medium">Call Outcomes</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Call Outcomes</h4>
                    <p className="text-sm text-muted-foreground">
                      Distribution of call outcomes showing the proportion of interested, not interested, and other call results.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <PieChart className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[250px] sm:h-[300px]">
            {(!dashboardState || pieData.length === 0) ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-xs sm:text-sm text-center px-4">No data available for chart visualization</p>
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-full w-full">
                <RechartsPieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    strokeWidth={5}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend
                    content={<ChartLegendContent nameKey="name" />}
                    className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/3 [&>*]:justify-center"
                  />
                </RechartsPieChart>
              </ChartContainer>
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
            <Button variant="outline" size="sm">View All</Button>
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
