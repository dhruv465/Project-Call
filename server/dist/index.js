"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.io = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const winston_1 = __importDefault(require("winston"));
// Routes
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const leadRoutes_1 = __importDefault(require("./routes/leadRoutes"));
const campaignRoutes_1 = __importDefault(require("./routes/campaignRoutes"));
const callRoutes_1 = __importDefault(require("./routes/callRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const configurationRoutes_1 = __importDefault(require("./routes/configurationRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const voiceAIRoutes_1 = __importDefault(require("./routes/voiceAIRoutes"));
// Load environment variables
dotenv_1.default.config();
// Create logger
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    defaultMeta: { service: 'ai-cold-calling-system' },
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
        }),
        new winston_1.default.transports.File({ filename: 'error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'combined.log' }),
    ],
});
exports.logger = logger;
// Initialize express app
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});
exports.io = io;
// Middleware
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, morgan_1.default)('combined'));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
// Health check route
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
// API Routes
app.use('/api/users', userRoutes_1.default);
app.use('/api/leads', leadRoutes_1.default);
app.use('/api/campaigns', campaignRoutes_1.default);
app.use('/api/calls', callRoutes_1.default);
app.use('/api/dashboard', dashboardRoutes_1.default);
app.use('/api/configuration', configurationRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/voice-ai', voiceAIRoutes_1.default); // Advanced Voice AI routes
// Global error handler
app.use((err, _req, res, _next) => {
    logger.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'Something went wrong',
        error: process.env.NODE_ENV === 'development' ? err : {},
    });
});
// Socket.IO connection handler
io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);
    socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
    });
    // Handle real-time dashboard updates
    socket.on('join-dashboard', (userId) => {
        socket.join(`dashboard-${userId}`);
        logger.info(`User ${userId} joined dashboard room`);
    });
    // Handle real-time call monitoring
    socket.on('join-call-monitoring', (campaignId) => {
        socket.join(`campaign-${campaignId}`);
        logger.info(`Joined call monitoring for campaign ${campaignId}`);
    });
    // Handle user-specific notifications
    socket.on('join-user-room', (userId) => {
        socket.join(`user-${userId}`);
        logger.info(`User ${userId} joined notification room`);
    });
});
// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-cold-calling');
        logger.info('MongoDB connected successfully');
    }
    catch (error) {
        logger.error('MongoDB connection error:', error);
        process.exit(1);
    }
};
// Start server
const PORT = process.env.PORT || 8000;
connectDB().then(() => {
    server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
    });
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    // Close server & exit process
    server.close(() => process.exit(1));
});
//# sourceMappingURL=index.js.map