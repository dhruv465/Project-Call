"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const dashboardController_1 = require("../controllers/dashboardController");
const router = express_1.default.Router();
// All routes are protected
router.use(auth_1.authenticate);
// Dashboard routes
router.get('/overview', dashboardController_1.getDashboardOverview);
router.get('/call-metrics', dashboardController_1.getCallMetrics);
router.get('/lead-metrics', dashboardController_1.getLeadMetrics);
router.get('/agent-performance', dashboardController_1.getAgentPerformance);
router.get('/geographical-distribution', dashboardController_1.getGeographicalDistribution);
router.get('/time-series', dashboardController_1.getTimeSeriesData);
router.get('/export', dashboardController_1.exportDashboardData);
exports.default = router;
//# sourceMappingURL=dashboardRoutes.js.map