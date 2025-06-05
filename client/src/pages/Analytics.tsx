import { useState } from 'react';
import { useQuery } from 'react-query';
import {
  TrendingUp,
  Phone,
  Users,
  Clock,
  Target,
  Calendar,
  Download,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  Info,
  CheckCircle,
  PieChart,
  LineChart,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
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

interface AnalyticsData {
  summary: {
    totalCalls: number;
    completedCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageDuration: number;
    totalDuration: number;
    successRate: number;
    conversionRate: number;
    negativeRate: number;
    outcomes?: Record<string, number>;
  };
  timeline: Array<{
    date: string;
    totalCalls: number;
    completedCalls: number;
    successfulCalls: number;
    averageDuration: number;
  }>;
}

const Analytics = () => {
  const [dateRange, setDateRange] = useState('30');

  // Production implementation - fetch from API
  const { data: analyticsData, isLoading, error } = useQuery<AnalyticsData>(
    ['analytics', dateRange],
    async () => {
      try {
        const params = new URLSearchParams();
        if (dateRange !== 'all') {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - parseInt(dateRange));
          params.append('startDate', startDate.toISOString());
        }

        // Use the unified analytics endpoint for consistent data
        const response = await api.get(`/analytics/unified-metrics?${params.toString()}`);
        return response.data.data; // Extract data from the success response
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        // Clear any cached data that might be causing issues
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.removeItem('analytics-cache');
          } catch (storageError) {
            console.warn('Could not clear analytics cache:', storageError);
          }
        }
        // Return empty data instead of throwing to prevent UI error
        return {
          summary: {
            totalCalls: 0,
            completedCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            averageDuration: 0,
            totalDuration: 0,
            successRate: 0,
            conversionRate: 0,
            negativeRate: 0,
            outcomes: {}
          },
          timeline: []
        };
      }
    },
    {
      refetchOnWindowFocus: true,
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
          <div className="flex gap-2">
            <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
            <div className="h-10 bg-muted rounded w-24 animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 sm:p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Analytics Dashboard</h1>
        <Card className="p-6 sm:p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load analytics data</h3>
          <p className="text-muted-foreground mb-4">
            Unable to fetch analytics data. Please try again.
          </p>
          <Button onClick={() => window.location.reload()} size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  // Default data with zero values if no data is returned
  const displayData: AnalyticsData = analyticsData || {
    summary: {
      totalCalls: 0,
      completedCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageDuration: 0,
      totalDuration: 0,
      successRate: 0,
      conversionRate: 0,
      negativeRate: 0,
      outcomes: {}
    },
    timeline: []
  };

  // Generate area chart data from timeline
  const generateAreaChartData = () => {
    if (!displayData?.timeline || displayData.timeline.length === 0) {
      return []; // Return empty array instead of mock data
    }

    // If we have data, process it to show real data
    const recentData = displayData.timeline.slice(-7);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Generate data for the area chart based on timeline
    return recentData.map((item) => {
      const date = new Date(item.date);
      const dayName = dayNames[date.getDay()];
      return {
        day: dayName,
        calls: item.totalCalls || 0
      };
    });
  };

  // Generate pie chart data for call outcomes
  const generatePieChartData = () => {
    if (!displayData?.summary?.outcomes || Object.keys(displayData.summary.outcomes).length === 0) {
      return []; // Return empty array instead of mock data
    }

    const outcomes = displayData.summary.outcomes;
    
    return Object.entries(outcomes).map(([outcome, value]) => {
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
  };

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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Analytics Dashboard</h1>
        <div className="flex flex-row gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1 justify-between sm:justify-center">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className="truncate">Last {dateRange} days</span>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setDateRange('7')}>Last 7 days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange('30')}>Last 30 days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange('90')}>Last 90 days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange('all')}>All time</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

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
                      The total number of outbound calls made in the selected time period, including completed and failed calls.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{formatNumber(displayData.summary.totalCalls)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {displayData.summary.completedCalls} completed, {displayData.summary.failedCalls} failed
          </p>
        </Card>

        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Success Rate</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Success Rate</h4>
                    <p className="text-sm text-muted-foreground">
                      Percentage of calls that were successfully completed with a positive outcome.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{displayData.summary.successRate.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            Based on {displayData.summary.completedCalls} completed calls
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
                      The percentage of calls that resulted in a positive outcome, such as a sale or appointment.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{displayData.summary.conversionRate.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            Positive outcomes
          </p>
        </Card>

        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Avg Duration</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Average Duration</h4>
                    <p className="text-sm text-muted-foreground">
                      The average length of time that calls lasted, including talk time and hold time.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{formatDuration(displayData.summary.averageDuration)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Per completed call
          </p>
        </Card>
      </div>

      {/* Charts and Data Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Chart - Call Volume Trends */}
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
            {!displayData?.timeline || displayData.timeline.length === 0 ? (
              <p className="text-muted-foreground text-xs sm:text-sm text-center px-4">No data available for chart visualization</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart data={generateAreaChartData()}>
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

        {/* Call Outcomes Pie Chart */}
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
            {!displayData?.summary?.outcomes || Object.keys(displayData.summary.outcomes).length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-xs sm:text-sm text-center px-4">No outcome data available for chart visualization</p>
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-full w-full">
                <RechartsPieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Pie
                    data={generatePieChartData()}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    strokeWidth={5}
                  >
                    {generatePieChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend
                    content={<ChartLegendContent nameKey="name" />}
                    className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
                  />
                </RechartsPieChart>
              </ChartContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Performance Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-base sm:text-lg font-medium">Performance Summary</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Total Talk Time</span>
              <span className="font-semibold">{formatDuration(displayData.summary.totalDuration)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Positive Outcomes</span>
              <span className="font-semibold text-green-600">
                {displayData.summary.conversionRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Negative Outcomes</span>
              <span className="font-semibold text-red-600">
                {displayData.summary.negativeRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Connection Rate</span>
              <span className="font-semibold">
                {displayData.summary.totalCalls > 0 
                  ? ((displayData.summary.completedCalls / displayData.summary.totalCalls) * 100).toFixed(1)
                  : '0.0'}%
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-base sm:text-lg font-medium">Quick Stats</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Best performing day</p>
                <p className="font-semibold truncate">
                  {displayData.timeline.length > 0 
                    ? new Date(displayData.timeline.reduce((best, day) => 
                        day.successfulCalls > best.successfulCalls ? day : best
                      ).date).toLocaleDateString()
                    : 'No data available'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Total contacts reached</p>
                <p className="font-semibold">{formatNumber(displayData.summary.completedCalls)}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;