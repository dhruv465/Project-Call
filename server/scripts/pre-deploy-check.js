#!/usr/bin/env node

/**
 * Pre-deployment verification script
 * Checks that all memory optimizations are properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Pre-Deployment Verification\n');
console.log('===============================\n');

// Check 1: Package.json scripts
function checkPackageJson() {
  console.log('1. Checking package.json configuration...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    
    const startScript = packageJson.scripts.start;
    const hasMemoryFlags = startScript.includes('--max-old-space-size=1536') && 
                          startScript.includes('--optimize-for-size') && 
                          startScript.includes('--expose-gc');
    
    if (hasMemoryFlags) {
      console.log('   ✅ Memory optimization flags found in start script');
    } else {
      console.log('   ❌ Missing memory optimization flags in start script');
      return false;
    }
    
    if (packageJson.scripts['memory:analyze']) {
      console.log('   ✅ Memory analysis script configured');
    } else {
      console.log('   ❌ Memory analysis script missing');
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ Error reading package.json:', error.message);
    return false;
  }
}

// Check 2: Memory optimization utility
function checkMemoryOptimization() {
  console.log('\n2. Checking memory optimization utility...');
  
  const utilPath = path.join(__dirname, '../src/utils/memoryOptimization.ts');
  if (fs.existsSync(utilPath)) {
    console.log('   ✅ Memory optimization utility exists');
    
    const content = fs.readFileSync(utilPath, 'utf8');
    if (content.includes('initializeMemoryOptimization') && 
        content.includes('setInterval') && 
        content.includes('(global as any).gc')) {
      console.log('   ✅ Memory optimization functions implemented');
      return true;
    } else {
      console.log('   ❌ Memory optimization functions incomplete');
      return false;
    }
  } else {
    console.log('   ❌ Memory optimization utility missing');
    return false;
  }
}

// Check 3: Render.yaml configuration
function checkRenderConfig() {
  console.log('\n3. Checking render.yaml configuration...');
  
  const renderPath = path.join(__dirname, '../../render.yaml');
  if (fs.existsSync(renderPath)) {
    console.log('   ✅ render.yaml exists');
    
    const content = fs.readFileSync(renderPath, 'utf8');
    if (content.includes('--max-old-space-size=1536') && 
        content.includes('--optimize-for-size') && 
        content.includes('--expose-gc')) {
      console.log('   ✅ Memory optimization flags configured in render.yaml');
      return true;
    } else {
      console.log('   ❌ Memory optimization flags missing in render.yaml');
      return false;
    }
  } else {
    console.log('   ❌ render.yaml missing');
    return false;
  }
}

// Check 4: TypeScript compilation
function checkCompilation() {
  console.log('\n4. Checking TypeScript compilation...');
  
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    const indexPath = path.join(distPath, 'index.js');
    if (fs.existsSync(indexPath)) {
      console.log('   ✅ Application compiled successfully');
      return true;
    } else {
      console.log('   ❌ Main application file missing in dist/');
      return false;
    }
  } else {
    console.log('   ❌ dist/ directory not found - run npm run build');
    return false;
  }
}

// Check 5: Environment files
function checkEnvironmentFiles() {
  console.log('\n5. Checking environment configuration...');
  
  const prodEnvPath = path.join(__dirname, '../.env.production');
  if (fs.existsSync(prodEnvPath)) {
    console.log('   ✅ Production environment file exists');
    
    const content = fs.readFileSync(prodEnvPath, 'utf8');
    if (content.includes('NODE_OPTIONS=') && content.includes('LOG_LEVEL=warn')) {
      console.log('   ✅ Production environment properly configured');
      return true;
    } else {
      console.log('   ⚠️  Production environment file exists but may need configuration');
      return true;
    }
  } else {
    console.log('   ⚠️  Production environment file not found (optional)');
    return true;
  }
}

// Check 6: Database optimization
function checkDatabaseConfig() {
  console.log('\n6. Checking database optimization...');
  
  const dbPath = path.join(__dirname, '../src/database/connection.ts');
  if (fs.existsSync(dbPath)) {
    const content = fs.readFileSync(dbPath, 'utf8');
    if (content.includes('maxPoolSize') && content.includes('production')) {
      console.log('   ✅ Database connection optimized for production');
      return true;
    } else {
      console.log('   ⚠️  Database configuration may need optimization');
      return true;
    }
  } else {
    console.log('   ❌ Database connection file missing');
    return false;
  }
}

// Run all checks
function runAllChecks() {
  const checks = [
    checkPackageJson,
    checkMemoryOptimization,
    checkRenderConfig,
    checkCompilation,
    checkEnvironmentFiles,
    checkDatabaseConfig
  ];
  
  let passedChecks = 0;
  const totalChecks = checks.length;
  
  for (const check of checks) {
    if (check()) {
      passedChecks++;
    }
  }
  
  console.log('\n===============================');
  console.log(`📊 Results: ${passedChecks}/${totalChecks} checks passed\n`);
  
  if (passedChecks === totalChecks) {
    console.log('🎉 All checks passed! Ready for deployment.\n');
    console.log('Next steps:');
    console.log('1. git add .');
    console.log('2. git commit -m "Fix memory issues with heap optimization and monitoring"');
    console.log('3. git push origin main');
    console.log('4. Deploy to Render');
    return true;
  } else {
    console.log('⚠️  Some checks failed. Please fix the issues before deploying.\n');
    return false;
  }
}

// Run the verification
if (require.main === module) {
  const success = runAllChecks();
  process.exit(success ? 0 : 1);
}

module.exports = { runAllChecks };
