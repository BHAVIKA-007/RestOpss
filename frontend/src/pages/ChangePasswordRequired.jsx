import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '../api'
import { useAuth } from '../context/AuthContext'
import styles from './Account.module.css'

const roleRoutes = {
  customer: '/discovery',
  owner: '/owner',
  manager: '/manager',
  waiter: '/waiter',
  chef: '/chef',
  cashier: '/cashier',
  host: '/host',
}

function ChangePasswordRequired() {
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleChange(event) {
    setPasswords((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    if (passwords.next !== passwords.confirm) {
      setMessage('New passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await changePassword(passwords.current, passwords.next)
      const updatedUser = await refreshUser()
      navigate(roleRoutes[updatedUser.role] || '/discovery', { replace: true })
    } catch (requestError) {
      setMessage(requestError.message || 'Unable to change your password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <p className={styles.eyebrow}>First sign-in</p>
        <h1>Change your password.</h1>
        <section className={styles.card}>
          <h2>A new password is required before you continue.</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="required-current-password">Temporary password</label>
            <input id="required-current-password" name="current" type="password" value={passwords.current} onChange={handleChange} required autoComplete="current-password" />
            <label htmlFor="required-new-password">New password</label>
            <input id="required-new-password" name="next" type="password" minLength="6" value={passwords.next} onChange={handleChange} required autoComplete="new-password" />
            <label htmlFor="required-confirm-password">Confirm new password</label>
            <input id="required-confirm-password" name="confirm" type="password" minLength="6" value={passwords.confirm} onChange={handleChange} required autoComplete="new-password" />
            {message && <p className={styles.message} role="alert">{message}</p>}
            <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>{isSubmitting ? 'Updating password...' : 'Continue'}</button>
          </form>
        </section>
      </section>
    </main>
  )
}

export default ChangePasswordRequired