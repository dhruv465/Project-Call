/**
 * Latency Benchmark Script
 * 
 * This script tests and compares the latency of different AI voice response methods:
 * 1. Original sequential processing
 * 2. Optimized controller with caching
 * 3. Low-latency controller with parallel processing
 * 
 * Usage:
 * node benchmark-latency.js
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const config = {
  serverUrl: 'ws://localhost:3001',
  callId: process.env.CALL_ID || '60f1a5b5e6b5a40015f1b5a5', // Replace with a valid call ID
  conversationId: process.env.CONVERSATION_ID || null, // Optional, will be generated if not provided
  voiceId: process.env.VOICE_ID || 'default', // Replace with a valid voice ID
  testPhrases: [
    'Hello, how are you?',
    'Tell me about your product.',
    'What services do you offer?',
    'Can you explain your pricing?',
    'How does this work?'
  ],
  endpoints: [
    {
      name: 'Original',
      path: '/voice/stream',
      description: 'Original sequential processing'
    },
    {
      name: 'Optimized',
      path: '/voice/optimized-stream',
      description: 'Optimized with response caching'
    },
    {
      name: 'Low Latency',
      path: '/voice/low-latency',
      description: 'Parallel processing with human-like cues'
    }
  ]
};

// Results storage
const results = {
  timestamps: {},
  latencies: {},
  summary: {}
};

/**
 * Test a specific endpoint with the test phrases
 */
async function testEndpoint(endpoint, phrases) {
  console.log(`\n======= Testing ${endpoint.name} Endpoint =======`);
  console.log(`Endpoint: ${endpoint.path}`);
  console.log(`Description: ${endpoint.description}`);
  
  // Initialize result storage for this endpoint
  results.timestamps[endpoint.name] = [];
  results.latencies[endpoint.name] = [];
  
  // Create WebSocket URL
  const queryParams = new URLSearchParams();
  if (config.callId) queryParams.append('callId', config.callId);
  if (config.conversationId) queryParams.append('conversationId', config.conversationId);
  if (config.voiceId) queryParams.append('voiceId', config.voiceId);
  
  const wsUrl = `${config.serverUrl}${endpoint.path}?${queryParams.toString()}`;
  
  return new Promise((resolve, reject) => {
    // Connect to WebSocket
    const ws = new WebSocket(wsUrl);
    let currentPhrase = null;
    let phraseIndex = 0;
    let startTime = 0;
    let firstChunkTime = 0;
    let lastChunkTime = 0;
    let receivedChunks = 0;
    
    // Track received audio data
    const audioData = [];
    
    ws.on('open', () => {
      console.log('WebSocket connection established');
      
      // Wait a bit before sending first phrase
      setTimeout(() => {
        if (phraseIndex < phrases.length) {
          sendNextPhrase();
        } else {
          ws.close();
          resolve();
        }
      }, 1000);
    });
    
    ws.on('message', (data) => {
      // Record time when first chunk is received
      if (receivedChunks === 0) {
        firstChunkTime = performance.now();
        const latency = firstChunkTime - startTime;
        console.log(`First chunk latency: ${latency.toFixed(2)}ms`);
        
        results.latencies[endpoint.name].push({
          phrase: currentPhrase,
          firstChunkLatency: latency
        });
      }
      
      // Track received audio chunks
      receivedChunks++;
      lastChunkTime = performance.now();
      
      // Store audio data (for potential saving)
      if (data instanceof Buffer) {
        audioData.push(data);
      }
      
      // After receiving the last chunk, send the next phrase
      if (receivedChunks > 0 && performance.now() - lastChunkTime > 1000) {
        const totalLatency = lastChunkTime - startTime;
        console.log(`Total response latency: ${totalLatency.toFixed(2)}ms`);
        console.log(`Received ${receivedChunks} audio chunks`);
        
        // Update results
        results.latencies[endpoint.name][results.latencies[endpoint.name].length - 1].totalLatency = totalLatency;
        results.latencies[endpoint.name][results.latencies[endpoint.name].length - 1].chunks = receivedChunks;
        
        // Reset for next phrase
        receivedChunks = 0;
        audioData.length = 0;
        
        // Send next phrase after a delay
        setTimeout(() => {
          if (phraseIndex < phrases.length) {
            sendNextPhrase();
          } else {
            ws.close();
            resolve();
          }
        }, 2000);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      resolve();
    });
    
    // Function to send the next test phrase
    function sendNextPhrase() {
      currentPhrase = phrases[phraseIndex];
      console.log(`\nTesting phrase: "${currentPhrase}"`);
      
      // Record start time
      startTime = performance.now();
      
      // Send the phrase
      ws.send(currentPhrase);
      
      // Store timestamp
      results.timestamps[endpoint.name].push({
        phrase: currentPhrase,
        startTime
      });
      
      // Move to next phrase
      phraseIndex++;
    }
  });
}

/**
 * Generate summary statistics from results
 */
function generateSummary() {
  // Calculate average latencies for each endpoint
  for (const endpoint of config.endpoints) {
    const latencies = results.latencies[endpoint.name];
    
    if (latencies && latencies.length > 0) {
      const firstChunkLatencies = latencies.map(l => l.firstChunkLatency);
      const totalLatencies = latencies.map(l => l.totalLatency).filter(l => l !== undefined);
      
      const avgFirstChunkLatency = firstChunkLatencies.reduce((a, b) => a + b, 0) / firstChunkLatencies.length;
      const avgTotalLatency = totalLatencies.reduce((a, b) => a + b, 0) / totalLatencies.length;
      
      results.summary[endpoint.name] = {
        avgFirstChunkLatency,
        avgTotalLatency,
        minFirstChunkLatency: Math.min(...firstChunkLatencies),
        maxFirstChunkLatency: Math.max(...firstChunkLatencies),
        minTotalLatency: Math.min(...totalLatencies),
        maxTotalLatency: Math.max(...totalLatencies)
      };
    }
  }
}

/**
 * Save results to a file
 */
function saveResults() {
  const filename = `latency-benchmark-${new Date().toISOString().replace(/:/g, '-')}.json`;
  const filepath = path.join(__dirname, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${filepath}`);
}

/**
 * Print summary results
 */
function printSummary() {
  console.log('\n======= BENCHMARK SUMMARY =======');
  
  for (const endpoint of config.endpoints) {
    const summary = results.summary[endpoint.name];
    
    if (summary) {
      console.log(`\n${endpoint.name} Endpoint (${endpoint.description})`);
      console.log(`  Average First Chunk Latency: ${summary.avgFirstChunkLatency.toFixed(2)}ms`);
      console.log(`  Average Total Response Latency: ${summary.avgTotalLatency.toFixed(2)}ms`);
      console.log(`  Min/Max First Chunk Latency: ${summary.minFirstChunkLatency.toFixed(2)}ms / ${summary.maxFirstChunkLatency.toFixed(2)}ms`);
      console.log(`  Min/Max Total Latency: ${summary.minTotalLatency.toFixed(2)}ms / ${summary.maxTotalLatency.toFixed(2)}ms`);
    }
  }
  
  // Calculate improvement percentages
  if (results.summary.Original && results.summary['Low Latency']) {
    const originalLatency = results.summary.Original.avgFirstChunkLatency;
    const lowLatencyLatency = results.summary['Low Latency'].avgFirstChunkLatency;
    const improvement = ((originalLatency - lowLatencyLatency) / originalLatency) * 100;
    
    console.log(`\nIMPROVEMENT: Low Latency vs Original`);
    console.log(`  First Response Latency: ${improvement.toFixed(2)}% faster`);
    
    const originalTotalLatency = results.summary.Original.avgTotalLatency;
    const lowLatencyTotalLatency = results.summary['Low Latency'].avgTotalLatency;
    const totalImprovement = ((originalTotalLatency - lowLatencyTotalLatency) / originalTotalLatency) * 100;
    
    console.log(`  Total Response Latency: ${totalImprovement.toFixed(2)}% faster`);
  }
}

/**
 * Run the benchmark
 */
async function runBenchmark() {
  console.log('Starting Latency Benchmark');
  console.log('=========================');
  
  try {
    // Test each endpoint sequentially
    for (const endpoint of config.endpoints) {
      await testEndpoint(endpoint, config.testPhrases);
    }
    
    // Generate summary statistics
    generateSummary();
    
    // Print summary
    printSummary();
    
    // Save results to file
    saveResults();
    
  } catch (error) {
    console.error('Benchmark failed:', error);
  }
}

// Run the benchmark
runBenchmark();
