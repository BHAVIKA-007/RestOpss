import { NavLink, Outlet } from 'react-router-dom'
import NavBar from './NavBar'
import styles from './ManagerLayout.module.css'

const navigation = [
  { label: 'Dashboard', to: '/manager', end: true },
  { label: 'Floor Plan', to: '/manager/floor-plan' },
  { label: 'Staff', to: '/manager/staff' },
  { label: 'Menu', to: '/manager/menu' },
  { label: 'Approvals', to: '/manager/approvals' },
  { label: 'Reservations', to: '/manager/reservations' },
  { label: 'Waitlist', to: '/manager/waitlist' },
  { label: 'Reports', to: '/manager/reports' },
]

function ManagerLayout() {
  return (
    <div className={styles.page}>
      <NavBar />
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.sideHeading}>
            <span className={styles.kicker}>Manager workspace</span>
            <strong>Service desk</strong>
          </div>
          <nav aria-label="Manager navigation">
            {navigation.map((item) => (
              <NavLink
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                end={item.end}
                key={item.to}
                to={item.to}
              >
                <span className={styles.navDot} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className={styles.main}><Outlet /></main>
      </div>
    </div>
  )
}

export default ManagerLayout
