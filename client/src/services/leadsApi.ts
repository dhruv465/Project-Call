import api from './api';

// Types
interface LeadParams {
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
  search?: string;
  language?: string;
}

interface LeadData {
  name: string;
  phoneNumber: string;
  email?: string;
  company?: string;
  title?: string;
  source?: string;
  languagePreference?: string;
  status?: string;
  notes?: string;
  tags?: string[];
}

interface ExportLeadsParams {
  format?: 'csv' | 'json' | 'xlsx';
  status?: string;
  source?: string;
  language?: string;
}

// Leads API endpoints
export const leadsApi = {
  // Get leads with optional filters
  getLeads: async (params: LeadParams = {}) => {
    const response = await api.get('/leads', { params });
    return response.data;
  },

  // Get a specific lead by ID
  getLeadById: async (id: string) => {
    const response = await api.get(`/leads/${id}`);
    return response.data;
  },

  // Create a new lead
  createLead: async (leadData: LeadData) => {
    const response = await api.post('/leads', leadData);
    return response.data;
  },

  // Update an existing lead
  updateLead: async (id: string, leadData: Partial<LeadData>) => {
    const response = await api.put(`/leads/${id}`, leadData);
    return response.data;
  },

  // Delete a lead
  deleteLead: async (id: string) => {
    const response = await api.delete(`/leads/${id}`);
    return response.data;
  },

  // Bulk upload leads
  bulkUploadLeads: async (leads: LeadData[]) => {
    const response = await api.post('/leads', { leads });
    return response.data;
  },

  // Import leads from CSV
  importLeadsFromCSV: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/leads/import/csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  },

  // Export leads data
  exportLeads: async (params: ExportLeadsParams = {}) => {
    const response = await api.get('/leads/export', { 
      params,
      responseType: 'blob'
    });
    return response.data;
  }
};
