import React, { useState, useEffect, useRef } from "react";
import { useSocketIO as useSocket } from "../hooks/useSocketIO";
import WaveSurfer from "wavesurfer.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Clock,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { ScrollArea } from "./ui/scroll-area";

// Types for component props
interface RealTimeCallMonitoringProps {
  callId: string;
  leadId?: string;
  campaignId?: string;
  showAudioControls?: boolean;
  showTranscript?: boolean;
  showMetrics?: boolean;
  onCallEnd?: (callData: any) => void;
}

// Emotion type for visualization
type Emotion =
  | "neutral"
  | "positive"
  | "negative"
  | "excited"
  | "confused"
  | "interested";

// Message type for conversation
interface Message {
  id: string;
  role: "ai" | "customer";
  content: string;
  timestamp: Date;
  emotion?: Emotion;
  isFinal?: boolean;
}

// Call state type
interface CallState {
  status: "connecting" | "in-progress" | "completed" | "failed";
  duration: number;
  agentName?: string;
  customerName?: string;
  phoneNumber?: string;
  sentiment: {
    current: Emotion;
    history: Array<{
      timestamp: Date;
      emotion: Emotion;
      confidence: number;
    }>;
  };
  metrics: {
    latency: number;
    interruptions: number;
    customerEngagement: number;
    scriptAdherence: number;
    conversationQuality: number;
  };
}

/**
 * RealTimeCallMonitoring Component
 *
 * A comprehensive dashboard for monitoring ongoing calls in real-time
 * Features:
 * - Live audio waveform visualization
 * - Real-time transcription with emotion detection
 * - Call metrics (latency, interruptions, engagement)
 * - Emotional journey visualization
 * - Call duration and status tracking
 */
const RealTimeCallMonitoring: React.FC<RealTimeCallMonitoringProps> = (props) => {
  const {
    callId,
    // leadId,  // Commented out as it's declared but never used
    // campaignId,  // Commented out as it's declared but never used
    showAudioControls = true,
    showTranscript = true,
    showMetrics = true,
    onCallEnd,
  } = props;
  // References
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume] = useState<number>(0.5); // Removed setVolume as it's never used
  const [messages, setMessages] = useState<Message[]>([]);
  const [callState, setCallState] = useState<CallState>({
    status: "connecting",
    duration: 0,
    sentiment: {
      current: "neutral",
      history: [],
    },
    metrics: {
      latency: 0,
      interruptions: 0,
      customerEngagement: 0,
      scriptAdherence: 0,
      conversationQuality: 0,
    },
  });

  // Socket connection for real-time updates
  const { socket, isConnected } = useSocket();

  // Initialize WaveSurfer
  useEffect(() => {
    if (waveformRef.current && !wavesurfer.current) {
      // Initialize WaveSurfer with optimized settings for real-time audio
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#4f46e5",
        progressColor: "#818cf8",
        cursorColor: "#c7d2fe",
        barWidth: 2,
        barGap: 1,
        barRadius: 3,
        height: 60,
        normalize: true,
        responsive: true,
        fillParent: true,
        // configure options as needed
      });

      // Set up WaveSurfer event listeners
      wavesurfer.current.on("play", () => setIsPlaying(true));
      wavesurfer.current.on("pause", () => setIsPlaying(false));

      // Set initial volume
      wavesurfer.current.setVolume(volume);
    }

    // Cleanup on component unmount
    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
        wavesurfer.current = null;
      }
    };
  }, [showAudioControls]);

  // Connect to socket for real-time updates
  useEffect(() => {
    if (socket && isConnected && callId) {
      // Join call room
      socket.emit("join_call_room", { callId });

      // Set up event listeners
      socket.on("call_state_update", handleCallStateUpdate);
      socket.on("audio_chunk", handleAudioChunk);
      socket.on("transcription_update", handleTranscriptionUpdate);
      socket.on("call_metrics_update", handleMetricsUpdate);
      socket.on("call_end", handleCallEnd);

      // Cleanup on component unmount
      return () => {
        socket.off("call_state_update", handleCallStateUpdate);
        socket.off("audio_chunk", handleAudioChunk);
        socket.off("transcription_update", handleTranscriptionUpdate);
        socket.off("call_metrics_update", handleMetricsUpdate);
        socket.off("call_end", handleCallEnd);
        socket.emit("leave_call_room", { callId });
      };
    }
  }, [socket, isConnected, callId]);

  // Update volume when changed
  useEffect(() => {
    if (wavesurfer.current) {
      wavesurfer.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Handle audio chunk for waveform visualization
  const handleAudioChunk = (data: { buffer: ArrayBuffer }) => {
    if (wavesurfer.current) {
      // For WaveSurfer v7+, we need to use a different approach
      // This is a simplified approach; you may need to adjust based on your exact version
      const audioContext = new AudioContext();
      audioContext.decodeAudioData(data.buffer, (audioBuffer) => {
        // We'll just update the waveform display
        // In a real implementation, you would add the audio data to the waveform
        console.log("Received audio chunk", audioBuffer.length);
      });
    }
  };

  // Handle transcription updates from real-time speech-to-text
  const handleTranscriptionUpdate = (data: {
    id: string;
    role: "ai" | "customer";
    text: string;
    isFinal: boolean;
    emotion?: Emotion;
    timestamp: string;
  }) => {
    const timestamp = new Date(data.timestamp);

    setMessages((prevMessages) => {
      // Check if this is an update to an existing message
      const existingMessageIndex = prevMessages.findIndex(
        (m) => m.id === data.id
      );

      if (existingMessageIndex !== -1) {
        // Update existing message
        const updatedMessages = [...prevMessages];
        updatedMessages[existingMessageIndex] = {
          ...updatedMessages[existingMessageIndex],
          content: data.text,
          isFinal: data.isFinal,
          emotion: data.emotion,
        };
        return updatedMessages;
      } else {
        // Add new message
        return [
          ...prevMessages,
          {
            id: data.id,
            role: data.role,
            content: data.text,
            timestamp,
            emotion: data.emotion,
            isFinal: data.isFinal,
          },
        ];
      }
    });

    // Update emotion in call state if this is customer speech
    if (data.role === "customer" && data.emotion) {
      setCallState((prevState) => ({
        ...prevState,
        sentiment: {
          current: data.emotion as Emotion,
          history: [
            ...prevState.sentiment.history,
            {
              timestamp,
              emotion: data.emotion as Emotion,
              confidence: 0.8, // Default confidence when not provided
            },
          ],
        },
      }));
    }
  };

  // Handle call state updates
  const handleCallStateUpdate = (data: Partial<CallState>) => {
    setCallState((prevState) => ({
      ...prevState,
      ...data,
    }));
  };

  // Handle metrics updates
  const handleMetricsUpdate = (data: Partial<CallState["metrics"]>) => {
    setCallState((prevState) => ({
      ...prevState,
      metrics: {
        ...prevState.metrics,
        ...data,
      },
    }));
  };

  // Handle call end
  const handleCallEnd = (data: any) => {
    setCallState((prevState) => ({
      ...prevState,
      status: "completed",
    }));

    if (onCallEnd) {
      onCallEnd(data);
    }
  };

  // Toggle play/pause for audio
  const togglePlayPause = () => {
    if (wavesurfer.current) {
      if (isPlaying) {
        wavesurfer.current.pause();
      } else {
        wavesurfer.current.play();
      }
    }
  };

  // Toggle mute/unmute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Get emotion color for visual indicators
  const getEmotionColor = (emotion: Emotion) => {
    switch (emotion) {
      case "positive":
        return "bg-green-500";
      case "negative":
        return "bg-red-500";
      case "excited":
        return "bg-yellow-500";
      case "confused":
        return "bg-orange-500";
      case "interested":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Get call status badge
  const getStatusBadge = () => {
    switch (callState.status) {
      case "connecting":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            Connecting
          </Badge>
        );
      case "in-progress":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            In Progress
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800">
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800">
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Live Call Monitoring</CardTitle>
            <CardDescription>
              Call ID: {callId} | {getStatusBadge()}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">
              {formatDuration(callState.duration)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Audio Waveform */}
        {showAudioControls && (
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <h3 className="text-sm font-medium">Live Audio</h3>
              <div className="ml-auto flex items-center space-x-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={togglePlayPause}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isPlaying ? "Pause" : "Play"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={toggleMute}
                      >
                        {isMuted ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isMuted ? "Unmute" : "Mute"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div
              ref={waveformRef}
              className="w-full h-16 bg-gray-50 rounded-md"
            ></div>
          </div>
        )}

        {/* Call Metrics */}
        {showMetrics && (
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Real-Time Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="bg-gray-50 p-2 rounded-md">
                <div className="text-xs text-gray-500">Latency</div>
                <div className="text-sm font-medium">
                  {callState.metrics.latency}ms
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded-md">
                <div className="text-xs text-gray-500">Interruptions</div>
                <div className="text-sm font-medium">
                  {callState.metrics.interruptions}
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded-md">
                <div className="text-xs text-gray-500">Engagement</div>
                <div className="text-sm font-medium">
                  {callState.metrics.customerEngagement}%
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded-md">
                <div className="text-xs text-gray-500">Script Adherence</div>
                <div className="text-sm font-medium">
                  {callState.metrics.scriptAdherence}%
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded-md">
                <div className="text-xs text-gray-500">Quality Score</div>
                <div className="text-sm font-medium">
                  {callState.metrics.conversationQuality}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Emotion Timeline */}
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <h3 className="text-sm font-medium">Emotion Timeline</h3>
            <Badge
              className="ml-2"
              variant="outline"
              style={{
                backgroundColor: getEmotionColor(
                  callState.sentiment.current
                ).replace("bg-", "bg-opacity-20 bg-"),
                color: getEmotionColor(callState.sentiment.current).replace(
                  "bg-",
                  "text-"
                ),
              }}
            >
              {callState.sentiment.current.charAt(0).toUpperCase() +
                callState.sentiment.current.slice(1)}
            </Badge>
          </div>
          <div className="flex h-6 space-x-1">
            {callState.sentiment.history.slice(-20).map((item, idx) => (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-2 ${getEmotionColor(
                        item.emotion
                      )} rounded-sm`}
                      style={{
                        height: `${Math.max(40, item.confidence * 100)}%`,
                      }}
                    ></div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {item.emotion} (
                      {new Date(item.timestamp).toLocaleTimeString()})
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>

        {/* Live Transcript */}
        {showTranscript && (
          <div>
            <h3 className="text-sm font-medium mb-2">Live Transcript</h3>
            <ScrollArea className="h-64 border rounded-md p-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-2 flex ${
                    message.role === "ai" ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`max-w-3/4 rounded-lg p-2 ${
                      message.role === "ai"
                        ? "bg-blue-50 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <div className="flex items-center mb-1">
                      <span className="text-xs font-medium">
                        {message.role === "ai" ? "AI Agent" : "Customer"}
                      </span>
                      {message.emotion && (
                        <Badge
                          className="ml-2"
                          variant="outline"
                          style={{
                            backgroundColor: getEmotionColor(
                              message.emotion
                            ).replace("bg-", "bg-opacity-20 bg-"),
                            color: getEmotionColor(message.emotion).replace(
                              "bg-",
                              "text-"
                            ),
                            fontSize: "0.6rem",
                            padding: "0 4px",
                          }}
                        >
                          {message.emotion}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500 ml-auto">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                    {!message.isFinal && (
                      <div className="text-xs text-gray-500 italic">
                        Processing...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2">
        <div className="flex items-center text-xs text-gray-500 w-full justify-between">
          <div>
            {callState.customerName && (
              <span className="mr-2">Customer: {callState.customerName}</span>
            )}
            {callState.phoneNumber && (
              <span>Phone: {callState.phoneNumber}</span>
            )}
          </div>
          <div>
            {callState.status === "in-progress" && (
              <Badge variant="outline" className="bg-green-100 text-green-800">
                Live
              </Badge>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};

export default RealTimeCallMonitoring;
