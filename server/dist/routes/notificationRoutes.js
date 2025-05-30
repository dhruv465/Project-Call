"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notificationController_1 = require("../controllers/notificationController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Apply authentication middleware to all routes
router.use(auth_1.authenticate);
// Get call notifications
router.get('/calls', notificationController_1.getCallNotifications);
// Mark notifications as read
router.put('/read', notificationController_1.markNotificationsAsRead);
exports.default = router;
//# sourceMappingURL=notificationRoutes.js.map