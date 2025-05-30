import { useState } from 'react';
import { useQuery } from 'react-query';
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  ChevronDown,
  Trash2,
  Edit,
  Play,
  Pause,
  AlertTriangle,
  Info,
  MessageSquare,
  BarChart3,
  Zap
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import CampaignForm from '@/components/campaigns/CampaignForm';
// import api from '@/services/api'; // Commented out as not currently used

// Define Campaign type based on the server model
interface Campaign {
  _id: string;
  name: string;
  description: string;
  goal: string;
  targetAudience: string;
  script: {
    versions: {
      name: string;
      content: string;
      isActive: boolean;
      performance?: {
        successRate: number;
        avgCallDuration: number;
        conversionRate: number;
      };
    }[];
  };
  leadSources: string[];
  status: 'Draft' | 'Active' | 'Paused' | 'Completed';
  startDate: string;
  endDate?: string;
  primaryLanguage: string;
  supportedLanguages: string[];
  callTiming: {
    daysOfWeek: string[];
    startTime: string;
    endTime: string;
    timeZone: string;
  };
  llmConfiguration: {
    model: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
  };
  voiceConfiguration: {
    provider: string;
    voiceId: string;
    speed: number;
    pitch: number;
  };
  metrics: {
    totalCalls: number;
    connectedCalls: number;
    successfulCalls: number;
    avgCallDuration: number;
    conversionRate: number;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Mock data for initial development
const mockCampaigns: Campaign[] = Array.from({ length: 10 }, (_, i) => ({
  _id: `campaign-${i + 1}`,
  name: [
    'Q1 Lead Qualification',
    'Tech Companies Outreach',
    'Healthcare Solutions',
    'SMB Follow-up',
    'Enterprise Renewals',
    'Education Sector Outreach',
    'New Product Introduction',
    'Customer Feedback',
    'Appointment Scheduling',
    'Expired Subscription Renewal'
  ][i],
  description: 'Campaign to reach out to potential clients and qualify their interest in our services.',
  goal: [
    'Qualify leads for sales team',
    'Book product demos',
    'Schedule follow-up calls',
    'Gather feedback',
    'Renew subscriptions'
  ][i % 5],
  targetAudience: [
    'Technology companies in Bangalore',
    'Healthcare providers in Mumbai',
    'Educational institutions in Delhi',
    'Financial services in Chennai',
    'Manufacturing businesses in Pune'
  ][i % 5],
  script: {
    versions: [
      {
        name: 'Primary Script',
        content: 'Hello, this is {agent_name} calling from {company_name}. I wanted to discuss how our {product_name} could help your business. Do you have a few minutes to talk?',
        isActive: true,
        performance: {
          successRate: Math.random() * 0.5 + 0.2,
          avgCallDuration: Math.floor(Math.random() * 180) + 60,
          conversionRate: Math.random() * 0.3 + 0.1,
        },
      },
    ],
  },
  leadSources: [
    ['Website Form', 'LinkedIn Campaign'],
    ['Trade Show', 'Referrals'],
    ['Cold List', 'Partner Network'],
    ['Website Visitors', 'Demo Requests'],
    ['Previous Customers']
  ][i % 5],
  status: ['Draft', 'Active', 'Paused', 'Completed'][Math.floor(Math.random() * 4)] as 'Draft' | 'Active' | 'Paused' | 'Completed',
  startDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
  endDate: Math.random() > 0.5 ? new Date(Date.now() + Math.floor(Math.random() * 30) * 86400000).toISOString() : undefined,
  primaryLanguage: 'English',
  supportedLanguages: ['English', 'Hindi'],
  callTiming: {
    daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: '09:00',
    endTime: '17:00',
    timeZone: 'Asia/Kolkata',
  },
  llmConfiguration: {
    model: 'gpt-4o',
    systemPrompt: 'You are an AI assistant making a call on behalf of a company. Be professional, friendly, and helpful.',
    temperature: 0.7,
    maxTokens: 500,
  },
  voiceConfiguration: {
    provider: 'elevenlabs',
    voiceId: `voice-${i + 1}`,
    speed: 1.0,
    pitch: 1.0,
  },
  metrics: {
    totalCalls: Math.floor(Math.random() * 500) + 50,
    connectedCalls: Math.floor(Math.random() * 300) + 30,
    successfulCalls: Math.floor(Math.random() * 100) + 10,
    avgCallDuration: Math.floor(Math.random() * 180) + 60,
    conversionRate: Math.random() * 0.3 + 0.1,
  },
  createdBy: 'user-1',
  createdAt: new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000).toISOString(),
  updatedAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
}));

const Campaigns = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Fetch campaigns data
  const { data: campaignsData, isLoading, error } = useQuery(
    ['campaigns', statusFilter, currentPage, itemsPerPage],
    async () => {
      try {
        // In a real app, we would fetch data from API
        // const response = await api.get('/campaigns', { 
        //   params: { 
        //     status: statusFilter !== 'All' ? statusFilter : undefined,
        //     page: currentPage,
        //     limit: itemsPerPage
        //   } 
        // });
        // return response.data;
        
        // For now, use mock data
        const filteredCampaigns = mockCampaigns.filter(campaign => {
          const matchesStatus = statusFilter === 'All' || campaign.status === statusFilter;
          const matchesSearch = searchTerm === '' || 
            campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            campaign.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            campaign.goal.toLowerCase().includes(searchTerm.toLowerCase());
          
          return matchesStatus && matchesSearch;
        });
        
        const paginatedCampaigns = filteredCampaigns.slice(
          (currentPage - 1) * itemsPerPage,
          currentPage * itemsPerPage
        );
        
        return {
          campaigns: paginatedCampaigns,
          pagination: {
            page: currentPage,
            limit: itemsPerPage,
            total: filteredCampaigns.length,
            pages: Math.ceil(filteredCampaigns.length / itemsPerPage),
          },
        };
      } catch (error) {
        throw error;
      }
    },
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
    }
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editCampaignId, setEditCampaignId] = useState<string | undefined>(undefined);

  const handleCreateCampaign = () => {
    setEditCampaignId(undefined);
    setIsFormOpen(true);
  };

  const handleViewCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsSheetOpen(true);
  };

  const handleEditCampaign = (campaignId: string) => {
    setEditCampaignId(campaignId);
    setIsFormOpen(true);
  };

  const handleDeleteCampaign = (campaignId: string) => {
    toast({
      title: "Delete Campaign",
      description: `Delete functionality for campaign ${campaignId} will be implemented here.`,
    });
  };

  const handleChangeCampaignStatus = (_campaignId: string, newStatus: 'Draft' | 'Active' | 'Paused' | 'Completed') => {
    toast({
      title: `Campaign ${newStatus}`,
      description: `Campaign status changed to ${newStatus}.`,
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
      case 'Active':
        return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
      case 'Paused':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100';
      case 'Completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  const calculateSuccessRate = (campaign: Campaign) => {
    if (campaign.metrics.connectedCalls === 0) return '0%';
    return `${Math.round((campaign.metrics.successfulCalls / campaign.metrics.connectedCalls) * 100)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Campaign Management</h1>
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <p className="mt-4 text-lg">Failed to load campaigns. Please try again.</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Campaign Management</h1>
        <Button onClick={handleCreateCampaign}>
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns..."
            className="pl-10 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-1">
                <Filter className="h-4 w-4" />
                Status: {statusFilter}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter('All')}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('Draft')}>Draft</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('Active')}>Active</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('Paused')}>Paused</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('Completed')}>Completed</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Campaigns Cards */}
      <div className="grid grid-cols-1 gap-4">
        {campaignsData?.campaigns.map((campaign) => (
          <Card key={campaign._id} className="overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{campaign.name}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2">{campaign.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {campaign.status === 'Draft' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleChangeCampaignStatus(campaign._id, 'Active')}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Activate
                    </Button>
                  )}
                  {campaign.status === 'Active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleChangeCampaignStatus(campaign._id, 'Paused')}
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  {campaign.status === 'Paused' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleChangeCampaignStatus(campaign._id, 'Active')}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewCampaign(campaign)}
                  >
                    <Info className="h-4 w-4 mr-2" />
                    Details
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditCampaign(campaign._id)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Campaign
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewCampaign(campaign)}>
                        <Info className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteCampaign(campaign._id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Campaign
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-muted/50 p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="font-medium">{campaign.metrics.totalCalls}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">Connected Calls</p>
                  <p className="font-medium">{campaign.metrics.connectedCalls} ({Math.round((campaign.metrics.connectedCalls / campaign.metrics.totalCalls) * 100)}%)</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="font-medium">{calculateSuccessRate(campaign)}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {campaignsData && campaignsData.pagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((campaignsData.pagination.page - 1) * campaignsData.pagination.limit) + 1} to {Math.min(campaignsData.pagination.page * campaignsData.pagination.limit, campaignsData.pagination.total)} of {campaignsData.pagination.total} campaigns
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, campaignsData.pagination.pages))}
              disabled={currentPage === campaignsData.pagination.pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Campaign Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-xl p-0">
          {selectedCampaign && (
            <div className="flex flex-col h-full">
              <div className="px-6 py-4 border-b">
                <SheetHeader>
                  <div className="flex items-center justify-between">
                    <SheetTitle>{selectedCampaign.name}</SheetTitle>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedCampaign.status)}`}>
                      {selectedCampaign.status}
                    </span>
                  </div>
                  <SheetDescription>
                    {selectedCampaign.description}
                  </SheetDescription>
                </SheetHeader>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="px-6 py-6 space-y-8">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Campaign Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Goal</p>
                      <p className="font-medium">{selectedCampaign.goal}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Target Audience</p>
                      <p className="font-medium">{selectedCampaign.targetAudience}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Start Date</p>
                      <p className="font-medium">{formatDate(selectedCampaign.startDate)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">End Date</p>
                      <p className="font-medium">{formatDate(selectedCampaign.endDate)}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Lead Sources</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedCampaign.leadSources.map((source, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-muted">
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Languages</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-primary/10">
                          {selectedCampaign.primaryLanguage} (Primary)
                        </span>
                        {selectedCampaign.supportedLanguages
                          .filter(lang => lang !== selectedCampaign.primaryLanguage)
                          .map((lang, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-muted">
                              {lang}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Call Timing */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Call Schedule
                  </h3>
                  <div className="bg-muted/50 p-6 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Days</p>
                        <p className="font-medium">{selectedCampaign.callTiming.daysOfWeek.join(', ')}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Time</p>
                        <p className="font-medium">{selectedCampaign.callTiming.startTime} - {selectedCampaign.callTiming.endTime} ({selectedCampaign.callTiming.timeZone})</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Script */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Call Script
                  </h3>
                  {selectedCampaign.script.versions.map((version, idx) => (
                    <div key={idx} className="bg-muted/50 p-6 rounded-lg space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{version.name}</p>
                        {version.isActive && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-line">{version.content}</p>
                      {version.performance && (
                        <div className="grid grid-cols-3 gap-2 mt-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Success Rate</p>
                            <p className="text-sm font-medium">{Math.round(version.performance.successRate * 100)}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Avg. Duration</p>
                            <p className="text-sm font-medium">{version.performance.avgCallDuration} sec</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Conversion</p>
                            <p className="text-sm font-medium">{Math.round(version.performance.conversionRate * 100)}%</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* LLM Configuration */}
                <div className="space-y-2">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    AI Configuration
                  </h3>
                  <div className="bg-muted/50 p-4 rounded-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">LLM Model</p>
                        <p className="font-medium">{selectedCampaign.llmConfiguration.model}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Temperature</p>
                        <p className="font-medium">{selectedCampaign.llmConfiguration.temperature}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Max Tokens</p>
                        <p className="font-medium">{selectedCampaign.llmConfiguration.maxTokens}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Voice Provider</p>
                        <p className="font-medium">{selectedCampaign.voiceConfiguration.provider}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground">System Prompt</p>
                      <p className="text-sm mt-1 bg-background p-2 rounded-md whitespace-pre-line">{selectedCampaign.llmConfiguration.systemPrompt}</p>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="space-y-2">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Campaign Metrics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-muted/50 p-4 rounded-md">
                      <p className="text-sm text-muted-foreground">Total Calls</p>
                      <p className="text-xl font-medium">{selectedCampaign.metrics.totalCalls}</p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-md">
                      <p className="text-sm text-muted-foreground">Connected</p>
                      <p className="text-xl font-medium">{selectedCampaign.metrics.connectedCalls}</p>
                      <p className="text-xs text-muted-foreground">{Math.round((selectedCampaign.metrics.connectedCalls / selectedCampaign.metrics.totalCalls) * 100)}% connect rate</p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-md">
                      <p className="text-sm text-muted-foreground">Successful</p>
                      <p className="text-xl font-medium">{selectedCampaign.metrics.successfulCalls}</p>
                      <p className="text-xs text-muted-foreground">{Math.round((selectedCampaign.metrics.successfulCalls / selectedCampaign.metrics.connectedCalls) * 100)}% success rate</p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-md">
                      <p className="text-sm text-muted-foreground">Avg. Call Duration</p>
                      <p className="text-xl font-medium">{selectedCampaign.metrics.avgCallDuration} sec</p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-md">
                      <p className="text-sm text-muted-foreground">Conversion Rate</p>
                      <p className="text-xl font-medium">{Math.round(selectedCampaign.metrics.conversionRate * 100)}%</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => handleEditCampaign(selectedCampaign._id)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Campaign
                  </Button>
                  {selectedCampaign.status === 'Draft' && (
                    <Button
                      onClick={() => handleChangeCampaignStatus(selectedCampaign._id, 'Active')}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Activate Campaign
                    </Button>
                  )}
                  {selectedCampaign.status === 'Active' && (
                    <Button
                      onClick={() => handleChangeCampaignStatus(selectedCampaign._id, 'Paused')}
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pause Campaign
                    </Button>
                  )}
                  {selectedCampaign.status === 'Paused' && (
                    <Button
                      onClick={() => handleChangeCampaignStatus(selectedCampaign._id, 'Active')}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Resume Campaign
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Campaign Form Sheet */}
      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        {isFormOpen && (
          <CampaignForm 
            campaignId={editCampaignId}
            onClose={() => setIsFormOpen(false)}
            onSuccess={() => {
              setIsFormOpen(false);
              // Optionally, refetch campaigns data or update local state
            }}
          />
        )}
      </Sheet>
    </div>
  );
};

export default Campaigns;
