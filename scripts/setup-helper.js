#!/usr/bin/env node

/**
 * Production Setup and Testing Script
 * Use this script to quickly set up and test your production deployment
 */

const https = require('https');
const http = require('http');

class ProductionSetupHelper {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.apiVersion = '/api';
    }

    async makeRequest(method, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl + this.apiVersion + endpoint);
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer dev-token', // Development token for testing
                },
            };

            const req = (url.protocol === 'https:' ? https : http).request(url, options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const response = body ? JSON.parse(body) : {};
                        resolve({ status: res.statusCode, data: response });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: body });
                    }
                });
            });

            req.on('error', reject);
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    async checkHealth() {
        console.log('🏥 Checking system health...');
        try {
            const response = await this.makeRequest('GET', '/../health');
            if (response.status === 200) {
                console.log('✅ System is healthy');
                return true;
            } else {
                console.log('❌ System health check failed:', response.status);
                return false;
            }
        } catch (error) {
            console.log('❌ Cannot connect to server:', error.message);
            return false;
        }
    }

    async getCurrentConfiguration() {
        console.log('📋 Retrieving current configuration...');
        try {
            const response = await this.makeRequest('GET', '/configuration');
            if (response.status === 200) {
                console.log('✅ Configuration retrieved successfully');
                console.log('📊 Active providers:', Object.keys(response.data.providers || {}));
                return response.data;
            } else {
                console.log('❌ Failed to retrieve configuration:', response.status);
                return null;
            }
        } catch (error) {
            console.log('❌ Error retrieving configuration:', error.message);
            return null;
        }
    }

    async setupInitialConfiguration(config) {
        console.log('🔧 Setting up initial configuration...');
        try {
            const response = await this.makeRequest('PUT', '/configuration', config);
            if (response.status === 200 || response.status === 201) {
                console.log('✅ Configuration set up successfully');
                return true;
            } else {
                console.log('❌ Failed to set up configuration:', response.status, response.data);
                return false;
            }
        } catch (error) {
            console.log('❌ Error setting up configuration:', error.message);
            return false;
        }
    }

    async testApiKey(provider, apiKey) {
        console.log(`🧪 Testing ${provider} API key...`);
        try {
            let endpoint;
            let testData;

            switch (provider) {
                case 'openai':
                case 'anthropic':
                    endpoint = '/configuration/test-llm';
                    testData = { provider, apiKey };
                    break;
                case 'elevenlabs':
                    endpoint = '/configuration/test-elevenlabs';
                    testData = { apiKey };
                    break;
                case 'twilio':
                    endpoint = '/configuration/test-twilio';
                    testData = { accountSid: apiKey.split(':')[0], authToken: apiKey.split(':')[1] };
                    break;
                default:
                    console.log(`❌ Unknown provider: ${provider}`);
                    return false;
            }

            const response = await this.makeRequest('POST', endpoint, testData);
            if (response.status === 200) {
                console.log(`✅ ${provider} API key is valid`);
                return true;
            } else {
                console.log(`❌ ${provider} API key test failed:`, response.data);
                return false;
            }
        } catch (error) {
            console.log(`❌ Error testing ${provider} API key:`, error.message);
            return false;
        }
    }

    async runFullDiagnostic() {
        console.log('🔍 Running full system diagnostic...\n');

        // Health check
        const healthOk = await this.checkHealth();
        console.log('');

        // Configuration check
        const config = await this.getCurrentConfiguration();
        console.log('');

        // Test available endpoints
        console.log('🌐 Testing API endpoints...');
        const endpoints = [
            '/configuration',
            '/configuration/llm-options',
            '/configuration/voice-options'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest('GET', endpoint);
                if (response.status === 200) {
                    console.log(`✅ ${endpoint} - OK`);
                } else {
                    console.log(`❌ ${endpoint} - Status: ${response.status}`);
                }
            } catch (error) {
                console.log(`❌ ${endpoint} - Error: ${error.message}`);
            }
        }

        console.log('\n📊 Diagnostic Summary:');
        console.log(`Health Check: ${healthOk ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Configuration: ${config ? '✅ LOADED' : '❌ MISSING'}`);

        return healthOk && config;
    }

    displaySampleConfiguration() {
        console.log('\n📝 Sample Configuration:');
        console.log(`
{
  "providers": {
    "openai": {
      "apiKey": "sk-your-openai-key-here",
      "model": "gpt-4",
      "isEnabled": true
    },
    "anthropic": {
      "apiKey": "sk-ant-your-anthropic-key-here",
      "model": "claude-3-sonnet-20240229",
      "isEnabled": true
    },
    "elevenLabs": {
      "apiKey": "your-elevenlabs-key-here",
      "voiceId": "21m00Tcm4TlvDq8ikWAM",
      "isEnabled": true
    },
    "googleSpeech": {
      "apiKey": "your-google-speech-key-here",
      "isEnabled": true
    },
    "twilio": {
      "accountSid": "your-twilio-account-sid",
      "authToken": "your-twilio-auth-token",
      "isEnabled": true
    }
  },
  "voicePersonality": {
    "tone": "professional",
    "emotionLevel": 0.7,
    "responseSpeed": "medium"
  },
  "compliance": {
    "respectDND": true,
    "maxCallDuration": 1800,
    "dataRetentionDays": 30
  },
  "workingHours": {
    "start": "09:00",
    "end": "17:00",
    "timezone": "America/New_York"
  }
}
        `);
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const baseUrl = args[1] || 'http://localhost:3000';

    const helper = new ProductionSetupHelper(baseUrl);

    switch (command) {
        case 'health':
            await helper.checkHealth();
            break;

        case 'config':
            await helper.getCurrentConfiguration();
            break;

        case 'diagnostic':
        case 'test':
            await helper.runFullDiagnostic();
            break;

        case 'sample':
            helper.displaySampleConfiguration();
            break;

        case 'setup':
            console.log('🚀 Interactive Configuration Setup');
            console.log('Please prepare your API keys and run:');
            console.log('curl -X PUT http://localhost:3000/api/configuration -H "Content-Type: application/json" -d \'{ ... }\'');
            helper.displaySampleConfiguration();
            break;

        default:
            console.log('🛠️  Production Setup Helper');
            console.log('');
            console.log('Usage: node setup-helper.js <command> [base-url]');
            console.log('');
            console.log('Commands:');
            console.log('  health      - Check system health');
            console.log('  config      - Show current configuration');
            console.log('  diagnostic  - Run full system diagnostic');
            console.log('  sample      - Show sample configuration');
            console.log('  setup       - Show setup instructions');
            console.log('');
            console.log('Examples:');
            console.log('  node setup-helper.js health');
            console.log('  node setup-helper.js diagnostic https://your-domain.com');
            console.log('  node setup-helper.js config http://localhost:3000');
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ProductionSetupHelper;
