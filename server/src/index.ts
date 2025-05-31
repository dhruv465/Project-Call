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
import path from 'path';

// Routes
import userRoutes from './routes/userRoutes';
import leadRoutes from './routes/leadRoutes';
import campaignRoutes from './routes/campaignRoutes';
import callRoutes from './routes/callRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import configurationRoutes from './routes/configurationRoutes';
import voiceAIRoutes from './routes/voiceAIRoutes';
import telephonyRoutes from './routes/telephonyRoutes';

// Services initialization
import { initializeSpeechService } from './services/realSpeechService';
import { ConversationEngineService } from './services/conversationEngineService';
import CampaignService from './services/campaignService';
import leadService from './services/leadService';
import { ModelRegistry } from './ml/pipeline/model_registry';

// Load environment variables
dotenv.config();

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'lumina-outreach' },
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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "data:"],
      fontSrc: ["'self'", "https:", "data:", "blob:"],
      imgSrc: ["'self'", "https:", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
      mediaSrc: ["'self'", "blob:", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));
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
app.use('/api/voice-ai', voiceAIRoutes);
app.use('/api/telephony', telephonyRoutes);

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
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lumina-outreach');
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Initialize services with configuration from database
const initializeServices = async () => {
  try {
    // Get configuration from database
    const Configuration = require('./models/Configuration').default;
    const config = await Configuration.findOne();
    
    let elevenLabsApiKey = '';
    let openAIApiKey = '';
    let anthropicApiKey = '';
    let googleSpeechApiKey = '';
    
    // If configuration exists, use it; otherwise fall back to env vars as temporary measure
    if (config) {
      logger.info('Using API configuration from database');
      
      // ElevenLabs
      elevenLabsApiKey = config.elevenLabsConfig?.apiKey || process.env.ELEVENLABS_API_KEY || '';
      
      // LLM providers
      const openAIProvider = config.llmConfig?.providers?.find((p: any) => p.name === 'openai');
      openAIApiKey = openAIProvider?.apiKey || process.env.OPENAI_API_KEY || '';
      
      const anthropicProvider = config.llmConfig?.providers?.find((p: any) => p.name === 'anthropic');
      anthropicApiKey = anthropicProvider?.apiKey || process.env.ANTHROPIC_API_KEY || '';
      
      // Google (if configured)
      const googleProvider = config.llmConfig?.providers?.find((p: any) => p.name === 'google');
      googleSpeechApiKey = googleProvider?.apiKey || process.env.GOOGLE_SPEECH_API_KEY || '';
    } else {
      logger.warn('No configuration found in database, using environment variables as fallback');
      elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || '';
      openAIApiKey = process.env.OPENAI_API_KEY || '';
      anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
      googleSpeechApiKey = process.env.GOOGLE_SPEECH_API_KEY || '';
    }

    // Speech synthesis service
    const speechService = initializeSpeechService(
      elevenLabsApiKey,
      path.join(__dirname, '../uploads/audio')
    );

    // Model registry
    const modelRegistry = new ModelRegistry();

    // Conversation engine
    const conversationEngine = new ConversationEngineService(
      elevenLabsApiKey,
      openAIApiKey,
      anthropicApiKey,
      googleSpeechApiKey
    );

    // Campaign service
    const campaignService = new CampaignService(
      elevenLabsApiKey,
      openAIApiKey,
      anthropicApiKey,
      googleSpeechApiKey
    );
    
    // Export services
    global.speechService = speechService;
    global.modelRegistry = modelRegistry;
    global.conversationEngine = conversationEngine;
    global.campaignService = campaignService;
    
    return {
      speechService,
      modelRegistry,
      conversationEngine,
      campaignService
    };
  } catch (error) {
    logger.error('Error initializing services:', error);
    throw error;
  }
};

// Start server
const PORT = process.env.PORT || 8000;
connectDB().then(async () => {
  try {
    // Initialize services before starting the server
    await initializeServices();
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Create helper for error handling
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return 'Unknown error occurred';
}

// Define global namespace for TypeScript
declare global {
  var speechService: any;
  var modelRegistry: any;
  var conversationEngine: any;
  var campaignService: any;
}

export {
  getErrorMessage,
  campaignService,
  leadService,
  app,
  io,
  logger
};
