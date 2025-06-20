#!/usr/bin/env node

/**
 * Deepgram Configuration Setup Script
 * 
 * This script helps set up and update Deepgram configuration in the MongoDB database.
 * It validates the API key, tests connections to different regions, and updates the configuration.
 * 
 * Usage:
 *   node setup-deepgram-config.js [--key=YOUR_API_KEY] [--region=REGION] [--enable=true|false]
 * 
 * Options:
 *   --key=API_KEY       Deepgram API key (if not provided, will use DEEPGRAM_API_KEY env var)
 *   --region=REGION     Deepgram region (us-east, us-west, eu-west, asia)
 *   --enable=true|false Enable or disable Deepgram integration
 *   --fallback=true|false Enable fallback to Google Speech-to-Text
 *   --auto-region       Automatically determine the best region based on latency
 */

// Built-in modules
const { MongoClient } = require('mongodb');
const https = require('https');
const { performance } = require('perf_hooks');

// Parse command line arguments
const args = {};
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    args[key] = value === undefined ? true : value;
  }
});

// Configuration
const config = {
  apiKey: args.key || process.env.DEEPGRAM_API_KEY,
  region: args.region || 'us-east',
  isEnabled: args.enable === 'true' || args.enable === undefined,
  fallbackToGoogle: args.fallback === 'true' || true,
  autoRegion: args['auto-region'] === true || args['auto-region'] === 'true',
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 10000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/projectcall'
};

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
    return { isValid: false, error: 'No API key provided' };
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

// Update configuration in database
async function updateConfiguration(deepgramConfig) {
  const client = new MongoClient(config.mongoUri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const configCollection = db.collection('configurations');
    
    // Get current configuration or create a new one
    let systemConfig = await configCollection.findOne({});
    
    if (!systemConfig) {
      systemConfig = { deepgramConfig: {} };
    }
    
    // Update with new Deepgram configuration
    const result = await configCollection.updateOne(
      systemConfig._id ? { _id: systemConfig._id } : {},
      {
        $set: {
          deepgramConfig: deepgramConfig
        }
      },
      { upsert: true }
    );
    
    if (result.matchedCount > 0) {
      console.log('Configuration updated successfully');
    } else if (result.upsertedCount > 0) {
      console.log('Configuration created successfully');
    } else {
      console.log('No changes made to configuration');
    }
    
    return true;
  } catch (error) {
    console.error('Error updating configuration:', error.message);
    return false;
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the configuration setup
async function run() {
  console.log('Deepgram Configuration Setup');
  console.log('============================\n');
  
  // Check API key
  if (!config.apiKey) {
    console.error('❌ No API key provided. Use --key=YOUR_API_KEY or set DEEPGRAM_API_KEY env var.');
    process.exit(1);
  }
  
  // Validate key format
  console.log('Validating API key format...');
  const formatValidation = validateKeyFormat(config.apiKey);
  
  if (!formatValidation.isValid) {
    console.error(`❌ Format validation failed: ${formatValidation.error}`);
    process.exit(1);
  }
  
  console.log('✅ API key format appears valid');
  
  // Test connection to main API
  console.log('\nTesting connection to Deepgram API...');
  const connectionTest = await testApiConnection(config.apiKey);
  
  if (connectionTest.isValid) {
    console.log(`✅ Connection successful (latency: ${connectionTest.latency}ms)`);
  } else {
    console.error(`❌ Connection test failed: ${connectionTest.error}`);
    
    // If the key format is valid but connection fails, prompt to continue
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('Continue with configuration update despite connection failure? (y/N): ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'y') {
      console.log('Configuration update aborted.');
      process.exit(1);
    }
  }
  
  // Determine best region if auto-region is enabled
  if (config.autoRegion) {
    console.log('\nAuto-region enabled. Measuring latency to different Deepgram regions...');
    const regionLatencies = await measureRegionLatencies(config.apiKey);
    
    console.log('\nRegion latency results:');
    for (const [region, result] of Object.entries(regionLatencies)) {
      const status = result.isValid ? '✅' : '❌';
      const latency = result.isValid ? `${result.latency}ms` : 'N/A';
      console.log(`   ${status} ${region.padEnd(10)} ${latency.padEnd(8)} ${result.isValid ? '' : result.error || ''}`);
    }
    
    // Find and set best region
    const bestRegion = findBestRegion(regionLatencies);
    config.region = bestRegion.region;
    console.log(`\n✨ Automatically selected region: ${bestRegion.region} (${bestRegion.latency}ms)`);
  }
  
  // Prepare configuration
  const deepgramConfig = {
    isEnabled: config.isEnabled,
    apiKey: config.apiKey,
    region: config.region,
    fallbackToGoogle: config.fallbackToGoogle,
    maxRetries: config.maxRetries,
    retryDelay: config.retryDelay,
    timeout: config.timeout
  };
  
  console.log('\nConfiguring Deepgram with the following settings:');
  console.log(JSON.stringify({
    ...deepgramConfig,
    apiKey: `${config.apiKey.substring(0, 3)}...${config.apiKey.substring(config.apiKey.length - 3)}`
  }, null, 2));
  
  // Update configuration in database
  console.log('\nUpdating configuration in database...');
  const updated = await updateConfiguration(deepgramConfig);
  
  if (updated) {
    console.log('\n✅ Deepgram configuration updated successfully');
    console.log('You can now use Deepgram for speech-to-text transcription.');
  } else {
    console.error('\n❌ Failed to update Deepgram configuration');
    process.exit(1);
  }
}

// Run the script
run().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});
