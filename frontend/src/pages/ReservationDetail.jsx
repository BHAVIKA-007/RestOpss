import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import { getRestaurantById } from '../services/restaurantService'
import { getMyReservations } from '../services/reservationService'
import { getMyOrders } from '../services/orderService'
import { formatDateTime, formatMoney, getId } from '../utils/formatters'
import styles from './ReservationDetail.module.css'

function ReservationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reservation, setReservation] = useState(null)
  const [restaurantName, setRestaurantName] = useState('Restaurant')
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getMyReservations(), getMyOrders()])
      .then(async ([reservations, allOrders]) => {
        const found = reservations.find((item) => getId(item) === id)
        if (!found) throw new Error('Reservation not found')
        setReservation(found)
        setOrders(allOrders.filter((order) => getId(order.reservation) === id))
        const restaurantId = getId(found.restaurantId)
        try { setRestaurantName((await getRestaurantById(restaurantId)).name) } catch { setRestaurantName(`Restaurant ${String(restaurantId).slice(-6)}`) }
      })
      .catch((requestError) => setError(requestError.message || 'Unable to load this reservation.'))
  }, [id])

  if (error) return <div className={styles.page}><NavBar /><main className={styles.center}><h1>Reservation not found</h1><p>{error}</p><Link to="/reservations/mine">Back to reservations</Link></main></div>
  if (!reservation) return <div className="routeLoading">Loading reservation...</div>

  const canOrder = ['confirmed', 'seated'].includes(reservation.status)
  return <div className={styles.page}><NavBar /><main className={styles.content}><Link to="/reservations/mine" className={styles.backLink}>&larr; My reservations</Link><p className={styles.eyebrow}>Reservation detail</p><h1>{restaurantName}</h1><section className={styles.card}><div className={styles.header}><h2>Your table</h2><StatusBadge status={reservation.status} /></div><dl><div><dt>When</dt><dd>{formatDateTime(reservation.timeSlot)}</dd></div><div><dt>Party size</dt><dd>{reservation.partySize} guests</dd></div><div><dt>Tables</dt><dd>{reservation.tables.map((table) => getId(table)).join(', ')}</dd></div></dl></section><section className={styles.orders}><h2>Orders for this visit</h2>{orders.length === 0 ? <p className={styles.muted}>No orders attached yet.</p> : orders.map((order) => <div className={styles.order} key={getId(order)}><span>{order.items?.length || 0} items &middot; {formatMoney(order.finalBill)}</span><StatusBadge status={order.status} /></div>)}</section>{canOrder && <button type="button" className={styles.orderButton} onClick={() => navigate(`/reservations/${id}/order`)}>Order food <span>&rarr;</span></button>}</main></div>
}

export default ReservationDetail
