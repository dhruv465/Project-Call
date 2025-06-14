import express from 'express';
import expressWs from 'express-ws';
import { authenticate } from '../middleware/auth';
import { handleVoiceStream, handleConversationalAIStream } from '../controllers/streamController';
import { handleOptimizedVoiceStream } from '../controllers/optimizedStreamController';
import { handleLowLatencyVoiceStream, triggerCachePreload } from '../controllers/lowLatencyStreamController';

const router = express.Router();

// Enable WebSocket support on this router
const wsRouter = expressWs(router as any).app;

// WebSocket streaming endpoint - not authenticated
wsRouter.ws('/voice/stream', handleVoiceStream);

// WebSocket streaming endpoint for ElevenLabs Conversational AI
wsRouter.ws('/voice/conversational-ai', handleConversationalAIStream);

// Optimized streaming endpoint with lower latency
wsRouter.ws('/voice/optimized-stream', handleOptimizedVoiceStream);

// Low-latency streaming endpoint with parallel processing and human-like responses
wsRouter.ws('/voice/low-latency', handleLowLatencyVoiceStream);

// HTTP route to trigger cache preloading - authenticated admin only
router.post('/voice/preload-cache', authenticate, triggerCachePreload);

export default router;
