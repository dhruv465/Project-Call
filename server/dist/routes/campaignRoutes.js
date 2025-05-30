"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const campaignController_1 = require("../controllers/campaignController");
const router = express_1.default.Router();
// All routes are protected
router.use(auth_1.authenticate);
// Campaign management routes
router.post('/', campaignController_1.createCampaign);
router.get('/', campaignController_1.getCampaigns);
router.get('/analytics', campaignController_1.getCampaignAnalytics);
router.get('/:id', campaignController_1.getCampaignById);
router.put('/:id', campaignController_1.updateCampaign);
router.delete('/:id', campaignController_1.deleteCampaign);
// Script generation and testing
router.post('/:id/generate-script', campaignController_1.generateScript);
router.post('/:id/test-script', campaignController_1.testScript);
exports.default = router;
//# sourceMappingURL=campaignRoutes.js.map