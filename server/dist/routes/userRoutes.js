"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const userController_1 = require("../controllers/userController");
const router = express_1.default.Router();
// Public routes
router.post('/register', userController_1.createUser);
router.post('/login', userController_1.loginUser);
// Protected routes
router.get('/profile', auth_1.authenticate, userController_1.getUserProfile);
router.put('/profile', auth_1.authenticate, userController_1.updateUserProfile);
router.get('/', auth_1.authenticate, userController_1.getAllUsers);
exports.default = router;
//# sourceMappingURL=userRoutes.js.map