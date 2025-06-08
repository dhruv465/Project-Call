/**
 * ElevenLabs Conversational AI WebSocket Client Example
 * 
 * This is an example of how to use the conversational AI WebSocket API
 * from a client application.
 */

// Initialize the WebSocket connection
function initializeConversationalAI(voiceId, conversationId = null) {
  // Construct WebSocket URL with query parameters
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const baseUrl = window.location.hostname === 'localhost' ? 
    `${wsProtocol}//${window.location.hostname}:3001` : 
    `${wsProtocol}//${window.location.hostname}`;
  
  const queryParams = new URLSearchParams();
  if (voiceId) queryParams.append('voiceId', voiceId);
  if (conversationId) queryParams.append('conversationId', conversationId);
  
  const wsUrl = `${baseUrl}/voice/conversational-ai?${queryParams.toString()}`;
  
  // Create WebSocket connection
  const socket = new WebSocket(wsUrl);
  let activeConversationId = conversationId;
  
  // Create audio context for playing audio
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioQueue = [];
  let isPlaying = false;
  
  // WebSocket event handlers
  socket.onopen = () => {
    console.log('WebSocket connection established');
  };
  
  socket.onmessage = async (event) => {
    try {
      // Check if the message is JSON or binary audio data
      if (event.data instanceof Blob) {
        // Handle binary audio data
        const audioBuffer = await event.data.arrayBuffer();
        queueAudioForPlayback(audioBuffer);
      } else {
        // Handle JSON control messages
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'ready':
            // WebSocket is ready to accept messages
            activeConversationId = message.conversationId;
            console.log('Conversational AI ready', message);
            break;
            
          case 'processing':
            // AI is processing the request
            console.log('Processing input...');
            break;
            
          case 'completed':
            // Response generation completed
            console.log('Response completed', message);
            break;
            
          case 'interrupted':
            // Response was interrupted
            console.log('Response interrupted', message);
            // Clear audio queue when interrupted
            clearAudioQueue();
            break;
            
          case 'error':
            // Error occurred
            console.error('Conversational AI error:', message.message);
            break;
            
          default:
            console.log('Unknown message type:', message);
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  };
  
  socket.onclose = (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  // Function to send text input to the conversational AI
  function sendText(text, language = 'English') {
    if (socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not open');
      return false;
    }
    
    socket.send(JSON.stringify({
      type: 'text',
      text,
      language
    }));
    
    return true;
  }
  
  // Function to interrupt the current response
  function interrupt() {
    if (socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not open');
      return false;
    }
    
    socket.send(JSON.stringify({
      type: 'interrupt'
    }));
    
    return true;
  }
  
  // Function to close the WebSocket connection
  function close() {
    socket.close();
  }
  
  // Helper function to queue audio for playback
  function queueAudioForPlayback(audioBuffer) {
    audioQueue.push(audioBuffer);
    if (!isPlaying) {
      playNextInQueue();
    }
  }
  
  // Helper function to play the next audio chunk in the queue
  async function playNextInQueue() {
    if (audioQueue.length === 0) {
      isPlaying = false;
      return;
    }
    
    isPlaying = true;
    const buffer = audioQueue.shift();
    
    try {
      // Decode the audio data
      const audioBuffer = await audioContext.decodeAudioData(buffer);
      
      // Create source node
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      // Play the audio
      source.start(0);
      
      // When playback ends, play the next chunk
      source.onended = () => {
        playNextInQueue();
      };
    } catch (error) {
      console.error('Error playing audio:', error);
      playNextInQueue(); // Skip to next chunk on error
    }
  }
  
  // Helper function to clear the audio queue
  function clearAudioQueue() {
    audioQueue.length = 0;
    isPlaying = false;
  }
  
  // Return the public API
  return {
    sendText,
    interrupt,
    close,
    getConversationId: () => activeConversationId
  };
}

// Example usage:
/*
// Initialize with a voice ID
const conversationalAI = initializeConversationalAI('voice-id-here');

// Send a message
document.getElementById('sendButton').addEventListener('click', () => {
  const text = document.getElementById('userInput').value;
  conversationalAI.sendText(text);
});

// Interrupt the response
document.getElementById('interruptButton').addEventListener('click', () => {
  conversationalAI.interrupt();
});

// Close the connection when done
document.getElementById('closeButton').addEventListener('click', () => {
  conversationalAI.close();
});
*/
