import { useState } from 'react';
import { useQuery } from 'react-query';
import api from '@/services/api';
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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import CampaignForm from '@/components/campaigns/CampaignForm';
import Skeleton from '@/components/ui/Skeleton';

// Types
interface Campaign {
  _id: string;
  name: string;
  description: string;
  status: 'Draft' | 'Active' | 'Paused' | 'Completed';
  goal: string;
  targetAudience: string;
  leadSources: string[];
  primaryLanguage: string;
  supportedLanguages: string[];
  startDate: string;
  endDate?: string;
  script: {
    name: string;
    content: string;
    versions: Array<{
      name: string;
      content: string;
      isActive: boolean;
    }>;
  };
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
  metrics?: {
    totalCalls: number;
    successfulCalls: number;
    avgCallDuration: number;
    conversionRate: number;
  };
}

interface CampaignsData {
  campaigns: Campaign[];
  pagination?: {
    page: number;
    pages: number;
    total: number;
    limit: number;
  };
}

const Campaigns = () => {
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | undefined>();
  
  // Event handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleCreateCampaign = () => {
    setEditingCampaignId(undefined);
    setShowCampaignForm(true);
  };

  const handleEditCampaign = (campaignId: string) => {
    setEditingCampaignId(campaignId);
    setShowCampaignForm(true);
  };

  const handleViewCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsSheetOpen(true);
  };

  const handleChangeCampaignStatus = (campaignId: string, newStatus: 'Draft' | 'Active' | 'Paused' | 'Completed') => {
    console.log(`Changing campaign ${campaignId} status to ${newStatus}`);
    // In a real app, this would update the campaign via API
  };

  const handleCampaignFormClose = () => {
    setShowCampaignForm(false);
    setEditingCampaignId(undefined);
  };

  const handleCampaignFormSuccess = () => {
    // Refresh campaigns data
    console.log('Campaign saved successfully');
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Active': return 'default';
      case 'Draft': return 'secondary';
      case 'Paused': return 'outline';
      case 'Completed': return 'destructive';
      default: return 'secondary';
    }
  };
  
  // Fetch campaigns from API
  const { data: campaignsData, isLoading, error, refetch } = useQuery<CampaignsData>(
    ['campaigns', currentPage, itemsPerPage, searchTerm, statusFilter],
    async () => {
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: itemsPerPage.toString(),
        });
        
        if (searchTerm) {
          params.append('search', searchTerm);
        }
        
        if (statusFilter !== 'All') {
          params.append('status', statusFilter);
        }
        
        const response = await api.get(`/campaigns?${params.toString()}`);
        return response.data || { campaigns: [], pagination: { page: 1, pages: 0, total: 0, limit: itemsPerPage } };
      } catch (err) {
        console.error('Error fetching campaigns:', err);
        // Return empty data structure instead of throwing error for new installations
        return { campaigns: [], pagination: { page: 1, pages: 0, total: 0, limit: itemsPerPage } };
      }
    },
    {
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
    }
  );

  // Get filtered campaigns based on data
  const filteredCampaigns = campaignsData?.campaigns || [];

  // Event handlers
  
  // Handle loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-2" />
              <div className="flex gap-2 mt-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="p-8">
        <Card className="p-6 border-destructive bg-destructive/10">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-medium">Error Loading Campaigns</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            If this is a new installation, you may not have any campaigns yet. Try creating your first campaign.
          </p>
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
            >
              Retry
            </Button>
            <Button onClick={handleCreateCampaign}>
              <Plus size={16} className="mr-2" />
              Create Campaign
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (filteredCampaigns.length === 0 && searchTerm === '' && statusFilter === 'All') {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Campaigns</h1>
        </div>
        
        <Card className="p-8 text-center">
          <AlertTriangle size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first campaign to start making AI-powered cold calls.
          </p>
          <Button onClick={handleCreateCampaign}>
            <Plus size={16} className="mr-2" />
            Create Campaign
          </Button>
        </Card>
        
        <Sheet open={showCampaignForm} onOpenChange={(open) => {
          if (!open) handleCampaignFormClose();
          setShowCampaignForm(open);
        }}>
          {showCampaignForm && (
            <CampaignForm
              campaignId={editingCampaignId}
              onClose={handleCampaignFormClose}
              onSuccess={handleCampaignFormSuccess}
            />
          )}
        </Sheet>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <Button onClick={handleCreateCampaign}>
          <Plus size={16} className="mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-grow">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-input rounded-xl bg-background"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-1">
              <Filter size={16} />
              Status: {statusFilter}
              <ChevronDown size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter('All')}>
              All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('Active')}>
              Active
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('Draft')}>
              Draft
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('Paused')}>
              Paused
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('Completed')}>
              Completed
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCampaigns.map((campaign: Campaign) => (
          <Card key={campaign._id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">{campaign.name}</h3>
                  <Badge variant={getStatusBadgeVariant(campaign.status)}>
                    {campaign.status}
                  </Badge>
                </div>
                
                <p className="text-muted-foreground mb-3">{campaign.description}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Goal:</span>
                    <p className="text-muted-foreground">{campaign.goal}</p>
                  </div>
                  <div>
                    <span className="font-medium">Target:</span>
                    <p className="text-muted-foreground">{campaign.targetAudience}</p>
                  </div>
                  <div>
                    <span className="font-medium">Language:</span>
                    <p className="text-muted-foreground">{campaign.primaryLanguage}</p>
                  </div>
                  <div>
                    <span className="font-medium">Start Date:</span>
                    <p className="text-muted-foreground">{new Date(campaign.startDate).toLocaleDateString()}</p>
                  </div>
                </div>
                
                {campaign.metrics && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t text-sm">
                    <div>
                      <span className="font-medium">Total Calls:</span>
                      <p className="text-muted-foreground">{campaign.metrics.totalCalls}</p>
                    </div>
                    <div>
                      <span className="font-medium">Successful:</span>
                      <p className="text-muted-foreground">{campaign.metrics.successfulCalls}</p>
                    </div>
                    <div>
                      <span className="font-medium">Avg Duration:</span>
                      <p className="text-muted-foreground">{campaign.metrics.avgCallDuration}m</p>
                    </div>
                    <div>
                      <span className="font-medium">Conversion:</span>
                      <p className="text-muted-foreground">{campaign.metrics.conversionRate}%</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                {campaign.status === 'Draft' && (
                  <Button 
                    size="sm" 
                    onClick={() => handleChangeCampaignStatus(campaign._id, 'Active')}
                  >
                    <Play size={16} className="mr-2" />
                    Start
                  </Button>
                )}
                
                {campaign.status === 'Active' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleChangeCampaignStatus(campaign._id, 'Paused')}
                  >
                    <Pause size={16} className="mr-2" />
                    Pause
                  </Button>
                )}
                
                {campaign.status === 'Paused' && (
                  <Button 
                    size="sm"
                    onClick={() => handleChangeCampaignStatus(campaign._id, 'Active')}
                  >
                    <Play size={16} className="mr-2" />
                    Resume
                  </Button>
                )}
                
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleViewCampaign(campaign)}
                >
                  <Info size={16} className="mr-2" />
                  Details
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditCampaign(campaign._id)}>
                      <Edit size={16} className="mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleViewCampaign(campaign)}>
                      <Info size={16} className="mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => console.log('Delete campaign', campaign._id)}
                      className="text-destructive"
                    >
                      <Trash2 size={16} className="mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {campaignsData?.pagination && campaignsData.pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev: number) => Math.max(prev - 1, 1))}
          >
            Previous
          </Button>
          
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {campaignsData?.pagination?.pages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === campaignsData?.pagination?.pages}
            onClick={() => setCurrentPage((prev: number) => Math.min(prev + 1, campaignsData?.pagination?.pages || 1))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Campaign Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Info size={20} />
              Campaign Details
            </SheetTitle>
          </SheetHeader>
          
          {selectedCampaign && (
            <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Zap size={18} />
                    Basic Information
                  </h3>
                  <div className="mt-3 space-y-2">
                    <div>
                      <span className="font-medium">Name:</span>
                      <p className="text-muted-foreground">{selectedCampaign.name}</p>
                    </div>
                    <div>
                      <span className="font-medium">Description:</span>
                      <p className="text-muted-foreground">{selectedCampaign.description}</p>
                    </div>
                    <div>
                      <span className="font-medium">Goal:</span>
                      <p className="text-muted-foreground">{selectedCampaign.goal}</p>
                    </div>
                    <div>
                      <span className="font-medium">Target Audience:</span>
                      <p className="text-muted-foreground">{selectedCampaign.targetAudience}</p>
                    </div>
                    <div>
                      <span className="font-medium">Lead Sources:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedCampaign.leadSources.map((source: string, idx: number) => (
                          <Badge key={idx} variant="outline">{source}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Languages:</span>
                      <p className="text-muted-foreground">
                        Primary: {selectedCampaign.primaryLanguage}
                      </p>
                      {selectedCampaign.supportedLanguages.length > 1 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedCampaign.supportedLanguages
                            .filter((lang: string) => lang !== selectedCampaign.primaryLanguage)
                            .map((lang: string, idx: number) => (
                              <Badge key={idx} variant="secondary">{lang}</Badge>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <MessageSquare size={18} />
                    Call Script
                  </h3>
                  <div className="mt-3">
                    <div>
                      <span className="font-medium">Script Name:</span>
                      <p className="text-muted-foreground">{selectedCampaign.script.name}</p>
                    </div>
                    <div className="mt-2">
                      <span className="font-medium">Content:</span>
                      <div className="mt-1 p-3 bg-muted rounded-xl text-sm">
                        {selectedCampaign.script.content}
                      </div>
                    </div>
                    {selectedCampaign.script.versions.length > 0 && (
                      <div className="mt-3">
                        <span className="font-medium">Versions:</span>
                        {selectedCampaign.script.versions.map((version: any, idx: number) => (
                          <div key={idx} className="mt-2 p-2 border rounded">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{version.name}</span>
                              {version.isActive && (
                                <Badge variant="default">Active</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Zap size={18} />
                    Call Timing
                  </h3>
                  <div className="mt-3 space-y-2">
                    <div>
                      <span className="font-medium">Days:</span>
                      <p className="text-muted-foreground">{selectedCampaign.callTiming.daysOfWeek.join(', ')}</p>
                    </div>
                    <div>
                      <span className="font-medium">Time:</span>
                      <p className="text-muted-foreground">
                        {selectedCampaign.callTiming.startTime} - {selectedCampaign.callTiming.endTime}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Timezone:</span>
                      <p className="text-muted-foreground">{selectedCampaign.callTiming.timeZone}</p>
                    </div>
                  </div>
                </div>

                {selectedCampaign.metrics && (
                  <div>
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <BarChart3 size={18} />
                      Performance Metrics
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium">Total Calls:</span>
                        <p className="text-2xl font-bold text-primary">{selectedCampaign.metrics.totalCalls}</p>
                      </div>
                      <div>
                        <span className="font-medium">Successful:</span>
                        <p className="text-2xl font-bold text-green-600">{selectedCampaign.metrics.successfulCalls}</p>
                      </div>
                      <div>
                        <span className="font-medium">Avg Duration:</span>
                        <p className="text-2xl font-bold text-blue-600">{selectedCampaign.metrics.avgCallDuration}m</p>
                      </div>
                      <div>
                        <span className="font-medium">Conversion Rate:</span>
                        <p className="text-2xl font-bold text-purple-600">{selectedCampaign.metrics.conversionRate}%</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={() => handleEditCampaign(selectedCampaign._id)}
                    className="flex-1"
                  >
                    <Edit size={16} className="mr-2" />
                    Edit Campaign
                  </Button>
                  
                  {selectedCampaign.status === 'Draft' && (
                    <Button 
                      onClick={() => handleChangeCampaignStatus(selectedCampaign._id, 'Active')}
                      className="flex-1"
                    >
                      <Play size={16} className="mr-2" />
                      Start Campaign
                    </Button>
                  )}
                  
                  {selectedCampaign.status === 'Active' && (
                    <Button 
                      variant="outline"
                      onClick={() => handleChangeCampaignStatus(selectedCampaign._id, 'Paused')}
                      className="flex-1"
                    >
                      <Pause size={16} className="mr-2" />
                      Pause Campaign
                    </Button>
                  )}
                  
                  {selectedCampaign.status === 'Paused' && (
                    <Button 
                      onClick={() => handleChangeCampaignStatus(selectedCampaign._id, 'Active')}
                      className="flex-1"
                    >
                      <Play size={16} className="mr-2" />
                      Resume Campaign
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {/* Campaign Form */}
      <Sheet open={showCampaignForm} onOpenChange={(open) => {
        if (!open) handleCampaignFormClose();
        setShowCampaignForm(open);
      }}>
        {showCampaignForm && (
          <CampaignForm
            campaignId={editingCampaignId}
            onClose={handleCampaignFormClose}
            onSuccess={handleCampaignFormSuccess}
          />
        )}
      </Sheet>
    </div>
  );
};

export default Campaigns;
