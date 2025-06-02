import axios from 'axios';

// For debugging configuration saves
const logAPIOperation = (operation: string, url: string, data?: any) => {
  console.log(`API ${operation} - ${url}`, data || '');
};

// Determine base URL - this ensures proxy works correctly in dev mode
const apiBaseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Adding longer timeout for voice synthesis requests
  timeout: 30000 // 30 seconds
});

// Log API configuration
console.log('API configured with baseURL:', apiBaseURL);
console.log('Running in environment:', import.meta.env.MODE);

// Add custom type to window for production error reporting
declare global {
  interface Window {
    reportAPIError?: (errorData: {
      url?: string;
      method?: string;
      status?: number;
      message: string;
      code?: string;
    }) => void;
  }
}

// Intercept requests
api.interceptors.request.use(
  (config) => {
    // Add authorization header if user is logged in
    const user = localStorage.getItem('user');
    if (user) {
      const { token } = JSON.parse(user);
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log the request for debugging
    logAPIOperation('Request', config.url || '', config.data);
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercept responses
api.interceptors.response.use(
  (response) => {
    // Log successful response for debugging
    logAPIOperation('Response', response.config.url || '', response.data);
    return response;
  },
  (error) => {
    // Production error handling - log error and pass it through
    console.error('API Error:', error.message, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      code: error.code
    });
    
    // For 404 Not Found errors related to data endpoints, return empty data
    if (error.response?.status === 404 && 
        (error.config?.url?.includes('/campaigns') || 
         error.config?.url?.includes('/leads') || 
         error.config?.url?.includes('/analytics') ||
         error.config?.url?.includes('/calls/analytics'))) {
      
      // Handle different endpoint formats
      if (error.config?.url?.includes('/campaigns')) {
        return Promise.resolve({ 
          data: { campaigns: [], pagination: { page: 1, pages: 0, total: 0, limit: 10 } }
        });
      } else if (error.config?.url?.includes('/calls/analytics')) {
        return Promise.resolve({
          data: {
            summary: {
              totalCalls: 0,
              completedCalls: 0,
              failedCalls: 0,
              averageDuration: 0,
              totalDuration: 0,
              successRate: 0,
              conversionRate: 0,
              negativeRate: 0,
              outcomes: {}
            },
            callsByDay: []
          }
        });
      } else {
        return Promise.resolve({ data: [] });
      }
    }
    
    // For monitoring/tracking in production
    if (typeof window.reportAPIError === 'function') {
      window.reportAPIError({
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        message: error.message,
        code: error.code
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
