// Utility to get Supabase access tokens for the researcher portal
// This is similar to how the PWA handles Supabase auth

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

let supabase = null;

// Initialize Supabase client if configured
if (config.supabaseUrl && config.supabaseAnonKey) {
  try {
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  } catch (err) {
    console.warn('Failed to create Supabase client:', err);
  }
}

/**
 * Get the current Supabase session
 */
export async function getSession() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  } catch (err) {
    console.error('getSession failed:', err);
    return null;
  }
}

/**
 * Get a fresh access token, refreshing if needed
 */
export async function getAccessToken(options = {}) {
  if (!supabase) return null;
  const { refresh = true } = options;
  
  try {
    let session = await getSession();
    
    // Try to refresh if session is missing or expired
    if (refresh && (!session || (session.expires_at && session.expires_at < Date.now() / 1000))) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      session = data?.session || null;
    }
    
    return session?.access_token || null;
  } catch (err) {
    console.error('getAccessToken failed:', err);
    return null;
  }
}

/**
 * Update localStorage with current Supabase token
 */
export async function refreshStoredToken() {
  const token = await getAccessToken({ refresh: true });
  if (token) {
    localStorage.setItem('sb_token', token);
    localStorage.setItem('auth_token', token);
    return token;
  }
  return null;
}

/**
 * Sign in with email and password
 */
export async function signInWithPassword(email, password) {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Please configure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
  }
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  
  // Store the token automatically
  if (data?.session?.access_token) {
    localStorage.setItem('sb_token', data.session.access_token);
    localStorage.setItem('auth_token', data.session.access_token);
  }
  
  return {
    user: data?.user,
    session: data?.session,
    access_token: data?.session?.access_token,
  };
}

/**
 * Sign up with email and password
 */
export async function signUpWithPassword(email, password) {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Please configure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
  }
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  
  // Store the token automatically if session is returned (some providers require email confirmation)
  if (data?.session?.access_token) {
    localStorage.setItem('sb_token', data.session.access_token);
    localStorage.setItem('auth_token', data.session.access_token);
  }
  
  return {
    user: data?.user,
    session: data?.session,
    access_token: data?.session?.access_token,
  };
}

/**
 * Sign out
 */
export async function signOut() {
  if (!supabase) return;
  
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  
  // Clear stored tokens
  localStorage.removeItem('sb_token');
  localStorage.removeItem('auth_token');
}

