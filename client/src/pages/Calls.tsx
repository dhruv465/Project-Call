import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { callsApi } from '@/services/callsApi';
import { useToast } from '@/components/ui/use-toast';

interface Call {
  id: string;
  leadName: string;
  leadPhone: string;
  campaignName: string;
  status: 'completed' | 'failed' | 'in-progress' | 'scheduled';
  duration: number;
  callDate: Date;
  outcome: 'answered' | 'voicemail' | 'no-answer' | 'busy' | 'interested' | 'not-interested';
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

  const getOutcomeBadge = (outcome: Call['outcome']) => {
    const variants: Record<Call['outcome'], string> = {
      'answered': 'bg-green-100 text-green-800',
      'voicemail': 'bg-yellow-100 text-yellow-800',
      'no-answer': 'bg-gray-100 text-gray-800',
      'busy': 'bg-orange-100 text-orange-800',
      'interested': 'bg-blue-100 text-blue-800',
      'not-interested': 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={variants[outcome]}>
        {outcome.replace('-', ' ')}
      </Badge>
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredCalls = calls.filter((call: Call) => {
    const matchesSearch = call.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         call.leadPhone.includes(searchTerm) ||
                         call.campaignName.toLowerCase().includes(searchTerm.toLowerCase());
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call History</h1>
          <p className="text-muted-foreground">
            View and manage all your AI-generated calls
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => handleExportCalls('csv')}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button
            onClick={() => handleExportCalls('xlsx')}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calls.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
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
            <CardTitle className="text-sm font-medium">Average Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(Math.round(calls.reduce((acc: number, call: Call) => acc + call.duration, 0) / calls.length))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interested Leads</CardTitle>
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
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
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
            <div className="w-48">
              <select
                className="w-full h-10 px-3 rounded-xl border border-input bg-background"
                value={statusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="in-progress">In Progress</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calls List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
          <CardDescription>
            {filteredCalls.length} call{filteredCalls.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredCalls.map((call: Call) => (
              <div
                key={call.id}
                className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(call.status)}
                    <div>
                      <p className="font-medium">{call.leadName}</p>
                      <p className="text-sm text-muted-foreground">{call.leadPhone}</p>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium">{call.campaignName}</p>
                    <p className="text-sm text-muted-foreground">
                      {call.callDate.toLocaleDateString()} at {call.callDate.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">{formatDuration(call.duration)}</p>
                    {getOutcomeBadge(call.outcome)}
                  </div>
                  {call.recordingUrl && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handlePlayRecording(call.id, call.recordingUrl)}
                    >
                      <Volume2 className="h-4 w-4 mr-1" />
                      {currentPlayingId === call.id ? 'Pause' : 'Play'}
                    </Button>
                  )}
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
