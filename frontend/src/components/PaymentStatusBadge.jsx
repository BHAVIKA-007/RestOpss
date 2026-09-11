import styles from './PaymentStatusBadge.module.css'

function PaymentStatusBadge({ paidStatus }) {
  const isPaid = paidStatus === 'paid'
  return <span className={`${styles.badge} ${isPaid ? styles.paid : styles.unpaid}`}>{isPaid ? 'Paid' : 'Unpaid'}</span>
}

export default PaymentStatusBadge