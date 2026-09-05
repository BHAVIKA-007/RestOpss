import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { useAuth } from '../context/AuthContext'
import styles from './Dashboard.module.css'

function Dashboard({ role }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <p className={styles.eyebrow}>RestOps workspace</p>
        <h1>{roleLabel} Dashboard</h1>
        <p>This is your {role} workspace. More tools are coming soon.</p>
        <button type="button" className={styles.logoutButton} onClick={handleLogout}>Log out</button>
      </main>
    </div>
  )
}

export default Dashboard
