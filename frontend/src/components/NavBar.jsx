import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './NavBar.module.css'

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <header className={styles.navbar}>
      <Link to="/" className={styles.logo} aria-label="RestOps home">
        Rest<span>Ops</span>
      </Link>
      <nav className={styles.actions} aria-label="Account navigation">
        <span className={styles.greeting}>{user?.name || 'Welcome'}</span>
        <Link to="/account" className={styles.accountLink}>Account</Link>
        <button type="button" className={styles.logoutButton} onClick={handleLogout}>Log out</button>
      </nav>
    </header>
  )
}

export default NavBar
