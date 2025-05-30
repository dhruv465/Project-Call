import axios from 'axios';

// Development environment flag
const isDevelopment = process.env.NODE_ENV === 'development' || import.meta.env.DEV;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept requests
api.interceptors.request.use(
  (config) => {
    // Add authorization header if user is logged in
    const user = localStorage.getItem('user');
    if (user) {
      const { token } = JSON.parse(user);
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercept responses
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // In development mode, return mock data if server is unreachable
    if (isDevelopment && (!error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED')) {
      console.warn('API Error in development mode:', error.message);
      console.info('Returning mock data for development');
      
      // Create a mock response based on the requested URL
      const url = error.config.url;
      let mockData = {};
      
      if (url.includes('/configuration')) {
        mockData = {
          aiSettings: {
            defaultModel: 'gpt-4o',
            temperature: 0.7,
            maxTokens: 500,
            systemPrompt: 'You are an AI assistant making cold calls. Be professional, friendly and to the point.'
          },
          voiceSettings: {
            provider: 'elevenlabs',
            defaultVoice: 'bella',
            speed: 1,
            pitch: 1
          },
          callSettings: {
            maxRetries: 2,
            minTimeBetweenCalls: 60,
            recordCalls: true,
            defaultTimeZone: 'Asia/Kolkata'
          }
        };
      } else if (url.includes('/calls')) {
        mockData = {
          calls: Array(5).fill(0).map((_, i) => ({
            id: `mock-call-${i}`,
            leadName: `Mock Lead ${i}`,
            leadPhone: `+1-555-${String(i).padStart(4, '0')}`,
            campaignName: 'Development Campaign',
            status: ['completed', 'failed', 'in-progress', 'scheduled'][i % 4],
            duration: 120 + i * 30,
            callDate: new Date(),
            outcome: ['answered', 'voicemail', 'no-answer', 'interested'][i % 4]
          })),
          pagination: {
            page: 1,
            limit: 10,
            total: 5,
            pages: 1
          }
        };
      } else if (url.includes('/leads')) {
        mockData = {
          leads: Array(5).fill(0).map((_, i) => ({
            id: `mock-lead-${i}`,
            name: `Mock Lead ${i}`,
            phoneNumber: `+1-555-${String(i).padStart(4, '0')}`,
            email: `lead${i}@example.com`,
            status: ['New', 'Contacted', 'Qualified', 'Converted'][i % 4]
          })),
          pagination: {
            page: 1,
            limit: 10,
            total: 5,
            pages: 1
          }
        };
      } else if (url.includes('/campaigns')) {
        mockData = {
          campaigns: Array(3).fill(0).map((_, i) => ({
            _id: `mock-campaign-${i}`,
            name: `Mock Campaign ${i}`,
            description: `This is a mock campaign for development`,
            goal: `Increase sales for product ${i}`,
            targetAudience: 'Small businesses in tech industry',
            status: ['Active', 'Paused', 'Draft'][i % 3],
            leadSources: ['Website', 'LinkedIn', 'Partner Referral'],
            primaryLanguage: 'English',
            supportedLanguages: ['English', 'Hindi'],
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            script: {
              versions: [{
                name: 'Default Script',
                content: 'Hello, this is a test script for the mock campaign.',
                isActive: true
              }]
            },
            callTiming: {
              daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
              startTime: '09:00',
              endTime: '17:00',
              timeZone: 'Asia/Kolkata'
            },
            llmConfiguration: {
              model: 'gpt-4o',
              systemPrompt: 'You are an AI assistant making calls.',
              temperature: 0.7,
              maxTokens: 500
            },
            voiceConfiguration: {
              provider: 'elevenlabs',
              voiceId: 'bella',
              speed: 1.0,
              pitch: 1.0
            },
            metrics: {
              totalCalls: 10 * (i + 1),
              connectedCalls: 8 * (i + 1),
              successfulCalls: 4 * (i + 1),
              avgCallDuration: 120 + (i * 30),
              conversionRate: 0.2 + (i * 0.1)
            },
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date().toISOString()
          })),
          pagination: {
            page: 1,
            limit: 10,
            total: 3,
            pages: 1
          }
        };
      } else if (url.includes('/dashboard')) {
        mockData = {
          summary: {
            totalCalls: 125,
            completedCalls: 98,
            successRate: 0.45,
            avgDuration: 183,
            activeLeads: 320,
            activeCampaigns: 5
          },
          recentCalls: Array(5).fill(0).map((_, i) => ({
            _id: `mock-call-${i}`,
            leadName: `Lead ${i}`,
            campaignName: `Campaign ${i % 3}`,
            timestamp: new Date(Date.now() - i * 3600 * 1000).toISOString(),
            duration: 120 + (i * 30),
            outcome: ['Interested', 'Call Back', 'Not Interested', 'Wrong Number', 'Voicemail'][i % 5]
          })),
          campaignPerformance: Array(3).fill(0).map((_, i) => ({
            _id: `mock-campaign-${i}`,
            name: `Campaign ${i}`,
            callCount: 30 + (i * 15),
            successRate: 0.3 + (i * 0.15),
            avgDuration: 150 + (i * 20)
          }))
        };
      }
      
      return Promise.resolve({
        data: mockData,
        status: 200,
        statusText: 'OK (Mocked)',
        headers: {},
        config: error.config
      });
    }
    
    // Handle unauthorized errors (401)
    if (error.response && error.response.status === 401) {
      // Remove user from local storage
      localStorage.removeItem('user');
      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
