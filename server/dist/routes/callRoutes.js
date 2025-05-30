"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const callController_1 = require("../controllers/callController");
const updateCallStatusController_1 = require("../controllers/updateCallStatusController");
const router = express_1.default.Router();
// All routes are protected
router.use(auth_1.authenticate);
// Call management routes
router.post('/initiate', callController_1.initiateCall);
router.post('/test', callController_1.createTestCall);
router.get('/', callController_1.getCallHistory);
router.get('/analytics', callController_1.getCallAnalytics);
router.get('/export', callController_1.exportCalls);
router.get('/:id', callController_1.getCallById);
router.get('/:id/recording', callController_1.getCallRecording);
router.get('/:id/transcript', callController_1.getCallTranscript);
router.put('/:id/status', updateCallStatusController_1.updateCallStatus);
router.post('/:id/schedule-callback', callController_1.scheduleCallback);
exports.default = router;
//# sourceMappingURL=callRoutes.js.map