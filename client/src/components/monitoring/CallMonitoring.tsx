import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import AudioWaveform from '../ui/AudioWaveform';

// Interface for the component props
interface CallMonitoringProps {
  callId?: string;
  autoConnect?: boolean;
  height?: string | number;
  width?: string | number;
  className?: string;
}

// Types for monitoring data
interface CallState {
  callId: string;
  state: 'connecting' | 'speaking' | 'listening' | 'processing' | 'ended' | 'error';
  timestamp: number;
}

interface WaveformData {
  callId: string;
  waveformData: number[];
  timestamp: number;
}

interface EmotionData {
  callId: string;
  emotion: {
    primary: string;
    secondary?: string;
    confidence: number;
    valence: number;
    arousal: number;
  };
  timestamp: number;
}

interface LatencyData {
  callId: string;
  latency: {
    stt: number;
    llm: number;
    tts: number;
    total: number;
  };
  timestamp: number;
}

interface InterruptionData {
  callId: string;
  interruption: {
    type: 'user' | 'system';
    reason?: string;
    duration?: number;
  };
  totalInterruptions: number;
  timestamp: number;
}

interface QualityScoreData {
  callId: string;
  qualityScore: {
    overall: number;
    relevance: number;
    empathy: number;
    clarity: number;
    details?: Record<string, any>;
  };
  timestamp: number;
}

/**
 * Real-time call monitoring dashboard component
 * Provides live visualization of call state, audio, emotions, and latency
 */
const CallMonitoring = ({
  callId,
  autoConnect = true,
  height = '100%',
  width = '100%',
  className = ''
}: CallMonitoringProps) => {
  // Connection state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Monitoring data state
  const [callState, setCallState] = useState<CallState | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [emotionData, setEmotionData] = useState<EmotionData | null>(null);
  const [latencyData, setLatencyData] = useState<LatencyData | null>(null);
  const [interruptions, setInterruptions] = useState<InterruptionData | null>(null);
  const [qualityScore, setQualityScore] = useState<QualityScoreData | null>(null);
  
  // Connect to monitoring socket
  useEffect(() => {
    if (!autoConnect) return;
    
    // Create socket connection
    const socketUrl = window.location.hostname === 'localhost' 
      ? `${window.location.protocol}//${window.location.hostname}:3001` 
      : `${window.location.protocol}//${window.location.hostname}`;
    
    const newSocket = io(socketUrl, {
      path: '/monitoring',
      transports: ['websocket']
    });
    
    // Setup event handlers
    newSocket.on('connect', () => {
      console.log('Connected to monitoring server');
      setIsConnected(true);
      
      // Subscribe to call if ID is provided
      if (callId) {
        newSocket.emit('monitor:subscribe', callId);
      }
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from monitoring server');
      setIsConnected(false);
    });
    
    // Monitor call events
    newSocket.on('call:stateChange', (data: CallState) => {
      setCallState(data);
    });
    
    newSocket.on('call:audioWaveform', (data: WaveformData) => {
      setWaveformData(data.waveformData);
    });
    
    newSocket.on('call:emotionUpdate', (data: EmotionData) => {
      setEmotionData(data);
    });
    
    newSocket.on('call:latencyMetrics', (data: LatencyData) => {
      setLatencyData(data);
    });
    
    newSocket.on('call:interruption', (data: InterruptionData) => {
      setInterruptions(data);
    });
    
    newSocket.on('call:qualityUpdate', (data: QualityScoreData) => {
      setQualityScore(data);
    });
    
    // Save socket reference
    setSocket(newSocket);
    
    // Cleanup on unmount
    return () => {
      if (callId) {
        newSocket.emit('monitor:unsubscribe', callId);
      }
      newSocket.disconnect();
    };
  }, [autoConnect, callId]);
  
  // Handle call ID change
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Unsubscribe from previous call
    socket.emit('monitor:unsubscribe', callId);
    
    // Subscribe to new call if ID is provided
    if (callId) {
      socket.emit('monitor:subscribe', callId);
    }
  }, [socket, isConnected, callId]);
  
  // Generate random waveform data for preview
  const generateRandomWaveform = () => {
    const data = [];
    for (let i = 0; i < 50; i++) {
      data.push((Math.random() * 2 - 1) * 0.5);
    }
    return data;
  };
  
  // Get waveform color based on call state
  const getWaveformColor = () => {
    if (!callState) return '#3b82f6'; // Default blue
    
    switch (callState.state) {
      case 'speaking':
        return '#10b981'; // Green
      case 'listening':
        return '#3b82f6'; // Blue
      case 'processing':
        return '#8b5cf6'; // Purple
      case 'error':
        return '#ef4444'; // Red
      default:
        return '#3b82f6'; // Default blue
    }
  };
  
  // Get call state label
  const getCallStateLabel = () => {
    if (!callState) return 'Disconnected';
    
    switch (callState.state) {
      case 'connecting':
        return 'Connecting';
      case 'speaking':
        return 'AI Speaking';
      case 'listening':
        return 'Listening to User';
      case 'processing':
        return 'Processing';
      case 'ended':
        return 'Call Ended';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };
  
  // Get emotion display
  const getEmotionDisplay = () => {
    if (!emotionData) return 'Neutral';
    
    return `${emotionData.emotion.primary} (${Math.round(emotionData.emotion.confidence * 100)}%)`;
  };
  
  // Format latency value
  const formatLatency = (value: number) => {
    return `${value}ms`;
  };
  
  return (
    <div className={`call-monitoring ${className}`} style={{ width, height }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Call state */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-2">Call Status</h3>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              !callState ? 'bg-gray-400' :
              callState.state === 'speaking' ? 'bg-green-500' :
              callState.state === 'listening' ? 'bg-blue-500' :
              callState.state === 'processing' ? 'bg-purple-500' :
              callState.state === 'error' ? 'bg-red-500' :
              'bg-gray-500'
            }`}></div>
            <span>{getCallStateLabel()}</span>
          </div>
          {callState && (
            <div className="text-sm text-gray-500 mt-1">
              Updated {new Date(callState.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
        
        {/* Call quality */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-2">Call Quality</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-sm text-gray-500">Overall</div>
              <div className="text-lg font-medium">
                {qualityScore ? `${qualityScore.qualityScore.overall}/100` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Interruptions</div>
              <div className="text-lg font-medium">
                {interruptions ? interruptions.totalInterruptions : '0'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Audio waveform */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 col-span-1 md:col-span-2">
          <h3 className="text-lg font-medium mb-2">Live Audio</h3>
          <div className="h-24">
            <AudioWaveform
              data={waveformData.length > 0 ? waveformData : generateRandomWaveform()}
              color={getWaveformColor()}
              height="100%"
              width="100%"
              mode="wave"
              isActive={callState?.state !== 'ended'}
            />
          </div>
        </div>
        
        {/* Emotion detection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-2">User Emotion</h3>
          <div className="text-xl font-medium">{getEmotionDisplay()}</div>
          {emotionData && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <div className="text-sm text-gray-500">Valence</div>
                <div className="h-2 bg-gray-200 rounded">
                  <div 
                    className={`h-full rounded ${emotionData.emotion.valence >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.abs(emotionData.emotion.valence) * 100}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Arousal</div>
                <div className="h-2 bg-gray-200 rounded">
                  <div 
                    className="h-full bg-blue-500 rounded"
                    style={{ width: `${emotionData.emotion.arousal * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Latency metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-2">Latency Breakdown</h3>
          {latencyData ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-sm text-gray-500">STT</div>
                <div className="text-lg font-medium">{formatLatency(latencyData.latency.stt)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">LLM</div>
                <div className="text-lg font-medium">{formatLatency(latencyData.latency.llm)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">TTS</div>
                <div className="text-lg font-medium">{formatLatency(latencyData.latency.tts)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total</div>
                <div className="text-lg font-medium">{formatLatency(latencyData.latency.total)}</div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">No data available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallMonitoring;
