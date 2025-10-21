import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUpWithPassword } from '../supabase'

function SignupPage({ onAuthSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const { user, session } = await signUpWithPassword(email, password)
      const resolved = session?.user || user || null
      if (resolved) {
        onAuthSuccess?.(resolved)
        if (session?.access_token) {
          navigate('/')
        } else {
          setInfo('Check your email to confirm the account, then log in.')
        }
      } else {
        setInfo('Check your email to confirm the account, then log in.')
      }
    } catch (err) {
      setError(err?.message || 'Unable to sign up')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2>Create Account</h2>
      <form onSubmit={handleSubmit} className="form">
        <label className="form-label">
          Email
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="form-label">
          Password
          <input
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>
        <label className="form-label">
          Confirm Password
          <input
            type="password"
            placeholder="Repeat password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        {error && <p className="meta" style={{ color: '#b91c1c' }}>{error}</p>}
        {info && <p className="meta" style={{ color: '#2563eb' }}>{info}</p>}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign Up'}
        </button>
      </form>
      <p className="meta" style={{ marginTop: 12 }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  )
}

export default SignupPage
