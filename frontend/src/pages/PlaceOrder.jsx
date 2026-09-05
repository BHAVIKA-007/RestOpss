import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import { useSocket, useSocketEvent } from '../context/SocketContext'
import { getMenuByRestaurantId } from '../services/restaurantService'
import { getMyReservations } from '../services/reservationService'
import { confirmOrderReceived, createCustomerOrder } from '../services/orderService'
import { formatMoney, getId } from '../utils/formatters'
import styles from './PlaceOrder.module.css'

const trackingSteps = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served']

function PlaceOrder() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { joinRestaurantRoom } = useSocket()
  const [reservation, setReservation] = useState(null)
  const [menu, setMenu] = useState([])
  const [quantities, setQuantities] = useState({})
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([getMyReservations(), getMenuByRestaurantId(id)])
      .then(([reservations, menuItems]) => {
        const found = reservations.find((item) => getId(item) === id)
        if (!found) throw new Error('Reservation not found')
        setReservation(found)
        setMenu(menuItems)
        const initial = Object.fromEntries((location.state?.preOrder || []).map((item) => [item.menuItemId, item.quantity]))
        setQuantities(initial)
        joinRestaurantRoom(getId(found.restaurantId))
      })
      .catch((requestError) => setError(requestError.message || 'Unable to load the order page.'))
      .finally(() => setIsLoading(false))
  }, [id, joinRestaurantRoom, location.state])

  const updateFromSocket = useCallback((event, nextStatus) => {
    if (order && event.orderId === getId(order)) setOrder((current) => ({ ...current, status: nextStatus }))
  }, [order])
  const handleAccepted = useCallback((event) => updateFromSocket(event, 'accepted'), [updateFromSocket])
  const handlePreparing = useCallback((event) => updateFromSocket(event, 'preparing'), [updateFromSocket])
  const handleReady = useCallback((event) => updateFromSocket(event, 'ready'), [updateFromSocket])
  const handlePickedUp = useCallback((event) => updateFromSocket(event, 'picked_up'), [updateFromSocket])
  const handleDelivered = useCallback((event) => updateFromSocket(event, 'served'), [updateFromSocket])
  useSocketEvent('order:accepted', handleAccepted)
  useSocketEvent('order:preparing', handlePreparing)
  useSocketEvent('order:ready', handleReady)
  useSocketEvent('order:pickedUp', handlePickedUp)
  useSocketEvent('order:delivered', handleDelivered)

  const groupedMenu = useMemo(() => menu.reduce((groups, item) => {
    const category = item.category || 'Menu'
    groups[category] = [...(groups[category] || []), item]
    return groups
  }, {}), [menu])
  const selectedItems = Object.entries(quantities).filter(([, quantity]) => quantity > 0)
  const total = selectedItems.reduce((sum, [menuItemId, quantity]) => sum + (menu.find((item) => item._id === menuItemId)?.price || 0) * quantity, 0)

  function changeQuantity(menuItemId, amount) {
    setQuantities((current) => ({ ...current, [menuItemId]: Math.max(0, (current[menuItemId] || 0) + amount) }))
  }

  async function submitOrder(event) {
    event.preventDefault()
    if (!selectedItems.length) return
    setIsSubmitting(true)
    setError('')
    try {
      const response = await createCustomerOrder({ reservationId: id, items: selectedItems.map(([menuItemId, quantity]) => ({ menuItemId, quantity })) })
      setOrder(response.order)
    } catch (requestError) {
      setError(requestError.message || 'Unable to place your order.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReceived() {
    try { setOrder((await confirmOrderReceived(getId(order))).order) } catch (requestError) { setError(requestError.message) }
  }

  if (isLoading) return <div className="routeLoading">Preparing your order...</div>
  if (error && !reservation) return <div className={styles.page}><NavBar /><main className={styles.center}><h1>Order page unavailable</h1><p>{error}</p><Link to={`/reservations/${id}`}>Back to reservation</Link></main></div>
  if (order) return <TrackingView order={order} onReceived={handleReceived} onOrders={() => navigate('/orders/mine')} />

  return <div className={styles.page}><NavBar /><main className={styles.content}><Link to={`/reservations/${id}`} className={styles.backLink}>&larr; Back to reservation</Link><p className={styles.eyebrow}>Order for your table</p><h1>What are you in the mood for?</h1><p className={styles.intro}>Choose from the available menu. Your order will be sent after you place it.</p>{error && <p className={styles.error} role="alert">{error}</p>}<form onSubmit={submitOrder}>{Object.entries(groupedMenu).map(([category, items]) => <section className={styles.category} key={category}><h2>{category}</h2>{items.map((item) => <div className={styles.item} key={item._id}><span><strong>{item.name}</strong><small>{item.description || 'A house favorite.'}</small></span><div><b>{formatMoney(item.price)}</b><button type="button" onClick={() => changeQuantity(item._id, -1)}>-</button><em>{quantities[item._id] || 0}</em><button type="button" onClick={() => changeQuantity(item._id, 1)}>+</button></div></div>)}</section>)}<div className={styles.stickyBar}><span>{selectedItems.length} items &middot; <strong>{formatMoney(total)}</strong></span><button type="submit" disabled={!selectedItems.length || isSubmitting}>{isSubmitting ? 'Sending...' : 'Place order'}</button></div></form></main></div>
}

function TrackingView({ order, onReceived, onOrders }) {
  const currentIndex = trackingSteps.indexOf(order.status)
  return <div className={styles.page}><NavBar /><main className={styles.content}><p className={styles.eyebrow}>Order tracking</p><h1>Your order is on its way.</h1><div className={styles.trackingCard}><div className={styles.trackingHeader}><span>Current status</span><StatusBadge status={order.status} /></div><div className={styles.steps}>{trackingSteps.map((step, index) => <div className={`${styles.step} ${index <= currentIndex ? styles.stepActive : ''}`} key={step}><span>{index + 1}</span><small>{step.replace('_', ' ')}</small></div>)}</div><p className={styles.trackingNote}>We&apos;ll keep this page updated as your restaurant moves through the order.</p>{order.status === 'served' && <button type="button" className={styles.receivedButton} onClick={onReceived}>Confirm received</button>}</div><button type="button" className={styles.ordersLink} onClick={onOrders}>View my orders</button></main></div>
}

export default PlaceOrder
