import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  generateScript,
  testScript,
  getCampaignAnalytics
} from '../controllers/campaignController';

const router = express.Router();

// All routes are protected
router.use(authenticate);

// Campaign management routes
router.post('/', createCampaign);
router.get('/', getCampaigns);
router.get('/analytics', getCampaignAnalytics);
router.get('/:id', getCampaignById);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

// Script generation and testing
router.post('/:id/generate-script', generateScript);
router.post('/:id/test-script', testScript);

export default router;
