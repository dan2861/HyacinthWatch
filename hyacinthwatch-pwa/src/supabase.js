// Supabase client wrapper for the PWA
import { createClient } from '@supabase/supabase-js'

const URL = process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

let supabase = null
if (URL && ANON) {
  try {
    supabase = createClient(URL, ANON)
  } catch (err) {
    console.warn('Failed to create Supabase client', err)
    supabase = null
  }
} else {
  console.warn('Supabase env not set: configure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY')
}

export async function getUser() {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    return data?.user || null
  } catch (err) {
    console.error('supabase.getUser failed', err)
    return null
  }
}

export async function getSession() {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data?.session || null
  } catch (err) {
    console.error('supabase.getSession failed', err)
    return null
  }
}

// Retained for existing callers; return the session and attempt a refresh if needed.
export async function ensureSupabaseSession(options = {}) {
  if (!supabase) return null
  const { refresh = true } = options
  let session = await getSession()
  if (session || !refresh) return session
  if (supabase?.auth?.refreshSession) {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error
      session = data?.session || null
    } catch (err) {
      console.warn('supabase.refreshSession failed', err)
    }
  }
  return session || null
}

// Return a usable access token string (if any) from the current session.
// Return a usable access token string (if any) from the current session.
export async function getAccessToken(options) {
  const session = await ensureSupabaseSession(options)
  return (
    session?.access_token ||
    session?.accessToken ||
    session?.provider_token ||
    null
  )
}

export function onAuthChange(cb) {
  if (!supabase) return () => { }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    try {
      cb?.(session?.user || null)
    } catch (err) {
      console.error('auth change handler failed', err)
    }
  })
  return () => data?.subscription?.unsubscribe?.()
}

export async function signInWithPassword(email, password) {
  if (!supabase) throw new Error('supabase client not initialized')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithPassword(email, password) {
  if (!supabase) throw new Error('supabase client not initialized')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  try {
    await supabase.auth.signOut()
  } catch (err) {
    console.warn('supabase.signOut failed', err)
  }
}

export default supabase

// DEV helper: expose the Supabase client on window for interactive debugging
// when running the app locally. This is intentionally guarded so it won't run
// in production builds.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  try {
    // expose under a non-obvious name to reduce accidental reliance
    // but still useful for debugging in the browser console.
    window.__hw_supabase = supabase
  } catch (e) {
    // ignore in environments where window isn't available
  }
}
