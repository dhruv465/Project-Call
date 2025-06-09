# Memory Optimization & Deployment Guide

## 🚨 Memory Issue Solutions Implemented

### 1. Node.js Memory Configuration
- **Heap Size Limit**: Reduced from 2048MB to 1536MB for Render's starter plan
- **Garbage Collection**: Enabled with `--expose-gc` flag for manual GC control
- **Optimization**: Added `--optimize-for-size` flag for memory efficiency

### 2. Package.json Updates
```json
{
  "scripts": {
    "start": "node --max-old-space-size=1536 --optimize-for-size --expose-gc dist/index.js",
    "start:prod": "NODE_ENV=production node --max-old-space-size=1536 --optimize-for-size --expose-gc dist/index.js"
  }
}
```

### 3. Render.yaml Configuration
```yaml
services:
  - type: web
    name: project-call-server
    env: node
    plan: starter
    buildCommand: cd server && npm ci --only=production && npm run build
    startCommand: cd server && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: NODE_OPTIONS
        value: "--max-old-space-size=1536 --optimize-for-size --expose-gc"
      - key: PORT
        value: 8000
      - key: HOST
        value: "0.0.0.0"
      - key: LOG_LEVEL
        value: warn
```

### 4. Memory Monitoring System
- **File**: `src/utils/memoryOptimization.ts`
- **Features**:
  - Automatic garbage collection every 30 seconds
  - Memory usage monitoring with warnings
  - Graceful shutdown handlers
  - Process error handling

### 5. Database Optimization
- Reduced MongoDB connection pool size in production (5 max, 1 min)
- Added connection timeout and idle time limits
- Optimized heartbeat frequency

### 6. Logging Optimization
- Reduced log level to 'warn' in production
- Smaller log file sizes (5MB max)
- Fewer log files kept (3 max)

## 🚀 Deployment Steps

### Step 1: Commit Changes
```bash
git add .
git commit -m "Fix memory issues: optimize heap size, add GC monitoring, reduce resource usage"
git push origin main
```

### Step 2: Update Render Configuration
1. Go to your Render dashboard
2. Update environment variables in your web service:
   - `NODE_OPTIONS`: `--max-old-space-size=1536 --optimize-for-size --expose-gc`
   - `LOG_LEVEL`: `warn`
   - `HOST`: `0.0.0.0`
   - `PORT`: `8000`

### Step 3: Monitor Deployment
- Check Render logs for memory warnings
- Monitor heap usage in the application logs
- Verify health check endpoint responds: `/health`

## 📊 Memory Monitoring

### Real-time Monitoring
The application now logs memory usage every minute and warns when usage exceeds 1.5GB:
```
📊 Memory usage: 890MB heap / 1200MB RSS
⚠️  High memory usage detected: 1600MB heap used / 1800MB heap total / 2000MB RSS
```

### Manual Analysis
Run the memory analysis script:
```bash
npm run memory:analyze
```

### Production Monitoring
Use the metrics endpoint to check memory usage:
```
GET /metrics
```
Response includes:
```json
{
  "memory": {
    "heapUsed": 123456789,
    "heapTotal": 234567890,
    "rss": 345678901
  }
}
```

## 🔧 Additional Optimizations

### If Memory Issues Persist:

1. **Upgrade Render Plan**:
   - Move from Starter ($7/month, 512MB RAM) to Standard ($25/month, 2GB RAM)

2. **Code-Level Optimizations**:
   - Lazy load heavy dependencies (TensorFlow, AI models)
   - Implement connection pooling for external APIs
   - Use streaming for large data processing

3. **Database Optimizations**:
   - Add database indexes for frequently queried fields
   - Implement result pagination for large datasets
   - Use MongoDB aggregation pipelines efficiently

4. **Caching Strategy**:
   - Implement Redis for session storage
   - Cache frequently accessed data
   - Use HTTP response compression

## 🚨 Emergency Fixes

If deployment still fails with memory issues:

1. **Immediate Fix** - Further reduce heap size:
   ```bash
   # In render.yaml or environment variables
   NODE_OPTIONS: "--max-old-space-size=1024 --optimize-for-size --expose-gc"
   ```

2. **Temporary Workaround** - Disable heavy features:
   ```bash
   # Add to environment variables
   DISABLE_TENSORFLOW: true
   DISABLE_SPEECH_SYNTHESIS: true
   ```

3. **Quick Recovery** - Rollback to previous working version:
   ```bash
   git revert HEAD
   git push origin main
   ```

## 📈 Performance Improvements

### Expected Results:
- **Memory Usage**: Reduced by 20-30%
- **Startup Time**: Faster due to optimized dependencies
- **Stability**: Better garbage collection prevents memory leaks
- **Monitoring**: Real-time visibility into memory usage

### Success Metrics:
- Application starts successfully on Render
- Memory usage stays below 1.2GB during normal operation
- No "JavaScript heap out of memory" errors
- Health check endpoint responds within 3 seconds

## 🔍 Troubleshooting

### Common Issues:

1. **Still getting memory errors**:
   - Check if all environment variables are set correctly
   - Verify the correct Node.js flags are being used
   - Review application logs for memory warnings

2. **Application not starting**:
   - Check the build logs for TypeScript compilation errors
   - Verify all dependencies are installed correctly
   - Check the health check endpoint configuration

3. **Performance degradation**:
   - Monitor the metrics endpoint for resource usage
   - Check database connection pool efficiency
   - Review log files for error patterns

### Debug Commands:
```bash
# Check memory usage locally
npm run memory:analyze

# Start with memory monitoring
npm run memory:monitor

# View detailed logs
tail -f logs/combined.log

# Check application health
curl http://localhost:8000/health
```

This comprehensive solution should resolve the memory issues and provide better monitoring for future deployments! 🎉
