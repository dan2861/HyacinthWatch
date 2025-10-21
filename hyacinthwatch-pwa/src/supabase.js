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

// Retained for existing callers; simply returns the current session.
export async function ensureSupabaseSession() {
  return getSession()
}

export function onAuthChange(cb) {
  if (!supabase) return () => {}
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
