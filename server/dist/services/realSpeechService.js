"use strict";
/**
 * realSpeechService.ts
 * Production implementation of speech synthesis using ElevenLabs
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealSpeechService = void 0;
exports.initializeSpeechService = initializeSpeechService;
exports.getSpeechService = getSpeechService;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const logger_1 = __importStar(require("../utils/logger"));
const writeFileAsync = (0, util_1.promisify)(fs.writeFile);
const mkdirAsync = (0, util_1.promisify)(fs.mkdir);
class RealSpeechService {
    constructor(apiKey, outputDir) {
        this.apiUrl = 'https://api.elevenlabs.io/v1';
        this.fallbackEnabled = true;
        this.cachedAudio = new Map();
        this.apiKey = apiKey;
        this.outputDir = outputDir;
        this.voices = new Map();
        // Create HTTP client with defaults
        this.httpClient = axios_1.default.create({
            baseURL: this.apiUrl,
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 seconds
        });
        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        // Load available voices on initialization
        this.loadVoices().catch(err => {
            logger_1.default.error('Failed to load ElevenLabs voices:', err);
        });
    }
    /**
     * Loads available voices from ElevenLabs API
     */
    async loadVoices() {
        try {
            const response = await this.httpClient.get('/voices');
            const voiceData = response.data.voices;
            voiceData.forEach((voice) => {
                this.voices.set(voice.voice_id, {
                    id: voice.voice_id,
                    name: voice.name,
                    description: voice.description || '',
                    preview_url: voice.preview_url || null,
                    gender: this.inferGender(voice.name, voice.labels),
                    accent: this.inferAccent(voice.labels),
                    age: this.inferAge(voice.labels)
                });
            });
            logger_1.default.info(`Loaded ${this.voices.size} voices from ElevenLabs`);
        }
        catch (error) {
            logger_1.default.error('Error loading voices from ElevenLabs:', error);
            throw error;
        }
    }
    /**
     * Infer gender from voice name and labels
     */
    inferGender(name, labels) {
        if (labels && labels.gender) {
            return labels.gender.toLowerCase();
        }
        // Simple heuristic based on voice name
        const maleNames = ['adam', 'arnold', 'bill', 'brian', 'charlie', 'chris', 'daniel', 'dave', 'david', 'george', 'harry', 'james', 'john', 'joseph', 'matthew', 'michael', 'mike', 'paul', 'peter', 'robert', 'sam', 'thomas', 'william'];
        const femaleNames = ['alice', 'amy', 'anna', 'ashley', 'bella', 'charlotte', 'elizabeth', 'emily', 'emma', 'hannah', 'jennifer', 'jessica', 'joanna', 'julia', 'kate', 'katherine', 'lisa', 'mary', 'melissa', 'nicole', 'olivia', 'rachel', 'sarah', 'sophia'];
        const lowerName = name.toLowerCase();
        for (const maleName of maleNames) {
            if (lowerName.includes(maleName)) {
                return 'male';
            }
        }
        for (const femaleName of femaleNames) {
            if (lowerName.includes(femaleName)) {
                return 'female';
            }
        }
        return 'unknown';
    }
    /**
     * Infer accent from voice labels
     */
    inferAccent(labels) {
        if (labels && labels.accent) {
            return labels.accent;
        }
        if (labels && labels.description) {
            const accents = ['american', 'british', 'australian', 'indian', 'irish', 'scottish', 'french', 'german', 'spanish', 'italian'];
            const description = labels.description.toLowerCase();
            for (const accent of accents) {
                if (description.includes(accent)) {
                    return accent;
                }
            }
        }
        return 'neutral';
    }
    /**
     * Infer age from voice labels
     */
    inferAge(labels) {
        if (labels && labels.age) {
            return labels.age;
        }
        if (labels && labels.description) {
            const ages = ['young', 'middle-aged', 'elderly', 'old', 'teen', 'child'];
            const description = labels.description.toLowerCase();
            for (const age of ages) {
                if (description.includes(age)) {
                    return age;
                }
            }
        }
        return 'adult';
    }
    /**
     * Synthesizes speech from text
     */
    async synthesizeSpeech(text, options = {}) {
        const cacheKey = this.generateCacheKey(text, options);
        // Check cache first
        if (this.cachedAudio.has(cacheKey)) {
            logger_1.default.info(`Using cached audio for: ${text.substring(0, 30)}...`);
            return this.cachedAudio.get(cacheKey);
        }
        // Use fallback for empty text
        if (!text || text.trim() === '') {
            logger_1.default.warn('Empty text provided for speech synthesis');
            return this.getFallbackAudio('empty');
        }
        try {
            const voiceId = options.voiceId || this.getDefaultVoice(options.gender);
            if (!voiceId) {
                throw new Error('No voice ID provided and no default voice available');
            }
            const payload = {
                text,
                voice_settings: {
                    stability: options.stability || 0.75,
                    similarity_boost: options.similarityBoost || 0.75,
                    style: options.style || 0.0,
                    use_speaker_boost: options.useSpeakerBoost !== false
                }
            };
            logger_1.default.info(`Synthesizing speech for: ${text.substring(0, 30)}...`);
            const response = await this.httpClient({
                method: 'post',
                url: `/text-to-speech/${voiceId}`,
                data: payload,
                responseType: 'arraybuffer'
            });
            // Generate unique filename
            const timestamp = Date.now();
            const filename = `speech_${timestamp}_${Math.floor(Math.random() * 1000)}.mp3`;
            const outputPath = path.join(this.outputDir, filename);
            // Save audio file
            await writeFileAsync(outputPath, response.data);
            logger_1.default.info(`Speech synthesized and saved to ${outputPath}`);
            // Add to cache
            this.cachedAudio.set(cacheKey, outputPath);
            // Limit cache size
            if (this.cachedAudio.size > 100) {
                const oldestKey = Array.from(this.cachedAudio.keys())[0];
                this.cachedAudio.delete(oldestKey);
            }
            return outputPath;
        }
        catch (error) {
            logger_1.default.error('Error synthesizing speech:', error);
            if (this.fallbackEnabled) {
                logger_1.default.warn('Using fallback audio due to synthesis error');
                return this.getFallbackAudio(text);
            }
            throw error;
        }
    }
    /**
     * Generates a cache key for audio files
     */
    generateCacheKey(text, options) {
        const voiceId = options.voiceId || 'default';
        const stability = options.stability || 0.75;
        const similarityBoost = options.similarityBoost || 0.75;
        return `${voiceId}_${stability}_${similarityBoost}_${text}`;
    }
    /**
     * Gets a default voice ID based on gender preference
     */
    getDefaultVoice(gender) {
        // Return first available voice matching gender, or first voice if no gender specified
        if (gender) {
            for (const [id, voice] of this.voices.entries()) {
                if (voice.gender === gender) {
                    return id;
                }
            }
        }
        // Fallback to first available voice
        const firstVoice = Array.from(this.voices.keys())[0];
        return firstVoice;
    }
    /**
     * Provides a fallback audio file when synthesis fails
     */
    getFallbackAudio(textOrType) {
        const fallbackDir = path.join(this.outputDir, 'fallback');
        // Create fallback directory if it doesn't exist
        if (!fs.existsSync(fallbackDir)) {
            fs.mkdirSync(fallbackDir, { recursive: true });
        }
        // Map of common phrases to static audio files
        const commonResponses = {
            'hello': 'greeting.mp3',
            'goodbye': 'farewell.mp3',
            'thank you': 'thanks.mp3',
            'please wait': 'wait.mp3',
            'I understand': 'acknowledge.mp3',
            'empty': 'silence.mp3'
        };
        // Check if we have a pre-recorded response
        for (const [phrase, filename] of Object.entries(commonResponses)) {
            if (textOrType.toLowerCase().includes(phrase)) {
                const fallbackPath = path.join(fallbackDir, filename);
                // If file doesn't exist, create a silent audio file
                if (!fs.existsSync(fallbackPath)) {
                    this.createSilentAudio(fallbackPath);
                }
                return fallbackPath;
            }
        }
        // Default fallback
        const defaultFallback = path.join(fallbackDir, 'default_response.mp3');
        // Create silent audio file if it doesn't exist
        if (!fs.existsSync(defaultFallback)) {
            this.createSilentAudio(defaultFallback);
        }
        return defaultFallback;
    }
    /**
     * Creates a silent audio file for fallback
     */
    createSilentAudio(outputPath) {
        // Very basic silent MP3 header (not a proper MP3 but works for testing)
        const silentMp3Header = Buffer.from([
            0xFF, 0xFB, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
        try {
            fs.writeFileSync(outputPath, silentMp3Header);
            logger_1.default.info(`Created silent audio file at ${outputPath}`);
        }
        catch (error) {
            logger_1.default.error(`Failed to create silent audio file: ${(0, logger_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Gets all available voices
     */
    async getVoices() {
        // Reload voices if none are loaded yet
        if (this.voices.size === 0) {
            await this.loadVoices();
        }
        return Array.from(this.voices.values());
    }
    /**
     * Gets a specific voice by ID
     */
    async getVoice(voiceId) {
        // Reload voices if none are loaded yet
        if (this.voices.size === 0) {
            await this.loadVoices();
        }
        return this.voices.get(voiceId) || null;
    }
    /**
     * Streams audio data
     */
    createAudioStream(audioFilePath) {
        try {
            return fs.createReadStream(audioFilePath);
        }
        catch (error) {
            logger_1.default.error(`Error creating audio stream: ${(0, logger_1.getErrorMessage)(error)}`);
            throw error;
        }
    }
    /**
     * Enables or disables fallback mechanism
     */
    setFallbackEnabled(enabled) {
        this.fallbackEnabled = enabled;
    }
}
exports.RealSpeechService = RealSpeechService;
// Create singleton instance
let speechService = null;
function initializeSpeechService(apiKey, outputDir) {
    if (!speechService) {
        speechService = new RealSpeechService(apiKey, outputDir);
    }
    return speechService;
}
function getSpeechService() {
    if (!speechService) {
        throw new Error('Speech service not initialized');
    }
    return speechService;
}
exports.default = {
    initialize: initializeSpeechService,
    getService: getSpeechService
};
//# sourceMappingURL=realSpeechService.js.map