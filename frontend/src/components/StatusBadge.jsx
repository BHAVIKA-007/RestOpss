import styles from './StatusBadge.module.css'

function StatusBadge({ status, label }) {
  return <span className={`${styles.badge} ${styles[status] || styles.default}`}>{label || status.replace('_', ' ')}</span>
}

export default StatusBadge
