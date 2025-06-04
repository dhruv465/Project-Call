import express from 'express';
import expressWs from 'express-ws';
import { authenticate } from '../middleware/auth';
import { handleVoiceStream } from '../controllers/streamController';

const router = express.Router();

// Enable WebSocket support on this router
const wsRouter = expressWs(router as any).app;

// WebSocket streaming endpoint - not authenticated
wsRouter.ws('/voice/stream', handleVoiceStream);

export default router;
