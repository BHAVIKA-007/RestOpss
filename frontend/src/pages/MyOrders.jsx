import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import { getMyOrders } from '../services/orderService'
import { formatDateTime, formatMoney, getId } from '../utils/formatters'
import styles from './MyOrders.module.css'

const activeStatuses = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served']

function MyOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyOrders().then(setOrders).catch((requestError) => setError(requestError.message || 'Unable to load orders.'))
  }, [])

  function openOrder(order) {
    const reservationId = getId(order.reservation)
    if (activeStatuses.includes(order.status) && reservationId) navigate(`/reservations/${reservationId}/order`)
    else setExpandedId((current) => current === getId(order) ? null : getId(order))
  }

  return <div className={styles.page}><NavBar /><main className={styles.content}><p className={styles.eyebrow}>Your table history</p><h1>My orders</h1>{error && <p className={styles.error} role="alert">{error}</p>}{!error && orders.length === 0 && <p className={styles.empty}>You haven&apos;t placed an order yet.</p>}<div className={styles.list}>{orders.map((order) => { const itemCount = order.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0; const isExpanded = expandedId === getId(order); return <article className={styles.card} key={getId(order)}><button type="button" className={styles.cardButton} onClick={() => openOrder(order)}><span><strong>{formatDateTime(order.createdAt)}</strong><small>{itemCount} items</small></span><span><StatusBadge status={order.status} /><b>{formatMoney(order.finalBill)}</b></span></button>{isExpanded && <div className={styles.detail}><p>Order details</p>{order.items?.map((item, index) => <div key={`${item.name}-${index}`}><span>{item.quantity} &times; {item.name}</span><b>{formatMoney((item.priceAtOrder || item.price) * item.quantity)}</b></div>)}</div>}</article>})}</div></main></div>
}

export default MyOrders
