import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, Download, RotateCcw, ChevronDown, SkipBack, SkipForward } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import api from '@/services/api';

interface AudioPlayerProps {
  audioUrl: string;
  isPlaying: boolean;
  onPlayPause: (isPlaying: boolean) => void;
  callId: string;
  leadName?: string;
  campaignName?: string;
}

const AudioPlayer = ({ 
  audioUrl, 
  isPlaying, 
  onPlayPause, 
  callId,
  leadName,
  campaignName
}: AudioPlayerProps) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch authenticated audio and create blob URL
  const fetchAuthenticatedAudio = async (url: string): Promise<string> => {
    try {
      console.log('Fetching authenticated audio for URL:', url);
      
      // Check if it's a proxy URL that needs authentication
      if (url.includes('/api/calls/') && url.includes('/recording')) {
        // Extract call ID from URL like "/api/calls/CALL_ID/recording"
        const callIdMatch = url.match(/\/api\/calls\/([^\/]+)\/recording/);
        if (callIdMatch) {
          const extractedCallId = callIdMatch[1];
          console.log('Extracted call ID:', extractedCallId);
          
          // Use the authenticated API to fetch the audio
          const response = await api.get(`/calls/${extractedCallId}/recording`, {
            responseType: 'blob',
            headers: {
              'Accept': 'audio/mpeg, audio/wav, audio/*'
            }
          });
          
          // Create blob URL
          const blob = new Blob([response.data], { 
            type: response.headers['content-type'] || 'audio/mpeg' 
          });
          const blobUrl = URL.createObjectURL(blob);
          console.log('Created blob URL:', blobUrl);
          return blobUrl;
        }
      }
      
      // For direct URLs (non-proxy), return as-is
      console.log('Using direct URL:', url);
      return url;
    } catch (error) {
      console.error('Error fetching authenticated audio:', error);
      throw error;
    }
  };
  
  useEffect(() => {
    if (!waveformRef.current) return;
    
    // Clean up previous blob URL
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    
    const initializeWaveSurfer = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch authenticated audio and get blob URL
        const audioUrlToUse = await fetchAuthenticatedAudio(audioUrl);
        setBlobUrl(audioUrlToUse);
        
        // Clean up existing WaveSurfer instance
        if (wavesurferRef.current) {
          wavesurferRef.current.destroy();
          wavesurferRef.current = null;
        }
        
        // Create new WaveSurfer instance
        const wavesurfer = WaveSurfer.create({
          container: waveformRef.current!,
          waveColor: '#9ca3af', // gray-400
          progressColor: '#6366f1', // indigo-500
          cursorColor: '#6366f1', // visible cursor that follows playback
          barWidth: 2,
          barGap: 2,
          barRadius: 3,
          height: 60,
          responsive: true,
          normalize: true, // Normalize the waveform
          pixelRatio: window.devicePixelRatio || 1,
        });
        
        wavesurfer.on('ready', () => {
          console.log('WaveSurfer ready for:', audioUrl);
          setLoading(false);
          setDuration(wavesurfer.getDuration());
          // Set initial volume
          wavesurfer.setVolume(volume);
        });
        
        wavesurfer.on('audioprocess', () => {
          setCurrentTime(wavesurfer.getCurrentTime());
        });
        
        wavesurfer.on('finish', () => {
          onPlayPause(false);
        });
        
        wavesurfer.on('error', (err) => {
          console.error('Wavesurfer error for URL:', audioUrl, 'Error:', err);
          setLoading(false);
          setError('Failed to load audio recording');
        });
        
        wavesurfer.on('loading', (percent) => {
          console.log(`Loading audio: ${percent}%`);
        });
        
        // Use click event for seeking
        waveformRef.current!.addEventListener('click', () => {
          if (isPlaying && wavesurfer) {
            wavesurfer.play();
          }
        });
        
        wavesurferRef.current = wavesurfer;
        
        // Load the audio file
        wavesurfer.load(audioUrlToUse);
        
      } catch (error) {
        console.error('Error initializing WaveSurfer:', error);
        setLoading(false);
        setError('Failed to load audio recording');
      }
    };
    
    initializeWaveSurfer();
    
    // Clean up on unmount
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [audioUrl]);
  
  // Handle play/pause
  useEffect(() => {
    if (wavesurferRef.current) {
      if (isPlaying) {
        wavesurferRef.current.play();
      } else {
        wavesurferRef.current.pause();
      }
    }
  }, [isPlaying]);
  
  // Handle mute/unmute
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setMuted(muted);
    }
  }, [muted]);
  
  // Handle volume change
  useEffect(() => {
    if (wavesurferRef.current && !muted) {
      wavesurferRef.current.setVolume(volume);
    }
  }, [volume, muted]);
  
  // Handle playback rate change
  useEffect(() => {
    if (wavesurferRef.current) {
      // Try to use WaveSurfer's playbackRate if available, otherwise fallback to HTML5 Audio
      try {
        if (typeof wavesurferRef.current.setPlaybackRate === 'function') {
          wavesurferRef.current.setPlaybackRate(playbackRate);
        } else {
          // Fallback to manipulating HTML audio element directly
          const audioElement = document.querySelector(`#waveform-${callId} audio`);
          if (audioElement) {
            (audioElement as HTMLAudioElement).playbackRate = playbackRate;
          }
        }
      } catch (err) {
        console.error('Error setting playback rate:', err);
        // Fallback to manipulating HTML audio element directly
        const audioElement = document.querySelector(`#waveform-${callId} audio`);
        if (audioElement) {
          (audioElement as HTMLAudioElement).playbackRate = playbackRate;
        }
      }
    }
  }, [playbackRate, callId]);
  
  // Handle click outside volume slider
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showVolumeSlider) {
        const volumeSlider = document.getElementById(`volume-slider-${callId}`);
        const volumeButton = document.getElementById(`volume-button-${callId}`);
        
        if (
          volumeSlider && 
          volumeButton && 
          !volumeSlider.contains(event.target as Node) && 
          !volumeButton.contains(event.target as Node)
        ) {
          setShowVolumeSlider(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVolumeSlider, callId]);
  
  // Handle playback control
  const handlePlayPause = () => {
    onPlayPause(!isPlaying);
  };
  
  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (value[0] > 0 && muted) {
      setMuted(false);
    } else if (value[0] === 0 && !muted) {
      setMuted(true);
    }
  };
  
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
  };
  
  const handleRestart = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(0);
      if (!isPlaying) {
        onPlayPause(true);
      }
    }
  };
  
  const handleSkipBackward = () => {
    if (wavesurferRef.current) {
      try {
        if (typeof wavesurferRef.current.skip === 'function') {
          wavesurferRef.current.skip(-5);
        } else {
          const newTime = Math.max(0, currentTime - 5);
          wavesurferRef.current.seekTo(newTime / duration);
        }
      } catch (err) {
        console.error('Error skipping backward:', err);
        const newTime = Math.max(0, currentTime - 5);
        wavesurferRef.current.seekTo(newTime / duration);
      }
    }
  };
  
  const handleSkipForward = () => {
    if (wavesurferRef.current) {
      try {
        if (typeof wavesurferRef.current.skip === 'function') {
          wavesurferRef.current.skip(5);
        } else {
          const newTime = Math.min(duration, currentTime + 5);
          wavesurferRef.current.seekTo(newTime / duration);
        }
      } catch (err) {
        console.error('Error skipping forward:', err);
        const newTime = Math.min(duration, currentTime + 5);
        wavesurferRef.current.seekTo(newTime / duration);
      }
    }
  };
  
  const handleDownload = async () => {
    try {
      let downloadUrl = audioUrl;
      let filename = `${leadName || 'Call'}_${new Date().toISOString().split('T')[0]}.mp3`;
      
      // If it's a proxy URL, fetch the authenticated audio
      if (audioUrl.includes('/api/calls/') && audioUrl.includes('/recording')) {
        const callIdMatch = audioUrl.match(/\/api\/calls\/([^\/]+)\/recording/);
        if (callIdMatch) {
          const extractedCallId = callIdMatch[1];
          const response = await api.get(`/calls/${extractedCallId}/recording`, {
            responseType: 'blob',
            headers: {
              'Accept': 'audio/mpeg, audio/wav, audio/*'
            }
          });
          
          // Determine file extension from content type
          const contentType = response.headers['content-type'] || 'audio/mpeg';
          const extension = contentType.includes('wav') ? 'wav' : 'mp3';
          filename = `${leadName || 'Call'}_${new Date().toISOString().split('T')[0]}.${extension}`;
          
          downloadUrl = URL.createObjectURL(new Blob([response.data], { type: contentType }));
        }
      }
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL if we created one
      if (downloadUrl !== audioUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    } catch (error) {
      console.error('Error downloading audio:', error);
    }
  };
  
  const formatTime = (seconds: number): string => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="bg-muted/30 p-4 rounded-lg border mt-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full h-8 w-8 p-0" 
            onClick={handlePlayPause}
            disabled={loading}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          
          <div className="text-sm">
            <div className="font-medium">{leadName || 'Call Recording'}</div>
            <div className="text-muted-foreground text-xs">{campaignName || 'Campaign'}</div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="text-xs text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
          
          <div className="relative">
            <Button 
              id={`volume-button-${callId}`}
              variant="ghost" 
              size="sm" 
              className="rounded-full h-8 w-8 p-0" 
              onClick={() => {
                setShowVolumeSlider(!showVolumeSlider);
                if (volume === 0) {
                  setVolume(1);
                  setMuted(false);
                }
              }}
            >
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            
            {showVolumeSlider && (
              <div 
                id={`volume-slider-${callId}`}
                className="absolute right-0 top-full mt-2 bg-background border rounded-md p-2 shadow-md z-10 w-32"
              >
                <Slider
                  value={[muted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="w-full"
                />
              </div>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                {playbackRate}x <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handlePlaybackRateChange(0.5)}>0.5x</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePlaybackRateChange(0.75)}>0.75x</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePlaybackRateChange(1)}>1x (Normal)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePlaybackRateChange(1.25)}>1.25x</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePlaybackRateChange(1.5)}>1.5x</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePlaybackRateChange(2)}>2x</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full h-8 w-8 p-0" 
            onClick={handleDownload}
            title="Download recording"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex items-center justify-center space-x-2 mb-3">
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-full h-8 w-8 p-0" 
          onClick={handleRestart}
          disabled={loading}
          title="Restart"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-full h-8 w-8 p-0" 
          onClick={handleSkipBackward}
          disabled={loading || currentTime < 5}
          title="Skip back 5 seconds"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-full h-8 w-8 p-0" 
          onClick={handleSkipForward}
          disabled={loading || currentTime > duration - 5}
          title="Skip forward 5 seconds"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
      
      {loading ? (
        <div className="h-[60px] w-full flex flex-col justify-center items-center space-y-1">
          <Skeleton className="h-[30px] w-full rounded-md mb-2" />
          <div className="w-full flex space-x-1">
            {Array(16).fill(0).map((_, i) => (
              <Skeleton 
                key={i} 
                className="h-[20px] flex-1 rounded-md" 
                style={{
                  height: `${Math.max(5, Math.random() * 20)}px`,
                  opacity: 0.7 + Math.random() * 0.3
                }}
              />
            ))}
          </div>
          <div className="text-xs text-muted-foreground">Loading audio waveform...</div>
        </div>
      ) : error ? (
        <div className="h-[60px] w-full flex flex-col justify-center items-center space-y-2">
          <div className="text-sm text-destructive">{error}</div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setError(null);
              setLoading(true);
              // Force re-initialization by creating a new instance
              if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
              }
              // The useEffect dependency will trigger re-initialization
            }}
          >
            Retry
          </Button>
        </div>
      ) : (
        <div id={`waveform-${callId}`} ref={waveformRef} className="w-full" />
      )}
    </div>
  );
};

export default AudioPlayer;
