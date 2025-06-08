/**
 * realSpeechService.ts
 * Production implementation of speech synthesis using ElevenLabs
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import { SpeechServiceInterface, SynthesizeOptions, Voice } from '../types/speech';
import logger, { getErrorMessage } from '../utils/logger';

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

export class RealSpeechService implements SpeechServiceInterface {
  private apiKey: string;
  private apiUrl: string = 'https://api.elevenlabs.io/v1';
  private outputDir: string;
  private voices: Map<string, Voice>;
  private fallbackEnabled: boolean = true;
  private cachedAudio: Map<string, string> = new Map();
  private httpClient: any;
  
  constructor(apiKey: string, outputDir: string) {
    this.apiKey = apiKey;
    this.outputDir = outputDir;
    this.voices = new Map();
    
    this.updateHttpClient();
    
    // Create output directory if it doesn't exist
    this.ensureOutputDirExists().catch(error => {
      logger.error(`Error creating output directory: ${getErrorMessage(error)}`);
    });
  }
  
  /**
   * Update the API key and refresh the HTTP client
   */
  public updateApiKey(newApiKey: string): void {
    if (newApiKey && newApiKey !== this.apiKey) {
      this.apiKey = newApiKey;
      this.updateHttpClient();
      logger.info('Speech service API key updated');
    }
  }
  
  /**
   * Initialize or update the HTTP client with current API key
   */
  private updateHttpClient(): void {
    // Create HTTP client with defaults
    this.httpClient = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds
    });
  }
  
  /**
   * Ensure the output directory exists
   */
  private async ensureOutputDirExists(): Promise<void> {
    try {
      // Create output directory if it doesn't exist
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }
    } catch (error) {
      logger.error(`Error creating output directory: ${getErrorMessage(error)}`);
      throw error;
    }
  }
  
  /**
   * Loads available voices from ElevenLabs API
   */
  private async loadVoices(): Promise<void> {
    try {
      const response = await this.httpClient.get('/voices');
      const voiceData = response.data.voices;
      
      voiceData.forEach((voice: any) => {
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
      
      logger.info(`Loaded ${this.voices.size} voices from ElevenLabs`);
    } catch (error) {
      logger.error('Error loading voices from ElevenLabs:', error);
      throw error;
    }
  }
  
  /**
   * Infer gender from voice name and labels
   */
  private inferGender(name: string, labels: any): 'male' | 'female' | 'unknown' {
    if (labels && labels.gender) {
      return labels.gender.toLowerCase();
    }
    
    // No hardcoded name lists - use ElevenLabs API labels only
    return 'unknown';
  }
  
  /**
   * Infer accent from voice labels
   */
  private inferAccent(labels: any): string {
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
  private inferAge(labels: any): string {
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
  public async synthesizeSpeech(
    text: string,
    options: SynthesizeOptions = {}
  ): Promise<string> {
    const cacheKey = this.generateCacheKey(text, options);
    
    // Check cache first
    if (this.cachedAudio.has(cacheKey)) {
      logger.info(`Using cached audio for: ${text.substring(0, 30)}...`);
      return this.cachedAudio.get(cacheKey)!;
    }
    
    // Use fallback for empty text
    if (!text || text.trim() === '') {
      logger.warn('Empty text provided for speech synthesis');
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
      
      logger.info(`Synthesizing speech for: ${text.substring(0, 30)}...`);
      
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
      
      logger.info(`Speech synthesized and saved to ${outputPath}`);
      
      // Add to cache
      this.cachedAudio.set(cacheKey, outputPath);
      
      // Limit cache size
      if (this.cachedAudio.size > 100) {
        const oldestKey = Array.from(this.cachedAudio.keys())[0];
        this.cachedAudio.delete(oldestKey);
      }
      
      return outputPath;
    } catch (error) {
      logger.error('Error synthesizing speech:', error);
      
      if (this.fallbackEnabled) {
        logger.warn('Using fallback audio due to synthesis error');
        return this.getFallbackAudio(text);
      }
      
      throw error;
    }
  }
  
  /**
   * Generates a cache key for audio files
   */
  private generateCacheKey(text: string, options: SynthesizeOptions): string {
    const voiceId = options.voiceId || 'default';
    const stability = options.stability || 0.75;
    const similarityBoost = options.similarityBoost || 0.75;
    
    return `${voiceId}_${stability}_${similarityBoost}_${text}`;
  }
  
  /**
   * Gets a default voice ID based on gender preference
   */
  private getDefaultVoice(gender?: 'male' | 'female'): string {
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
  private getFallbackAudio(textOrType: string): string {
    const fallbackDir = path.join(this.outputDir, 'fallback');
    
    // Create fallback directory if it doesn't exist
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    
    // Map of common phrases to static audio files
    const commonResponses: { [key: string]: string } = {
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
  private createSilentAudio(outputPath: string): void {
    // Very basic silent MP3 header (not a proper MP3 but works for testing)
    const silentMp3Header = Buffer.from([
      0xFF, 0xFB, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    
    try {
      fs.writeFileSync(outputPath, silentMp3Header);
      logger.info(`Created silent audio file at ${outputPath}`);
    } catch (error) {
      logger.error(`Failed to create silent audio file: ${getErrorMessage(error)}`);
    }
  }
  
  /**
   * Gets all available voices
   */
  public async getVoices(): Promise<Voice[]> {
    // Reload voices if none are loaded yet
    if (this.voices.size === 0) {
      await this.loadVoices();
    }
    
    return Array.from(this.voices.values());
  }
  
  /**
   * Gets a specific voice by ID
   */
  public async getVoice(voiceId: string): Promise<Voice | null> {
    // Reload voices if none are loaded yet
    if (this.voices.size === 0) {
      await this.loadVoices();
    }
    
    return this.voices.get(voiceId) || null;
  }
  
  /**
   * Streams audio data
   */
  public createAudioStream(audioFilePath: string): Readable {
    try {
      return fs.createReadStream(audioFilePath);
    } catch (error) {
      logger.error(`Error creating audio stream: ${getErrorMessage(error)}`);
      throw error;
    }
  }
  
  /**
   * Enables or disables fallback mechanism
   */
  public setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
  }
}

// Create singleton instance
let speechService: RealSpeechService | null = null;

export function initializeSpeechService(
  apiKey: string,
  outputDir: string
): RealSpeechService {
  if (!speechService) {
    speechService = new RealSpeechService(apiKey, outputDir);
  } else if (apiKey) {
    // Update API key if service already exists and key has changed
    speechService.updateApiKey(apiKey);
  }
  
  return speechService;
}

export function getSpeechService(): RealSpeechService {
  if (!speechService) {
    throw new Error('Speech service not initialized');
  }
  
  return speechService;
}

export default {
  initialize: initializeSpeechService,
  getService: getSpeechService
};