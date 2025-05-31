/**
 * Speech Service Interfaces and Types
 */
export interface Voice {
    id: string;
    name: string;
    description: string;
    gender: 'male' | 'female' | 'unknown';
    accent: string;
    age: string;
    preview_url?: string | null;
}
export interface SynthesizeOptions {
    voiceId?: string;
    gender?: 'male' | 'female';
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
    emotion?: string;
    intensity?: number;
    languageCode?: string;
}
export interface SpeechServiceInterface {
    /**
     * Synthesizes speech from text
     * @param text The text to synthesize
     * @param options Options for speech synthesis
     * @returns Path to the audio file
     */
    synthesizeSpeech(text: string, options?: SynthesizeOptions): Promise<string>;
    /**
     * Gets all available voices
     * @returns Array of available voices
     */
    getVoices(): Promise<Voice[]>;
    /**
     * Gets a specific voice by ID
     * @param voiceId The ID of the voice to get
     * @returns The voice, or null if not found
     */
    getVoice(voiceId: string): Promise<Voice | null>;
    /**
     * Creates a readable stream from an audio file path
     * @param audioFilePath Path to the audio file
     * @returns Readable stream of the audio data
     */
    createAudioStream(audioFilePath: string): NodeJS.ReadableStream;
    /**
     * Enables or disables fallback mechanism
     * @param enabled Whether fallback is enabled
     */
    setFallbackEnabled(enabled: boolean): void;
}
