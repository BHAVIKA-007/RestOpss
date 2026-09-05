import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginRequest, registerRequest } from '../api'
import { useAuth } from '../context/AuthContext'
import styles from './Register.module.css'

function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
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
      await registerRequest(form)
      const response = await loginRequest({ email: form.email, password: form.password })
      await login(response.token)
      navigate('/discovery', { replace: true })
    } catch (requestError) {
      setError(requestError.message || 'Unable to create your account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link to="/" className={styles.logo}>Rest<span>Ops</span></Link>
        <p className={styles.eyebrow}>Start your next chapter</p>
        <h1>Save your seat.</h1>
        <p className={styles.intro}>Create a RestOps account and make every reservation feel effortless.</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="register-name">Name</label>
          <input id="register-name" name="name" type="text" value={form.name} onChange={handleChange} required autoComplete="name" />
          <label htmlFor="register-email">Email</label>
          <input id="register-email" name="email" type="email" value={form.email} onChange={handleChange} required autoComplete="email" />
          <label htmlFor="register-password">Password</label>
          <input id="register-password" name="password" type="password" minLength="6" value={form.password} onChange={handleChange} required autoComplete="new-password" />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className={styles.switchPrompt}>Already have an account? <Link to="/login">Log in</Link></p>
      </section>
    </main>
  )
}

export default Register
