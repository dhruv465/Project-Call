declare module 'wavesurfer.js' {
  interface WaveSurferOptions {
    container: HTMLElement | string;
    waveColor?: string;
    progressColor?: string;
    cursorColor?: string;
    barWidth?: number;
    barGap?: number;
    barRadius?: number;
    responsive?: boolean;
    height?: number;
    backend?: string;
    normalize?: boolean;
    pixelRatio?: number;
    splitChannels?: boolean;
    mediaControls?: boolean;
    fillParent?: boolean;
    minPxPerSec?: number;
    scrollParent?: boolean;
  }
  
  export default class WaveSurfer {
    static create(options: WaveSurferOptions): WaveSurfer;
    
    // Methods
    load(url: string): void;
    play(start?: number, end?: number): void;
    pause(): void;
    stop(): void;
    destroy(): void;
    empty(): void;
    getDuration(): number;
    getCurrentTime(): number;
    seekTo(progress: number): void;
    setVolume(newVolume: number): void;
    setMuted(mute: boolean): void;
    setPlaybackRate(rate: number): void;
    skip(seconds: number): void;
    
    // Events
    on(event: 'ready' | 'load' | 'loading' | 'error' | 'finish' | 'audioprocess' | 'pause' | 'play' | 'seek', callback: (data?: any) => void): void;
    un(event: 'ready' | 'load' | 'loading' | 'error' | 'finish' | 'audioprocess' | 'pause' | 'play' | 'seek', callback: (data?: any) => void): void;
  }
}
