import { useState } from 'react';
import { useQuery } from 'react-query';
import { 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Filter, 
  MoreHorizontal, 
  ChevronDown, 
  Trash2, 
  Edit, 
  Phone,
  AlertTriangle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Mock data for initial development
const mockLeads = Array.from({ length: 20 }, (_, i) => ({
  id: `lead-${i + 1}`,
  name: [
    'Rahul Sharma', 'Priya Patel', 'Amit Kumar', 'Sneha Reddy', 'Rajesh Gupta',
    'Meera Desai', 'Vikram Singh', 'Pooja Verma', 'Suresh Mehta', 'Neha Joshi'
  ][i % 10],
  phoneNumber: `+91 ${Math.floor(70000 + Math.random() * 30000)} ${Math.floor(10000 + Math.random() * 90000)}`,
  email: ['', '', 'example@email.com'][Math.floor(Math.random() * 3)],
  company: [
    'ABC Tech', 'XYZ Solutions', 'Global Innovations', 'Tech Dynamics', 'Future Systems',
    'Insight Technologies', 'Smart Solutions', 'Digital Innovators', 'Next Gen Tech', 'Elite Enterprises'
  ][i % 10],
  source: ['Website', 'Referral', 'Event', 'LinkedIn', 'Cold Outreach'][Math.floor(Math.random() * 5)],
  status: ['New', 'Contacted', 'Qualified', 'Not Interested', 'Converted', 'Scheduled Callback'][Math.floor(Math.random() * 6)],
  lastContacted: Math.random() > 0.3 ? new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000) : null,
  callCount: Math.floor(Math.random() * 5),
  languagePreference: ['English', 'Hindi', 'Tamil', 'Telugu', 'Marathi'][Math.floor(Math.random() * 5)],
  tags: Array.from({ length: Math.floor(Math.random() * 3) }, () => 
    ['High Value', 'Urgent', 'Tech', 'Finance', 'Healthcare', 'Education'][Math.floor(Math.random() * 6)]
  ),
}));

const Leads = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch leads data
  const { data: leadsData, isLoading, error, refetch } = useQuery(
    ['leads', statusFilter, sourceFilter, currentPage, itemsPerPage, searchTerm],
    async () => {
      try {
        // In a real app, we would fetch data from API
        // const response = await leadsApi.getLeads({ 
        //   status: statusFilter !== 'All' ? statusFilter : undefined,
        //   source: sourceFilter !== 'All' ? sourceFilter : undefined,
        //   page: currentPage,
        //   limit: itemsPerPage,
        //   search: searchTerm || undefined
        // });
        // return response;
        
        // For now, use mock data
        const filteredLeads = mockLeads.filter(lead => {
          const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;
          const matchesSource = sourceFilter === 'All' || lead.source === sourceFilter;
          const matchesSearch = searchTerm === '' || 
            lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.phoneNumber.includes(searchTerm) ||
            (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));
          
          return matchesStatus && matchesSource && matchesSearch;
        });
        
        const paginatedLeads = filteredLeads.slice(
          (currentPage - 1) * itemsPerPage,
          currentPage * itemsPerPage
        );
        
        return {
          leads: paginatedLeads,
          pagination: {
            page: currentPage,
            limit: itemsPerPage,
            total: filteredLeads.length,
            pages: Math.ceil(filteredLeads.length / itemsPerPage),
          },
        };
      } catch (error) {
        throw error;
      }
    },
    {
      keepPreviousData: true,
    }
  );

  const handleExportLeads = async (format: 'csv' | 'json' | 'xlsx') => {
    // Mock function that doesn't actually use state
    const simulateIsExporting = () => { /* No-op function */ };
    simulateIsExporting();

    try {
      // Here we would use the leadsApi.exportLeads method
      // For now, just simulate a successful export
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      toast({
        title: "Export Successful",
        description: `Leads exported successfully as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting leads.",
        variant: "destructive",
      });
    } finally {
      simulateIsExporting();
    }
  };

  const handleAddLeadClick = () => {
    toast({
      title: "Add New Lead",
      description: "Add lead form will be implemented here.",
    });
  };

  const handleDeleteLead = (leadId: string) => {
    toast({
      title: "Delete Lead",
      description: `Delete functionality for lead ${leadId} will be implemented here.`,
    });
  };

  const handleEditLead = (leadId: string) => {
    toast({
      title: "Edit Lead",
      description: `Edit functionality for lead ${leadId} will be implemented here.`,
    });
  };

  const handleCallLead = (leadId: string) => {
    toast({
      title: "Call Lead",
      description: `Call functionality for lead ${leadId} will be implemented here.`,
    });
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImportFile(file);
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;

    setIsImporting(true);

    try {
      // Here we would typically upload the file to the server
      // For now, just simulate a successful import
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: "Import Successful",
        description: "Leads imported successfully.",
      });

      // Refetch leads data
      refetch();
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "An error occurred while importing leads.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setIsImportDialogOpen(false);
      setImportFile(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading leads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Lead Management</h1>
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <p className="mt-4 text-lg">Failed to load leads. Please try again.</p>
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
        <h1 className="text-2xl font-bold">Lead Management</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportLeads('csv')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportLeads('xlsx')}>
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportLeads('json')}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleAddLeadClick}>
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads..."
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
              <DropdownMenuItem onClick={() => setStatusFilter('New')}>New</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('Contacted')}>Contacted</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('Qualified')}>Qualified</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('Not Interested')}>Not Interested</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('Converted')}>Converted</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('Scheduled Callback')}>Scheduled Callback</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-1">
                <Filter className="h-4 w-4" />
                Source: {sourceFilter}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSourceFilter('All')}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSourceFilter('Website')}>Website</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSourceFilter('Referral')}>Referral</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSourceFilter('Event')}>Event</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSourceFilter('LinkedIn')}>LinkedIn</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSourceFilter('Cold Outreach')}>Cold Outreach</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Leads Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left font-medium">Name</th>
                <th className="p-4 text-left font-medium">Phone</th>
                <th className="p-4 text-left font-medium">Source</th>
                <th className="p-4 text-left font-medium">Status</th>
                <th className="p-4 text-left font-medium">Last Contacted</th>
                <th className="p-4 text-left font-medium">Language</th>
                <th className="p-4 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leadsData?.leads.map((lead) => (
                <tr key={lead.id} className="border-b hover:bg-muted/50">
                  <td className="p-4">
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-sm text-muted-foreground">{lead.company}</p>
                    </div>
                  </td>
                  <td className="p-4">{lead.phoneNumber}</td>
                  <td className="p-4">{lead.source}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      lead.status === 'New' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' 
                        : lead.status === 'Contacted'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
                        : lead.status === 'Qualified'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100'
                        : lead.status === 'Not Interested'
                        ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                        : lead.status === 'Converted'
                        ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {lead.lastContacted 
                      ? new Date(lead.lastContacted).toLocaleDateString() 
                      : 'Never'}
                  </td>
                  <td className="p-4">{lead.languagePreference}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCallLead(lead.id)}
                        title="Call"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditLead(lead.id)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditLead(lead.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Lead
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCallLead(lead.id)}>
                            <Phone className="h-4 w-4 mr-2" />
                            Call Lead
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteLead(lead.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Lead
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {leadsData && leadsData.pagination && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {((leadsData.pagination.page - 1) * leadsData.pagination.limit) + 1} to {Math.min(leadsData.pagination.page * leadsData.pagination.limit, leadsData.pagination.total)} of {leadsData.pagination.total} leads
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
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, leadsData.pagination.pages))}
                disabled={currentPage === leadsData.pagination.pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Leads</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Upload a CSV or Excel file to import leads. Ensure the file has columns for name, phone number, email, etc.
            </p>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="file-upload">File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleImportFileChange}
              />
              {importFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportSubmit}
              disabled={isImporting || !importFile}
            >
              {isImporting ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
