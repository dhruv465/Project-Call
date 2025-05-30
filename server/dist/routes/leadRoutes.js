"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const leadController_1 = require("../controllers/leadController");
const fileUpload_1 = require("../middleware/fileUpload");
const router = express_1.default.Router();
// All routes are protected
router.use(auth_1.authenticate);
// Lead management routes
router.post('/', leadController_1.uploadLeads);
router.get('/', leadController_1.getLeads);
router.get('/analytics', leadController_1.getLeadAnalytics);
router.get('/export', leadController_1.exportLeads);
router.get('/:id', leadController_1.getLeadById);
router.put('/:id', leadController_1.updateLead);
router.delete('/:id', leadController_1.deleteLead);
// CSV import route
router.post('/import/csv', fileUpload_1.upload.single('file'), leadController_1.importLeadsFromCSV);
exports.default = router;
//# sourceMappingURL=leadRoutes.js.map