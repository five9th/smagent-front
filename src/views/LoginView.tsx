import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { InlineError, Spinner } from '../components/ui'

export default function LoginView() {
  const { user, ready, login } = useAuth()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  if (ready && user) return <Navigate to="/" replace />
  if (!ready) return null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
      nav('/', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-brand">
          <div className="mark">SM</div>
          <div>
            <b>SMAgent</b>
            <span>Social Agent</span>
          </div>
        </div>
        <p className="login-sub">Sign in with your owner account.</p>
        <form onSubmit={onSubmit}>
          <label className="field">
            <span className="lab">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>
          <label className="field">
            <span className="lab">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error != null && (
            <div style={{ margin: '4px 0 10px' }}>
              <InlineError error={error} title="Sign-in failed" />
            </div>
          )}
          <button
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
            disabled={busy}
          >
            {busy ? <Spinner /> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
