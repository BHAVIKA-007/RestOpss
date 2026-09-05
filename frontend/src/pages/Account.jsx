import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { useAuth } from '../context/AuthContext'
import styles from './Account.module.css'

function Account() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' })
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [profileMessage, setProfileMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  function handleProfileChange(event) {
    setProfile((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function handlePasswordChange(event) {
    setPasswords((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function saveProfile(event) {
    event.preventDefault()
    setProfileMessage('Profile updates are not connected yet, but your changes are ready to send.')
    console.log('update endpoint not yet available', profile)
  }

  function changePassword(event) {
    event.preventDefault()
    if (passwords.next !== passwords.confirm) {
      setPasswordMessage('New passwords do not match.')
      return
    }
    setPasswordMessage('Password changes are not connected yet. Your account remains unchanged.')
    console.log('change-password endpoint not yet available')
  }

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <p className={styles.eyebrow}>Your account</p>
        <h1>Settings</h1>
        <section className={styles.card}>
          <h2>Personal details</h2>
          <form onSubmit={saveProfile} className={styles.form}>
            <label htmlFor="account-name">Name</label>
            <input id="account-name" name="name" value={profile.name} onChange={handleProfileChange} required />
            <label htmlFor="account-email">Email</label>
            <input id="account-email" name="email" type="email" value={profile.email} onChange={handleProfileChange} required />
            {profileMessage && <p className={styles.message}>{profileMessage}</p>}
            <button type="submit" className={styles.primaryButton}>Save details</button>
          </form>
        </section>
        <section className={styles.card}>
          <h2>Change password</h2>
          <form onSubmit={changePassword} className={styles.form}>
            <label htmlFor="current-password">Current password</label>
            <input id="current-password" name="current" type="password" value={passwords.current} onChange={handlePasswordChange} required />
            <label htmlFor="new-password">New password</label>
            <input id="new-password" name="next" type="password" minLength="6" value={passwords.next} onChange={handlePasswordChange} required />
            <label htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" name="confirm" type="password" value={passwords.confirm} onChange={handlePasswordChange} required />
            {passwordMessage && <p className={styles.message}>{passwordMessage}</p>}
            <button type="submit" className={styles.primaryButton}>Update password</button>
          </form>
        </section>
        <button type="button" className={styles.logoutButton} onClick={handleLogout}>Log out</button>
      </main>
    </div>
  )
}

export default Account
