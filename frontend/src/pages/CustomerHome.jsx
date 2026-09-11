import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import PaymentStatusBadge from '../components/PaymentStatusBadge'
import { getMyOrders } from '../services/orderService'
import { getMyReservations } from '../services/reservationService'
import { formatDateTime, getCustomerFacingStatusLabel, getId } from '../utils/formatters'
import styles from './CustomerHome.module.css'

const activeOrderStatuses = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served']

function CustomerHome() {
  const [reservations, setReservations] = useState([])
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getMyReservations(), getMyOrders()])
      .then(([nextReservations, nextOrders]) => { setReservations(nextReservations); setOrders(nextOrders) })
      .catch((requestError) => setError(requestError.message || 'Unable to load your activity.'))
  }, [])

  const upcomingReservation = useMemo(() => reservations
    .filter((reservation) => ['locked', 'confirmed', 'seated'].includes(reservation.status) && new Date(reservation.timeSlot).getTime() >= Date.now())
    .sort((a, b) => new Date(a.timeSlot) - new Date(b.timeSlot))[0], [reservations])
  const activeOrder = orders.find((order) => activeOrderStatuses.includes(order.status) && getId(order.reservation))

  return <div className={styles.page}><NavBar /><main className={styles.content}><p className={styles.eyebrow}>Your RestOps home</p><h1>What&apos;s happening with you?</h1>{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.grid}>{upcomingReservation && <section className={styles.card}><span className={styles.label}>Next reservation</span><h2>{formatDateTime(upcomingReservation.timeSlot)}</h2><p>Party of {upcomingReservation.partySize} &middot; <StatusBadge status={upcomingReservation.status} label={getCustomerFacingStatusLabel(upcomingReservation.status, upcomingReservation.timeSlot, upcomingReservation.lockExpiresAt)} /></p><Link to={`/reservations/${getId(upcomingReservation)}`}>View reservation</Link></section>}{activeOrder && <section className={styles.card}><span className={styles.label}>Active order</span><h2>{activeOrder.items?.length || 0} items in progress</h2><p><StatusBadge status={activeOrder.status} /> <PaymentStatusBadge paidStatus={activeOrder.paidStatus} /></p><Link to={`/reservations/${getId(activeOrder.reservation)}/order`}>Track order</Link></section>}</div>{!upcomingReservation && !activeOrder && !error && <section className={styles.empty}><h2>Nothing on the books yet.</h2><p>Find a restaurant and start planning your next visit.</p><Link to="/restaurants">Browse restaurants</Link></section>}<nav className={styles.quickLinks} aria-label="Customer shortcuts"><Link to="/restaurants">Restaurant Discovery</Link><Link to="/reservations/mine">My Reservations</Link><Link to="/orders/mine">My Orders</Link></nav></main></div>
}

export default CustomerHome