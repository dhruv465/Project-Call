#!/usr/bin/env node

/**
 * Memory analysis script for debugging memory issues
 */

const fs = require('fs');
const path = require('path');

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Analyze package.json dependencies
function analyzeDependencies() {
  console.log('📊 Analyzing dependencies...\n');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Known heavy dependencies to look out for
    const heavyDeps = [
      '@tensorflow/tfjs',
      '@google/generative-ai',
      '@anthropic-ai/sdk',
      'mongoose',
      'socket.io',
      'winston'
    ];
    
    console.log('Heavy dependencies found:');
    heavyDeps.forEach(dep => {
      if (deps[dep]) {
        console.log(`  - ${dep}: ${deps[dep]}`);
      }
    });
    
    console.log(`\nTotal dependencies: ${Object.keys(deps).length}\n`);
  } catch (error) {
    console.error('Error reading package.json:', error.message);
  }
}

// Check current memory usage
function checkMemoryUsage() {
  console.log('🧠 Current memory usage:');
  const usage = process.memoryUsage();
  
  console.log(`  - Heap Used: ${formatBytes(usage.heapUsed)}`);
  console.log(`  - Heap Total: ${formatBytes(usage.heapTotal)}`);
  console.log(`  - RSS: ${formatBytes(usage.rss)}`);
  console.log(`  - External: ${formatBytes(usage.external)}`);
  console.log(`  - Array Buffers: ${formatBytes(usage.arrayBuffers)}\n`);
}

// Memory optimization recommendations
function showRecommendations() {
  console.log('💡 Memory optimization recommendations:\n');
  
  const recommendations = [
    '1. Use --max-old-space-size=1536 instead of 2048 for Render\'s starter plan',
    '2. Enable garbage collection with --expose-gc flag',
    '3. Reduce MongoDB connection pool size in production',
    '4. Use compression middleware to reduce response sizes',
    '5. Implement proper error handling to prevent memory leaks',
    '6. Consider lazy loading heavy dependencies',
    '7. Monitor memory usage with intervals and forced GC',
    '8. Use Winston with file rotation to prevent log buildup',
    '9. Reduce log levels in production (use "warn" or "error")',
    '10. Consider using Redis for session storage instead of memory'
  ];
  
  recommendations.forEach(rec => console.log(`  ${rec}`));
  console.log();
}

// Check Node.js version and flags
function checkNodeConfiguration() {
  console.log('⚙️  Node.js Configuration:');
  console.log(`  - Version: ${process.version}`);
  console.log(`  - Platform: ${process.platform}`);
  console.log(`  - Architecture: ${process.arch}`);
  console.log(`  - Node Options: ${process.env.NODE_OPTIONS || 'None set'}`);
  console.log(`  - Max Old Space Size: ${process.execArgv.find(arg => arg.includes('max-old-space-size')) || 'Default'}\n`);
}

// Main execution
function main() {
  console.log('🔍 Project Call Memory Analysis\n');
  console.log('=====================================\n');
  
  checkNodeConfiguration();
  checkMemoryUsage();
  analyzeDependencies();
  showRecommendations();
  
  console.log('=====================================');
  console.log('Analysis complete! 🎉');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  formatBytes,
  analyzeDependencies,
  checkMemoryUsage,
  showRecommendations,
  checkNodeConfiguration
};
