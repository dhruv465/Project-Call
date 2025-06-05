import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone, 
  PhoneCall, 
  Search, 
  Download,
  Volume2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Info,
} from 'lucide-react';
import { callsApi } from '@/services/callsApi';
import { useToast } from '@/hooks/useToast';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

interface Call {
  _id: string;
  leadId: {
    _id: string;
    name: string;
    phoneNumber: string;
    company?: string;
  } | null;
  campaignId: {
    _id: string;
    name: string;
  } | null;
  phoneNumber: string;
  status: 'queued' | 'dialing' | 'in-progress' | 'completed' | 'failed' | 'no-answer' | 'busy' | 'voicemail' | 'scheduled' | 'pending';
  duration?: number;
  startTime?: string;
  endTime?: string;
  outcome?: string;
  notes?: string;
  recordingUrl?: string;
}

const Calls = () => {
  const { toast } = useToast();
  const [calls, setCalls] = useState<Call[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Fetch calls from API
    const fetchCalls = async () => {
      try {
        setLoading(true);
        const response = await callsApi.getCallHistory({
          status: statusFilter !== 'all' ? statusFilter : undefined
        });
        setCalls(response.calls || []);
      } catch (error) {
        console.error('Error fetching calls:', error);
        toast({
          title: "Error loading calls",
          description: "There was a problem loading your call history. Please try again.",
          variant: "destructive"
        });
        setCalls([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();
  }, [statusFilter]);

  // Handle exporting call data
  const handleExportCalls = async (format: 'csv' | 'json' | 'xlsx') => {
    try {
      setIsExporting(true);
      
      const blobData = await callsApi.exportCalls({
        format,
        status: statusFilter !== 'all' ? statusFilter : undefined
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([blobData]));
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
      link.setAttribute('download', `call-history-${dateStr}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast({
        title: "Export Successful",
        description: `Calls have been exported in ${format.toUpperCase()} format.`,
      });
    } catch (error) {
      console.error('Error exporting calls:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting the call data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusIcon = (status: Call['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'scheduled':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getOutcomeBadge = (outcome?: string) => {
    if (!outcome) {
      return <Badge className="bg-gray-100 text-gray-800">unknown</Badge>;
    }
    
    const variants: Record<string, string> = {
      'answered': 'bg-green-100 text-green-800',
      'voicemail': 'bg-yellow-100 text-yellow-800',
      'no-answer': 'bg-gray-100 text-gray-800',
      'busy': 'bg-orange-100 text-orange-800',
      'interested': 'bg-blue-100 text-blue-800',
      'not-interested': 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={variants[outcome] || 'bg-gray-100 text-gray-800'}>
        {outcome.replace('-', ' ')}
      </Badge>
    );
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredCalls = calls.filter((call: Call) => {
    const leadName = call.leadId?.name || '';
    const leadPhone = call.phoneNumber || '';
    const campaignName = call.campaignId?.name || '';
    
    const matchesSearch = leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         leadPhone.includes(searchTerm) ||
                         campaignName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Function to play or pause a call recording
  const handlePlayRecording = async (callId: string, recordingUrl?: string) => {
    try {
      // If already playing this recording, pause it
      if (currentPlayingId === callId && audioPlayer) {
        audioPlayer.pause();
        setCurrentPlayingId(null);
        return;
      }
      
      // If another recording is playing, stop it
      if (audioPlayer) {
        audioPlayer.pause();
      }

      // If no recording URL is provided, fetch it from the API
      let audioUrl = recordingUrl;
      if (!audioUrl) {
        const response = await callsApi.getCallRecording(callId);
        audioUrl = response.recordingUrl;
      }

      if (!audioUrl) {
        console.error('No recording URL available');
        return;
      }

      // If the URL doesn't start with http, it's a relative URL to our proxy endpoint
      // This ensures we use the authenticated proxy for Twilio URLs
      if (!audioUrl.startsWith('http')) {
        // Add the base URL for our API
        audioUrl = `${import.meta.env.VITE_API_BASE_URL || ''}${audioUrl}`;
      }

      // Create and play the audio
      const audio = new Audio(audioUrl);
      audio.addEventListener('ended', () => {
        setCurrentPlayingId(null);
      });
      
      audio.play();
      setAudioPlayer(audio);
      setCurrentPlayingId(callId);
    } catch (error) {
      console.error('Error playing recording:', error);
      toast({
        title: "Playback Error",
        description: "There was a problem playing this recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <PhoneCall className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading calls...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
        <div className="min-w-0 flex-shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">Call History</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            View and manage all your AI-generated calls
          </p>
        </div>
        <div className="flex flex-row gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCalls('csv')}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button
            size="sm"
            onClick={() => handleExportCalls('xlsx')}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
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
                      The total number of calls made across all campaigns and time periods in your call history.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calls.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Successful Calls</h4>
                    <p className="text-sm text-muted-foreground">
                      The number of calls that were successfully completed, regardless of outcome.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {calls.filter((c: Call) => c.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Average Duration</CardTitle>
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
                      The average length of time for all calls in your history, including talk time and hold time.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(Math.round(calls.reduce((acc: number, call: Call) => acc + (call.duration || 0), 0) / calls.length))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Interested Leads</CardTitle>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Info</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Interested Leads</h4>
                    <p className="text-sm text-muted-foreground">
                      The number of calls that resulted in interested leads showing positive engagement.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {calls.filter((c: Call) => c.outcome === 'interested').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Collapsible className="w-full">
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg">Filters</CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                  <ChevronDown className="h-4 w-4" />
                  <span className="sr-only">Toggle filters</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 px-3 sm:px-4">
              <div className="flex flex-col space-y-4 sm:flex-row sm:gap-4 sm:space-y-0">
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search calls..."
                      value={searchTerm}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-48">
                  <Select
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                  >
                    <SelectTrigger className="w-full h-10 rounded-xl">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Calls List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
          <CardDescription>
            {filteredCalls.length} call{filteredCalls.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="space-y-4">
            {filteredCalls.map((call: Call) => (
              <div key={call._id}>
                {/* Desktop Layout - Hidden on mobile */}
                <div className="hidden lg:block">
                  <ResizablePanelGroup
                    direction="horizontal"
                    className="border rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <ResizablePanel defaultSize={70}>
                      <div className="flex items-center space-x-4 p-4 h-full">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(call.status)}
                          <div>
                            <p className="font-medium">{call.leadId?.name || 'Unknown Lead'}</p>
                            <p className="text-sm text-muted-foreground">{call.phoneNumber}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{call.campaignId?.name || 'Unknown Campaign'}</p>
                          <p className="text-sm text-muted-foreground">
                            {call.startTime ? new Date(call.startTime).toLocaleDateString() : 'Unknown'} at {call.startTime ? new Date(call.startTime).toLocaleTimeString() : 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </ResizablePanel>
                    
                    <ResizableHandle withHandle />
                    
                    <ResizablePanel defaultSize={30}>
                      <div className="flex items-center justify-end space-x-4 p-4 h-full">
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatDuration(call.duration)}</p>
                          {getOutcomeBadge(call.outcome)}
                        </div>
                        {call.recordingUrl && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handlePlayRecording(call._id, call.recordingUrl)}
                          >
                            <Volume2 className="h-4 w-4 mr-1" />
                            {currentPlayingId === call._id ? 'Pause' : 'Play'}
                          </Button>
                        )}
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </div>

                {/* Mobile Layout - Hidden on desktop */}
                <div className="lg:hidden">
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header row */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            {getStatusIcon(call.status)}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{call.leadId?.name || 'Unknown Lead'}</p>
                              <p className="text-sm text-muted-foreground truncate">{call.phoneNumber}</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {getOutcomeBadge(call.outcome)}
                          </div>
                        </div>

                        {/* Campaign and date row */}
                        <div className="space-y-1">
                          <p className="text-sm font-medium truncate">{call.campaignId?.name || 'Unknown Campaign'}</p>
                          <p className="text-sm text-muted-foreground">
                            {call.startTime ? new Date(call.startTime).toLocaleDateString() : 'Unknown'} at {call.startTime ? new Date(call.startTime).toLocaleTimeString() : 'Unknown'}
                          </p>
                        </div>

                        {/* Duration and actions row */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="text-sm font-medium">
                            Duration: {formatDuration(call.duration)}
                          </div>
                          {call.recordingUrl && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handlePlayRecording(call._id, call.recordingUrl)}
                              className="flex-shrink-0"
                            >
                              <Volume2 className="h-4 w-4 mr-1" />
                              {currentPlayingId === call._id ? 'Pause' : 'Play'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
            {filteredCalls.length === 0 && (
              <div className="text-center py-8">
                <PhoneCall className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No calls found matching your criteria.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Calls;
