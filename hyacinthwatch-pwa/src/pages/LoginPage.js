import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithPassword } from '../supabase'

function LoginPage({ onAuthSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { user, session } = await signInWithPassword(email, password)
      const resolved = user || session?.user || null
      if (resolved) onAuthSuccess?.(resolved)
      navigate('/')
    } catch (err) {
      setError(err?.message || 'Unable to sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2>Log In</h2>
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
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="meta" style={{ color: '#b91c1c' }}>{error}</p>}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p className="meta" style={{ marginTop: 12 }}>
        Need an account? <Link to="/signup">Sign up</Link>
      </p>
    </main>
  )
}

export default LoginPage
