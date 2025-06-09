# Immediate Fix Implementation Guide
*Priority: Critical - Implement within 24-48 hours*

## Fix 1: Google/Gemini Model Configuration

### Problem
Google LLM service fails with "Must provide a model name" error, causing AI response failures.

### Solution

#### Step 1: Add Environment Variable
Add to your `.env` file:
```bash
# Google/Gemini Configuration
GOOGLE_MODEL_NAME=gemini-1.5-flash
GOOGLE_API_KEY=your_existing_api_key_here
```

#### Step 2: Update Google LLM Service
**File:** `/server/src/services/llm/google.ts`

**Current Issue:** Service initialization without model name
**Fix:** Add explicit model configuration and validation

```typescript
// Add model name configuration
const modelName = process.env.GOOGLE_MODEL_NAME || 'gemini-1.5-flash';

// Add validation before initialization
if (!modelName) {
    throw new Error('Google model name is required but not configured');
}

// Update service initialization with model name
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: modelName });
```

#### Step 3: Add Configuration Validation
**File:** `/server/src/config/index.ts`

```typescript
// Add Google model validation
export function validateGoogleConfig() {
    const apiKey = process.env.GOOGLE_API_KEY;
    const modelName = process.env.GOOGLE_MODEL_NAME;
    
    if (!apiKey) {
        throw new Error('GOOGLE_API_KEY environment variable is required');
    }
    
    if (!modelName) {
        console.warn('GOOGLE_MODEL_NAME not set, using default: gemini-1.5-flash');
    }
    
    return { apiKey, modelName: modelName || 'gemini-1.5-flash' };
}
```

## Fix 2: Database Connection Sequencing

### Problem
Services initialize before database connection is ready, causing race conditions.

### Solution

#### Step 1: Add Database Readiness Check
**File:** `/server/src/database/connection.ts`

```typescript
import mongoose from 'mongoose';

export async function waitForDatabaseConnection(timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
        if (mongoose.connection.readyState === 1) {
            console.log('Database connection ready');
            return;
        }
        
        console.log('Waiting for database connection...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Database connection timeout');
}

export function isDatabaseConnected(): boolean {
    return mongoose.connection.readyState === 1;
}
```

#### Step 2: Update Service Initialization Order
**File:** `/server/src/index.ts`

```typescript
import { waitForDatabaseConnection } from './database/connection';
import { validateGoogleConfig } from './config';

async function startServer() {
    try {
        // Step 1: Connect to database
        await connectToDatabase();
        
        // Step 2: Wait for database readiness
        await waitForDatabaseConnection();
        
        // Step 3: Validate configurations
        validateGoogleConfig();
        
        // Step 4: Initialize services
        await initializeLLMServices();
        
        // Step 5: Start server
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
        
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}
```

## Fix 3: Enhanced Error Handling

### Problem
Poor error handling during service initialization leads to unclear failure reasons.

### Solution

#### Add Service Health Checks
**File:** `/server/src/health/checks.ts`

```typescript
export interface HealthCheck {
    service: string;
    status: 'healthy' | 'unhealthy';
    message?: string;
    timestamp: Date;
}

export async function checkLLMServices(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    
    // Check Google/Gemini
    try {
        const config = validateGoogleConfig();
        checks.push({
            service: 'google-llm',
            status: 'healthy',
            message: `Using model: ${config.modelName}`,
            timestamp: new Date()
        });
    } catch (error) {
        checks.push({
            service: 'google-llm',
            status: 'unhealthy',
            message: error.message,
            timestamp: new Date()
        });
    }
    
    // Check database
    checks.push({
        service: 'database',
        status: isDatabaseConnected() ? 'healthy' : 'unhealthy',
        message: `Connection state: ${mongoose.connection.readyState}`,
        timestamp: new Date()
    });
    
    return checks;
}
```

## Fix 4: Environment Configuration Template

### Create .env.example
**File:** `/server/.env.example`

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/lumina_outreach
DATABASE_NAME=lumina_outreach

# Google/Gemini AI Configuration
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_MODEL_NAME=gemini-1.5-flash

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Server Configuration
PORT=3000
NODE_ENV=development

# Webhook Configuration
WEBHOOK_URL=https://your-domain.com/webhook
```

## Deployment Steps

### 1. Backup Current Configuration
```bash
cp .env .env.backup
```

### 2. Update Environment Variables
```bash
# Add the new Google model configuration
echo "GOOGLE_MODEL_NAME=gemini-1.5-flash" >> .env
```

### 3. Restart Services
```bash
# Development
npm run dev

# Production
pm2 restart all
```

### 4. Verify Fix
```bash
# Check logs for successful initialization
tail -f server/error.log

# Verify health endpoint
curl http://localhost:3000/health
```

## Validation Checklist

- [ ] Google model name environment variable added
- [ ] Database connection sequencing implemented
- [ ] Service initialization order updated
- [ ] Error handling enhanced
- [ ] Health check endpoint working
- [ ] No more "Must provide a model name" errors
- [ ] Services start without multiple retry attempts
- [ ] All API keys properly validated at startup

## Expected Results

After implementing these fixes:
- ✅ Google/Gemini LLM service starts successfully
- ✅ No more initialization race conditions
- ✅ Clear error messages for configuration issues
- ✅ Faster startup time (< 10 seconds)
- ✅ Improved system reliability

## Rollback Plan

If issues occur after deployment:

1. **Restore previous configuration:**
   ```bash
   cp .env.backup .env
   ```

2. **Restart services:**
   ```bash
   pm2 restart all
   ```

3. **Check for critical errors:**
   ```bash
   tail -f server/error.log
   ```

## Monitoring After Fix

Monitor these metrics for 24-48 hours after deployment:
- Service startup time
- Initialization failure rate
- Google LLM response success rate
- Database connection stability
- Overall system error rate

---
*Implementation Time: 2-4 hours*
*Testing Time: 1-2 hours*
*Total Downtime: < 5 minutes*
