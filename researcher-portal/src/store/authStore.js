import { create } from 'zustand';
import { isAuthenticated as checkAuth } from '../api/auth';
import { signOut as supabaseSignOut } from '../utils/supabase';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: checkAuth(),
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  checkAuth: () => set({ isAuthenticated: checkAuth() }),
  logout: async () => {
    try {
      // Sign out from Supabase if available
      await supabaseSignOut();
    } catch (err) {
      // Ignore errors if Supabase is not configured
      console.warn('Supabase sign out failed:', err);
    }
    
    // Clear all auth tokens
    localStorage.removeItem('auth_token');
    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb_access_token');
    
    // Clear user state
    set({ user: null, isAuthenticated: false });
    
    // Redirect to login
    window.location.href = '/login';
  },
}));

