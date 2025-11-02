import { apiClient } from './client';

export async function login(credentials) {
  // For now, we'll use Supabase auth - adjust based on your backend
  const response = await apiClient.post('/v1/auth/login', credentials);
  return response.data;
}

export async function getCurrentUser() {
  const response = await apiClient.get('/v1/auth/me');
  return response.data;
}

export function logout() {
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
}

export function isAuthenticated() {
  return !!localStorage.getItem('auth_token');
}

