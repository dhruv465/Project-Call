import { Request, Response } from 'express';
import fs from 'fs';
import csv from 'csv-parser';
import Lead from '../models/Lead';
import { logger } from '../index';
import { handleError } from '../utils/errorHandling';

// @desc    Upload multiple leads
// @route   POST /api/leads
// @access  Private
export const uploadLeads = async (req: Request & { user?: any }, res: Response) => {
  try {
    const leads = req.body.leads;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ message: 'No leads provided' });
    }

    // Validate each lead
    const validatedLeads = leads.map(lead => ({
      ...lead,
      // Add validation here if needed
    }));

    // Create multiple leads
    const createdLeads = await Lead.create(validatedLeads);

    return res.status(201).json({
      message: `Successfully created ${createdLeads.length} leads`,
      leads: createdLeads,
    });
  } catch (error) {
    logger.error('Error uploading leads:', error);
    return res.status(500).json({ message: 'Server error', error: handleError(error) });
  }
};

// @desc    Get all leads with pagination and filtering
// @route   GET /api/leads
// @access  Private
export const getLeads = async (req: Request & { user?: any }, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: Record<string, any> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.source) filter.source = req.query.source;
    if (req.query.language) filter.languagePreference = req.query.language;

    // Search by name or phone
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      filter.$or = [
        { name: searchRegex },
        { phoneNumber: searchRegex },
        { email: searchRegex },
      ];
    }

    // Get leads with pagination
    const leads = await Lead.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await Lead.countDocuments(filter);

    return res.status(200).json({
      leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error getting leads:', error);
    return res.status(500).json({ message: 'Server error', error: handleError(error) });
  }
};

// @desc    Get lead by ID
// @route   GET /api/leads/:id
// @access  Private
export const getLeadById = async (req: Request & { user?: any }, res: Response) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    return res.status(200).json(lead);
  } catch (error) {
    logger.error('Error getting lead by ID:', error);
    return res.status(500).json({ message: 'Server error', error: handleError(error) });
  }
};

// @desc    Update lead
// @route   PUT /api/leads/:id
// @access  Private
export const updateLead = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { name, phoneNumber, email, company, title, source, languagePreference, status, notes, tags } = req.body;

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Update fields
    if (name) lead.name = name;
    if (phoneNumber) lead.phoneNumber = phoneNumber;
    if (email !== undefined) lead.email = email;
    if (company !== undefined) lead.company = company;
    if (title !== undefined) lead.title = title;
    if (source) lead.source = source;
    if (languagePreference) lead.languagePreference = languagePreference;
    if (status) lead.status = status;
    if (notes !== undefined) lead.notes = notes;
    if (tags) lead.tags = tags;

    const updatedLead = await lead.save();

    return res.status(200).json(updatedLead);
  } catch (error) {
    logger.error('Error updating lead:', error);
    return res.status(500).json({ message: 'Server error', error: handleError(error) });
  }
};

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Private
export const deleteLead = async (req: Request & { user?: any }, res: Response) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    await lead.deleteOne();

    return res.status(200).json({ message: 'Lead deleted successfully' });
  } catch (error) {
    logger.error('Error deleting lead:', error);
    return res.status(500).json({ message: 'Server error', error: handleError(error) });
  }
};

// @desc    Import leads from CSV
// @route   POST /api/leads/import/csv
// @access  Private
export const importLeadsFromCSV = async (req: Request & { user?: any, file?: Express.Multer.File }, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const results: any[] = [];
    const errors: any[] = [];

    // Parse CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        // Validate required fields
        if (!data.name || !data.phoneNumber || !data.source) {
          errors.push({ row: data, error: 'Missing required fields' });
          return;
        }

        // Add to results
        results.push({
          name: data.name,
          phoneNumber: data.phoneNumber,
          email: data.email || undefined,
          company: data.company || undefined,
          title: data.title || undefined,
          source: data.source,
          languagePreference: data.languagePreference || 'English',
          status: 'New',
          tags: data.tags ? data.tags.split(',').map((tag: string) => tag.trim()) : [],
        });
      })
      .on('end', async () => {
        // Delete file after processing
        fs.unlinkSync(req.file!.path);

        if (results.length === 0) {
          res.status(400).json({ message: 'No valid leads found in CSV', errors });
          return;
        }

        // Create leads in database
        const createdLeads = await Lead.create(results);

        res.status(201).json({
          message: `Successfully imported ${createdLeads.length} leads`,
          errors: errors.length > 0 ? errors : undefined,
        });
      })
      .on('error', (error) => {
        // Delete file if there's an error
        if (req.file?.path) fs.unlinkSync(req.file.path);
        throw error;
      });
  } catch (error) {
    logger.error('Error importing leads from CSV:', error);
    // Delete file if there's an error
    if (req.file?.path) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Server error', error: handleError(error) });
  }
};

// @desc    Get lead analytics
// @route   GET /api/leads/analytics
// @access  Private
export const getLeadAnalytics = async (_req: Request & { user?: any }, res: Response) => {
  try {
    // Get total count of leads
    const totalLeads = await Lead.countDocuments();

    // Get leads by status
    const leadsByStatus = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);

    // Get leads by source
    const leadsBySource = await Lead.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $project: { source: '$_id', count: 1, _id: 0 } }
    ]);

    // Get leads by language
    const leadsByLanguage = await Lead.aggregate([
      { $group: { _id: '$languagePreference', count: { $sum: 1 } } },
      { $project: { language: '$_id', count: 1, _id: 0 } }
    ]);

    // Get leads created over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const leadsOverTime = await Lead.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          date: '$_id',
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

    return res.status(200).json({
      totalLeads,
      leadsByStatus,
      leadsBySource,
      leadsByLanguage,
      leadsOverTime,
    });
  } catch (error) {
    logger.error('Error getting lead analytics:', error);
    return res.status(500).json({ message: 'Server error', error: handleError(error) });
  }
};

// @desc    Export leads data to CSV, JSON, or Excel
// @route   GET /api/leads/export
// @access  Private
export const exportLeads = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { 
      format = 'csv',
      status,
      source,
      language
    } = req.query as {
      format?: string;
      status?: string;
      source?: string;
      language?: string;
    };

    // Build query
    const query: Record<string, any> = {};

    if (status) query.status = status;
    if (source) query.source = source;
    if (language) query.languagePreference = language;

    // Get leads
    const leads = await Lead.find(query).sort({ createdAt: -1 });

    // Process leads for export
    const exportData = leads.map((lead: any) => ({
      id: lead._id,
      name: lead.name,
      phoneNumber: lead.phoneNumber,
      email: lead.email || '',
      company: lead.company || '',
      title: lead.title || '',
      source: lead.source || '',
      status: lead.status,
      languagePreference: lead.languagePreference || '',
      callCount: lead.callCount,
      lastContacted: lead.lastContacted ? lead.lastContacted.toISOString() : '',
      notes: lead.notes || '',
      tags: lead.tags ? lead.tags.join(', ') : '',
    }));

    // Export based on requested format
    if (format === 'json') {
      // Send JSON
      return res.status(200).json({ leads: exportData });
    } 
    else if (format === 'csv') {
      // Convert to CSV using a simple method without external dependencies
      const header = Object.keys(exportData[0] || {}).join(',') + '\n';
      const csv = exportData.length 
        ? header + exportData.map((row: any) => 
            Object.values(row).map(value => 
              `"${String(value).replace(/"/g, '""')}"`
            ).join(',')
          ).join('\n')
        : header;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=leads-export.csv');
      return res.status(200).send(csv);
    }
    else if (format === 'xlsx') {
      // For XLSX, we'll return JSON with a message to implement client-side Excel export
      return res.status(200).json({ 
        leads: exportData,
        message: 'XLSX export is handled on the client side'
      });
    }
    else {
      return res.status(400).json({ message: 'Unsupported export format' });
    }
  } catch (error) {
    logger.error('Error in exportLeads:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};
