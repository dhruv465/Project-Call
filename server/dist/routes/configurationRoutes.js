"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const configurationController_1 = require("../controllers/configurationController");
const router = express_1.default.Router();
// All routes are protected
router.use(auth_1.authenticate);
// Configuration routes
router.get('/', configurationController_1.getSystemConfiguration);
router.put('/', configurationController_1.updateSystemConfiguration);
router.get('/llm-options', configurationController_1.getLLMOptions);
router.get('/voice-options', configurationController_1.getVoiceOptions);
// Connection tests
router.post('/test-llm', configurationController_1.testLLMConnection);
router.post('/test-twilio', configurationController_1.testTwilioConnection);
router.post('/test-elevenlabs', configurationController_1.testElevenLabsConnection);
exports.default = router;
//# sourceMappingURL=configurationRoutes.js.map