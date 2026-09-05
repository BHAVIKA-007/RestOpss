import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginRequest } from '../api'
import { useAuth } from '../context/AuthContext'
import styles from './Login.module.css'

const roleRoutes = {
  customer: '/discovery',
  owner: '/owner',
  manager: '/manager',
  waiter: '/waiter',
  chef: '/chef',
  cashier: '/cashier',
  host: '/host',
}

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await loginRequest(form)
      const currentUser = await login(response.token)
      const destination = roleRoutes[currentUser.role] || '/discovery'
      const requestedPath = location.state?.from?.pathname
      navigate(requestedPath && requestedPath !== '/login' ? requestedPath : destination, { replace: true })
    } catch (requestError) {
      setError(requestError.message || 'Unable to log in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link to="/" className={styles.logo}>Rest<span>Ops</span></Link>
        <p className={styles.eyebrow}>Welcome back</p>
        <h1>Good to see you.</h1>
        <p className={styles.intro}>Log in to pick up where your next great meal begins.</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" name="email" type="email" value={form.email} onChange={handleChange} required autoComplete="email" />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" name="password" type="password" value={form.password} onChange={handleChange} required autoComplete="current-password" />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>
        <p className={styles.switchPrompt}>Don't have an account? <Link to="/register">Register</Link></p>
      </section>
    </main>
  )
}

export default Login
