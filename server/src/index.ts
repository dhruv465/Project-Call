import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import winston from 'winston';

// Routes
import userRoutes from './routes/userRoutes';
import leadRoutes from './routes/leadRoutes';
import campaignRoutes from './routes/campaignRoutes';
import callRoutes from './routes/callRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import configurationRoutes from './routes/configurationRoutes';
import notificationRoutes from './routes/notificationRoutes';
import voiceAIRoutes from './routes/voiceAIRoutes';

// Load environment variables
dotenv.config();

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-cold-calling-system' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
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
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/configuration', configurationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/voice-ai', voiceAIRoutes); // Advanced Voice AI routes

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-cold-calling');
    logger.info('MongoDB connected successfully');
  } catch (error) {
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
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

export { app, io, logger };
