import styles from './StatusBadge.module.css'

function StatusBadge({ status }) {
  return <span className={`${styles.badge} ${styles[status] || styles.default}`}>{status.replace('_', ' ')}</span>
}

export default StatusBadge
