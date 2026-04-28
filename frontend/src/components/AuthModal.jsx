import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import styles from './AuthModal.module.css'

export default function AuthModal({ onClose }) {
  const { login, register } = useAuth()
  const [tab, setTab] = useState('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [regForm, setRegForm] = useState({ username: '', email: '', password: '' })

  function switchTab(t) { setTab(t); setError('') }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(loginForm.email, loginForm.password)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(regForm.username, regForm.email, regForm.password)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        <div className={styles.modalHeader}>
          <img src="/src/assets/company_logo.png" alt="Spear" className={styles.modalLogo} />
          <span className={styles.modalTitle}>Spear Rush</span>
        </div>
        <p className={styles.modalTagline}>Your account. Your bets.</p>

        <div className={styles.divider} />

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'login' ? styles.activeTab : ''}`}
            onClick={() => switchTab('login')}
          >Login</button>
          <button
            className={`${styles.tab} ${tab === 'register' ? styles.activeTab : ''}`}
            onClick={() => switchTab('register')}
          >Register</button>
        </div>

        {tab === 'login' ? (
          <form className={styles.form} onSubmit={handleLogin}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={loginForm.email}
              onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              required
              autoFocus
            />
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              value={loginForm.password}
              onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              required
            />
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <p className={styles.switchMode}>
              Don't have an account?
              <button className={styles.switchLink} type="button" onClick={() => switchTab('register')}>
                Create one
              </button>
            </p>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleRegister}>
            <label className={styles.label}>Username</label>
            <input
              className={styles.input}
              type="text"
              value={regForm.username}
              onChange={e => setRegForm(f => ({ ...f, username: e.target.value }))}
              placeholder="player123"
              minLength={3}
              maxLength={30}
              required
              autoFocus
            />
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={regForm.email}
              onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              required
            />
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              value={regForm.password}
              onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Min. 6 characters"
              minLength={6}
              required
            />
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
            <p className={styles.switchMode}>
              Already have an account?
              <button className={styles.switchLink} type="button" onClick={() => switchTab('login')}>
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
