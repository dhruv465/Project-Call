#!/usr/bin/env node

/**
 * Deepgram API key validation and testing script
 * 
 * This script validates a Deepgram API key, tests the connection to Deepgram's API,
 * and measures latency to different Deepgram regions to suggest the best region.
 * 
 * Usage:
 *   node deepgram-validate.js [API_KEY]
 * 
 * If API_KEY is not provided, the script will check the DEEPGRAM_API_KEY environment variable.
 */

// Built-in modules
const crypto = require('crypto');
const https = require('https');
const { performance } = require('perf_hooks');

// API key sources
const apiKey = process.argv[2] || process.env.DEEPGRAM_API_KEY || '';

// Deepgram regions
const regions = {
  'us-east': 'api.deepgram.com',
  'us-west': 'api-us-west.deepgram.com',
  'eu-west': 'api-eu-west.deepgram.com',
  'asia': 'api-asia.deepgram.com'
};

// Validate key format
function validateKeyFormat(key) {
  if (!key) {
    return { isValid: false, error: 'No API key provided. Set DEEPGRAM_API_KEY environment variable or pass as argument.' };
  }
  
  if (key.length < 30) {
    return {
      isValid: false,
      error: 'Deepgram API key must be at least 30 characters long'
    };
  }
  
  if (key.length > 100) {
    return {
      isValid: false,
      error: 'Deepgram API key appears to be too long (max 100 characters)'
    };
  }
  
  return { isValid: true };
}

// Test API connection
async function testApiConnection(key, endpoint = 'api.deepgram.com') {
  return new Promise((resolve) => {
    const startTime = performance.now();
    
    const options = {
      hostname: endpoint,
      port: 443,
      path: '/v1/listen',
      method: 'GET',
      headers: {
        'Authorization': `Token ${key}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };
    
    const req = https.request(options, (res) => {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      // For API key testing, even a 401 is a successful connection
      // (it means the API is reachable but the key is invalid)
      if (res.statusCode === 200 || res.statusCode === 401 || res.statusCode === 403) {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          let errorMessage = null;
          let isValid = res.statusCode === 200;
          
          if (res.statusCode === 401 || res.statusCode === 403) {
            errorMessage = 'Invalid API key or insufficient permissions';
            isValid = false;
          }
          
          resolve({
            isValid,
            latency,
            statusCode: res.statusCode,
            error: errorMessage
          });
        });
      } else {
        resolve({
          isValid: false,
          latency,
          statusCode: res.statusCode,
          error: `Unexpected status code: ${res.statusCode}`
        });
      }
    });
    
    req.on('error', (error) => {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      resolve({
        isValid: false,
        latency,
        error: `Connection error: ${error.message}`
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        isValid: false,
        latency: 5000,
        error: 'Connection timed out'
      });
    });
    
    req.end();
  });
}

// Measure latency to different regions
async function measureRegionLatencies(key) {
  const results = {};
  
  for (const [region, endpoint] of Object.entries(regions)) {
    console.log(`Testing ${region} region (${endpoint})...`);
    const result = await testApiConnection(key, endpoint);
    results[region] = result;
  }
  
  return results;
}

// Find best region based on latency
function findBestRegion(results) {
  let bestRegion = 'us-east'; // Default
  let lowestLatency = Number.MAX_SAFE_INTEGER;
  
  for (const [region, result] of Object.entries(results)) {
    if (result.isValid && result.latency < lowestLatency) {
      bestRegion = region;
      lowestLatency = result.latency;
    }
  }
  
  return {
    region: bestRegion,
    latency: results[bestRegion].latency
  };
}

// Generate a sample authentication header
function generateAuthHeader(key) {
  const timestamp = Math.floor(Date.now() / 1000);
  const path = '/v1/listen';
  
  // Create HMAC signature (this is just for demonstration)
  // In practice, Deepgram uses token-based auth, not HMAC
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(`${timestamp}:${path}`);
  const signature = hmac.digest('hex');
  
  return {
    timestamp,
    signature,
    header: `Token ${key}`
  };
}

// Run the validation and tests
async function run() {
  console.log('Deepgram API Key Validation and Testing Tool');
  console.log('============================================\n');
  
  // Validate key format
  console.log('Validating API key format...');
  const formatValidation = validateKeyFormat(apiKey);
  
  if (!formatValidation.isValid) {
    console.error(`❌ Format validation failed: ${formatValidation.error}`);
    process.exit(1);
  }
  
  console.log('✅ API key format appears valid');
  console.log(`   Length: ${apiKey.length} characters`);
  console.log(`   Prefix: ${apiKey.substring(0, 4)}...`);
  
  // Show auth header example
  const authInfo = generateAuthHeader(apiKey);
  console.log('\nAuthentication header:');
  console.log(`   ${authInfo.header.substring(0, 15)}...`);
  
  // Test connection to main API
  console.log('\nTesting connection to Deepgram API...');
  const connectionTest = await testApiConnection(apiKey);
  
  if (connectionTest.isValid) {
    console.log(`✅ Connection successful (latency: ${connectionTest.latency}ms)`);
  } else {
    console.error(`❌ Connection test failed: ${connectionTest.error}`);
    console.log('   This could be due to:');
    console.log('   - Invalid API key');
    console.log('   - Network connectivity issues');
    console.log('   - Deepgram service outage');
    process.exit(1);
  }
  
  // Measure latency to different regions
  console.log('\nMeasuring latency to different Deepgram regions...');
  const regionLatencies = await measureRegionLatencies(apiKey);
  
  console.log('\nRegion latency results:');
  for (const [region, result] of Object.entries(regionLatencies)) {
    const status = result.isValid ? '✅' : '❌';
    const latency = result.isValid ? `${result.latency}ms` : 'N/A';
    console.log(`   ${status} ${region.padEnd(10)} ${latency.padEnd(8)} ${result.isValid ? '' : result.error || ''}`);
  }
  
  // Find best region
  const bestRegion = findBestRegion(regionLatencies);
  console.log(`\n✨ Recommended region: ${bestRegion.region} (${bestRegion.latency}ms)`);
  
  console.log('\nConfiguration recommendation:');
  console.log('```');
  console.log(`deepgramConfig: {`);
  console.log(`  isEnabled: true,`);
  console.log(`  apiKey: "${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}",`);
  console.log(`  region: "${bestRegion.region}",`);
  console.log(`  fallbackToGoogle: true,`);
  console.log(`  maxRetries: 3,`);
  console.log(`  retryDelay: 1000,`);
  console.log(`  timeout: 10000`);
  console.log(`}`);
  console.log('```');
}

// Run the script
run().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});
