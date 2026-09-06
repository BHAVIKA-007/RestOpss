import { NavLink, Outlet } from 'react-router-dom'
import NavBar from './NavBar'
import styles from './HostLayout.module.css'

const links = [
  { label: 'Floor View', to: '/host/floor' },
  { label: 'Waitlist', to: '/host/waitlist' },
  { label: 'Approvals', to: '/host/approvals' },
]

function HostLayout() {
  return (
    <div className={styles.page}>
      <NavBar />
      <div className={styles.workspace}>
        <aside className={styles.sidebar}><span className={styles.kicker}>Host station</span><strong>Front of house</strong><nav aria-label="Host navigation">{links.map((link) => <NavLink key={link.to} to={link.to} className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>{link.label}</NavLink>)}</nav></aside>
        <main className={styles.main}><Outlet /></main>
      </div>
    </div>
  )
}

export default HostLayout
