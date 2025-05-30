"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../index");
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }
        const token = authHeader.split(' ')[1];
        // Development bypass for testing
        if ((token === 'dev-token' || token === 'mock-jwt-token') && process.env.NODE_ENV !== 'production') {
            req.user = { id: 'dev-user-123', email: 'dev@test.com' };
            return next();
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'default_secret');
        // Add user from payload
        req.user = decoded;
        next();
    }
    catch (error) {
        index_1.logger.error('Authentication error:', error);
        return res.status(401).json({ message: 'Token is not valid' });
    }
};
exports.authenticate = authenticate;
//# sourceMappingURL=auth.js.map