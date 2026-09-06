import { NavLink, Outlet } from 'react-router-dom'
import NavBar from './NavBar'
import styles from './WaiterLayout.module.css'

const links = [
  { label: 'My Tables', to: '/waiter/tables' },
  { label: 'Pickup', to: '/waiter/pickup' },
]

function WaiterLayout() {
  return (
    <div className={styles.page}>
      <NavBar />
      <div className={styles.workspace}>
        <aside className={styles.sidebar}><span className={styles.kicker}>Waiter station</span><strong>Service floor</strong><nav aria-label="Waiter navigation">{links.map((link) => <NavLink key={link.to} to={link.to} className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>{link.label}</NavLink>)}</nav></aside>
        <main className={styles.main}><Outlet /></main>
      </div>
    </div>
  )
}

export default WaiterLayout
