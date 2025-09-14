import axios from 'axios';
import { Observation, QualityControlScore, User, ObservationStats } from './types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export const observationAPI = {
  // Get all observations
  getObservations: (params?: {
    status?: string;
    location?: string;
    page?: number;
  }) => api.get<{results: Observation[], count: number}>('/observations/', { params }),

  // Get single observation
  getObservation: (id: number) => api.get<Observation>(`/observations/${id}/`),

  // Create observation
  createObservation: (data: FormData) => api.post<Observation>('/observations/', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  // Update observation
  updateObservation: (id: number, data: Partial<Observation>) => 
    api.patch<Observation>(`/observations/${id}/`, data),

  // Delete observation
  deleteObservation: (id: number) => api.delete(`/observations/${id}/`),

  // Trigger processing
  triggerProcessing: (id: number) => api.post(`/observations/${id}/process/`),
};

export const qcAPI = {
  // Get QC scores
  getQCScores: () => api.get<QualityControlScore[]>('/qc-scores/'),

  // Create QC score
  createQCScore: (data: Partial<QualityControlScore>) => 
    api.post<QualityControlScore>('/qc-scores/', data),
};

export const userAPI = {
  // Get user profile
  getProfile: () => api.get<User>('/profile/'),

  // Update user profile
  updateProfile: (data: Partial<User>) => api.patch<User>('/profile/', data),
};

export const statsAPI = {
  // Get observation statistics
  getStats: () => api.get<ObservationStats>('/stats/'),
};

export default api;