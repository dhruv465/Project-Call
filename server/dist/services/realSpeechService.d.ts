/**
 * realSpeechService.ts
 * Production implementation of speech synthesis using ElevenLabs
 */
import { Readable } from 'stream';
import { SpeechServiceInterface, SynthesizeOptions, Voice } from '../types/speech';
export declare class RealSpeechService implements SpeechServiceInterface {
    private apiKey;
    private apiUrl;
    private outputDir;
    private voices;
    private fallbackEnabled;
    private cachedAudio;
    private httpClient;
    constructor(apiKey: string, outputDir: string);
    /**
     * Loads available voices from ElevenLabs API
     */
    private loadVoices;
    /**
     * Infer gender from voice name and labels
     */
    private inferGender;
    /**
     * Infer accent from voice labels
     */
    private inferAccent;
    /**
     * Infer age from voice labels
     */
    private inferAge;
    /**
     * Synthesizes speech from text
     */
    synthesizeSpeech(text: string, options?: SynthesizeOptions): Promise<string>;
    /**
     * Generates a cache key for audio files
     */
    private generateCacheKey;
    /**
     * Gets a default voice ID based on gender preference
     */
    private getDefaultVoice;
    /**
     * Provides a fallback audio file when synthesis fails
     */
    private getFallbackAudio;
    /**
     * Creates a silent audio file for fallback
     */
    private createSilentAudio;
    /**
     * Gets all available voices
     */
    getVoices(): Promise<Voice[]>;
    /**
     * Gets a specific voice by ID
     */
    getVoice(voiceId: string): Promise<Voice | null>;
    /**
     * Streams audio data
     */
    createAudioStream(audioFilePath: string): Readable;
    /**
     * Enables or disables fallback mechanism
     */
    setFallbackEnabled(enabled: boolean): void;
}
export declare function initializeSpeechService(apiKey: string, outputDir: string): RealSpeechService;
export declare function getSpeechService(): RealSpeechService;
declare const _default: {
    initialize: typeof initializeSpeechService;
    getService: typeof getSpeechService;
};
export default _default;
