import axios from 'axios';
import { config } from '../config';

let cancelTokenSources = new Map();

export const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    // Try multiple token sources: Supabase token from localStorage, or auth_token
    let token = localStorage.getItem('sb_token') || localStorage.getItem('auth_token');
    
    // If no token and Supabase is configured, try to get a fresh token
    if (!token && typeof window !== 'undefined') {
      try {
        const { getAccessToken } = await import('../utils/supabase');
        token = await getAccessToken({ refresh: false });
        if (token) {
          // Store the token for future use
          localStorage.setItem('sb_token', token);
          localStorage.setItem('auth_token', token);
        }
      } catch (e) {
        // Ignore errors - token might not be available
      }
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle 401 (unauthorized) - token expired or invalid
    if (error.response?.status === 401) {
      // Try to refresh token if we have Supabase configured
      try {
        const { getAccessToken } = await import('../utils/supabase');
        const newToken = await getAccessToken({ refresh: true });
        if (newToken) {
          // Retry the request with new token
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return apiClient.request(error.config);
        }
      } catch (e) {
        // If refresh fails, redirect to login
      }
      // Clear tokens and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('sb_token');
      window.location.href = '/login';
    }
    // Handle 403 (forbidden) - might be role issue or token problem
    if (error.response?.status === 403) {
      // Try refreshing token once
      try {
        const { getAccessToken } = await import('../utils/supabase');
        const newToken = await getAccessToken({ refresh: true });
        if (newToken) {
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return apiClient.request(error.config);
        }
      } catch (e) {
        // If refresh fails, show error
      }
    }
    return Promise.reject(error);
  }
);

// Helper to cancel previous requests
export function cancelRequest(key) {
  const source = cancelTokenSources.get(key);
  if (source) {
    source.cancel('Request cancelled');
    cancelTokenSources.delete(key);
  }
}

export function getCancelToken(key) {
  cancelRequest(key);
  const source = axios.CancelToken.source();
  cancelTokenSources.set(key, source);
  return source.token;
}

