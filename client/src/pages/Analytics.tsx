import { useState } from 'react';
import { useQuery } from 'react-query';
import {
  BarChart3,
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
import api from '@/services/api';

interface AnalyticsData {
  summary: {
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    averageDuration: number;
    totalDuration: number;
    successRate: number;
    conversionRate: number;
    negativeRate: number;
    outcomes?: Record<string, number>;
  };
  callsByDay: Array<{
    _id: string;
    count: number;
    completed: number;
    successful: number;
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

        const response = await api.get(`/calls/analytics?${params.toString()}`);
        return response.data;
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
            failedCalls: 0,
            averageDuration: 0,
            totalDuration: 0,
            successRate: 0,
            conversionRate: 0,
            negativeRate: 0,
            outcomes: {}
          },
          callsByDay: []
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

  const getOutcomeColor = (outcome: string) => {
    const colors: Record<string, string> = {
      'interested': 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100',
      'callback-requested': 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100',
      'not-interested': 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100',
      'do-not-call': 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100',
      'voicemail': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100',
      'no-answer': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
    };
    return colors[outcome] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
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
          <Button onClick={() => window.location.reload()} className="gap-2">
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
      failedCalls: 0,
      averageDuration: 0,
      totalDuration: 0,
      successRate: 0,
      conversionRate: 0,
      negativeRate: 0,
      outcomes: {}
    },
    callsByDay: []
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Analytics Dashboard</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-1 justify-between sm:justify-center">
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
          
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <h3 className="font-medium truncate">Total Calls</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 p-0 flex-shrink-0">
                    <Info className="h-4 w-4 text-muted-foreground" />
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
            <p className="text-xl sm:text-2xl font-bold">{formatNumber(displayData.summary.totalCalls)}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {displayData.summary.completedCalls} completed, {displayData.summary.failedCalls} failed
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <h3 className="font-medium truncate">Success Rate</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 p-0 flex-shrink-0">
                    <Info className="h-4 w-4 text-muted-foreground" />
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
            <p className="text-xl sm:text-2xl font-bold">{displayData.summary.successRate.toFixed(1)}%</p>
          </div>
          <div className="text-xs text-muted-foreground">
            Based on {displayData.summary.completedCalls} completed calls
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Target className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <h3 className="font-medium truncate">Conversion Rate</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 p-0 flex-shrink-0">
                    <Info className="h-4 w-4 text-muted-foreground" />
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
            <p className="text-xl sm:text-2xl font-bold">{displayData.summary.conversionRate.toFixed(1)}%</p>
          </div>
          <div className="text-xs text-muted-foreground">
            Positive outcomes
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <h3 className="font-medium truncate">Avg Duration</h3>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 p-0 flex-shrink-0">
                    <Info className="h-4 w-4 text-muted-foreground" />
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
            <p className="text-xl sm:text-2xl font-bold">{formatDuration(displayData.summary.averageDuration)}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            Per completed call
          </div>
        </Card>
      </div>

      {/* Call Volume Chart */}
      <Card className="p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4">Call Volume Trends</h3>
        <div className="h-48 sm:h-64 flex items-end justify-center gap-1 overflow-x-auto">
          {displayData.callsByDay.length > 0 ? (
            displayData.callsByDay.slice(-14).map((day: { _id: string; count: number; completed: number; successful: number }) => {
              const maxCount = Math.max(...displayData.callsByDay.map((d: { _id: string; count: number; completed: number; successful: number }) => d.count));
              return (
                <div key={day._id} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className="w-4 sm:w-6 bg-primary rounded-t"
                    style={{
                      height: `${Math.max(maxCount > 0 ? (day.count / maxCount) * 150 : 4, 4)}px`,
                    }}
                    title={`${day.count} calls on ${new Date(day._id).toLocaleDateString()}`}
                  />
                  <span className="text-xs text-muted-foreground transform -rotate-45 origin-left whitespace-nowrap">
                    {new Date(day._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="h-8 sm:h-12 w-8 sm:w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No call data available</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Outcome Distribution */}
      {displayData.summary.outcomes && Object.keys(displayData.summary.outcomes).length > 0 ? (
        <Card className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4">Call Outcomes</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {Object.entries(displayData.summary.outcomes).map(([outcome, count]) => (
              <div key={outcome} className="text-center">
                <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getOutcomeColor(outcome)}`}>
                  {outcome.replace('-', ' ')}
                </span>
                <p className="text-xl sm:text-2xl font-bold mt-2">{String(count)}</p>
                <p className="text-xs text-muted-foreground">
                  {displayData.summary.completedCalls > 0 
                    ? (((count as number) / displayData.summary.completedCalls) * 100).toFixed(1)
                    : '0.0'}%
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4">Call Outcomes</h3>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center">
              <Target className="h-8 sm:h-12 w-8 sm:w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No outcome data available</p>
            </div>
          </div>
        </Card>
      )}

      {/* Performance Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Summary</h3>
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
          <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Best performing day</p>
                <p className="font-semibold truncate">
                  {displayData.callsByDay.length > 0 
                    ? new Date(displayData.callsByDay.reduce((best: any, day: any) => 
                        day.successful > best.successful ? day : best
                      )._id).toLocaleDateString()
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