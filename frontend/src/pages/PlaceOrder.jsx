import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import PaymentStatusBadge from '../components/PaymentStatusBadge'
import { useSocket, useSocketEvent } from '../context/SocketContext'
import { getMenuByRestaurantId } from '../services/restaurantService'
import { getMyReservations } from '../services/reservationService'
import { confirmOrderReceived, createCustomerOrder, getMyOrders } from '../services/orderService'
import { formatMoney, getId } from '../utils/formatters'
import styles from './PlaceOrder.module.css'

const trackingSteps = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served', 'completed']

function PlaceOrder() {
  const { id } = useParams()
  const location = useLocation()
  const { joinRestaurantRoom } = useSocket()
  const [reservation, setReservation] = useState(null)
  const [menu, setMenu] = useState([])
  const [quantities, setQuantities] = useState({})
  const [orders, setOrders] = useState([])
  const [showOrders, setShowOrders] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [menuLoaded, setMenuLoaded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [confirmingOrderId, setConfirmingOrderId] = useState('')
  const [receivedOrderIds, setReceivedOrderIds] = useState(() => new Set())
  const [receivedErrors, setReceivedErrors] = useState({})

  useEffect(() => {
    let isCurrent = true

    async function loadOrderData() {
      setIsLoading(true)
      setMenuLoaded(false)
      setError('')

      try {
        const reservations = await getMyReservations()
        const found = reservations.find((item) => getId(item) === id)

        if (!found) {
          console.warn(`[PlaceOrder] Reservation ${id} was not found in /reservations/my.`)
          throw new Error('Reservation not found in your reservations.')
        }

        const restaurantId = getId(found.restaurantId)
        if (!restaurantId) {
          throw new Error('This reservation does not include a restaurant ID, so its menu cannot be loaded.')
        }

        const [menuItems, allOrders] = await Promise.all([getMenuByRestaurantId(restaurantId), getMyOrders()])
        if (!isCurrent) return

        setReservation(found)
        setMenu(menuItems)
        setOrders(allOrders.filter((item) => getId(item.reservation) === id))
        setMenuLoaded(true)
        let savedPreOrder = location.state?.preOrder || []
        if (!savedPreOrder.length) {
          try { savedPreOrder = JSON.parse(sessionStorage.getItem(`preOrder:${id}`) || '[]') } catch { savedPreOrder = [] }
        }
        const initial = Object.fromEntries(savedPreOrder.map((item) => [item.menuItemId, item.quantity]))
        setQuantities(initial)
        joinRestaurantRoom(restaurantId)
      } catch (requestError) {
        if (isCurrent) setError(requestError.message || 'Unable to load the order page.')
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    loadOrderData()
    return () => { isCurrent = false }
  }, [id, joinRestaurantRoom, location.state, retryKey])

  useEffect(() => {
    if (!reservation || reservation.status === 'seated') return undefined
    const refreshReservation = async () => {
      try {
        const reservations = await getMyReservations()
        const current = reservations.find((item) => getId(item) === id)
        if (current) setReservation(current)
      } catch { /* The initial load already has the actionable error state. */ }
    }
    const interval = window.setInterval(refreshReservation, 10000)
    return () => window.clearInterval(interval)
  }, [id, reservation?.status])

  const updateFromSocket = useCallback((event, nextStatus) => {
    setOrders((current) => current.map((item) => getId(item) === event.orderId ? { ...item, status: event.status || nextStatus } : item))
  }, [])
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
      setOrders((current) => [...current, response.order])
      setShowOrders(true)
    } catch (requestError) {
      setError(requestError.message || 'Unable to place your order.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReceived(order) {
    const orderId = getId(order)
    setConfirmingOrderId(orderId)
    setReceivedErrors((current) => ({ ...current, [orderId]: '' }))
    try {
      const response = await confirmOrderReceived(getId(order))
      setOrders((current) => current.map((item) => getId(item) === getId(order) ? response.order : item))
      setReceivedOrderIds((current) => new Set([...current, orderId]))
    } catch (requestError) {
      setReceivedErrors((current) => ({ ...current, [orderId]: requestError.message || 'Unable to confirm receipt.' }))
    } finally {
      setConfirmingOrderId('')
    }
  }

  if (isLoading) return <div className="routeLoading">Loading your reservation and menu...</div>
  if (error && !reservation) return <div className={styles.page}><NavBar /><main className={styles.center}><h1>We couldn&apos;t load this order page</h1><p>{error}</p><div className={styles.orderActions}><button type="button" onClick={() => setRetryKey((current) => current + 1)}>Try again</button><Link to={`/reservations/${id}`}>Back to reservation</Link></div></main></div>
  if (reservation.status !== 'seated') return <Navigate to={`/reservations/${id}`} replace state={{ orderMessage: "You'll be able to order once you've been seated - please check in with the host", preOrder: location.state?.preOrder || [] }} />
  return <div className={styles.page}><NavBar /><main className={styles.content}><Link to={`/reservations/${id}`} className={styles.backLink}>&larr; Back to reservation</Link><p className={styles.eyebrow}>Order for your table</p><h1>What are you in the mood for?</h1><p className={styles.intro}>Choose from the available menu. Your order will be sent after you place it.</p>{error && <p className={styles.error} role="alert">{error}</p>}<button type="button" className={styles.orderPanelButton} onClick={() => setShowOrders((current) => !current)}>View My Order ({orders.length})</button>{showOrders && <section className={styles.orderPanel}><h2>My Order So Far</h2>{orders.length === 0 ? <p className={styles.trackingNote}>No orders placed for this visit yet.</p> : orders.map((visitOrder) => <OrderTracker key={getId(visitOrder)} order={visitOrder} onReceived={handleReceived} confirmingOrderId={confirmingOrderId} receivedOrderIds={receivedOrderIds} receivedError={receivedErrors[getId(visitOrder)]} />)}</section>}{menuLoaded && menu.length === 0 ? <section className={styles.empty}><h2>This restaurant hasn&apos;t added menu items yet</h2><p>There are no available dishes to order right now.</p></section> : <form onSubmit={submitOrder}>{Object.entries(groupedMenu).map(([category, items]) => <section className={styles.category} key={category}><h2>{category}</h2>{items.map((item) => <div className={styles.item} key={item._id}><span><strong>{item.name}</strong><small>{item.description || 'A house favorite.'}</small></span><div><b>{formatMoney(item.price)}</b><button type="button" onClick={() => changeQuantity(item._id, -1)}>-</button><em>{quantities[item._id] || 0}</em><button type="button" onClick={() => changeQuantity(item._id, 1)}>+</button></div></div>)}</section>)}<div className={styles.stickyBar}><span>{selectedItems.length} items &middot; <strong>{formatMoney(total)}</strong></span><button type="submit" disabled={!selectedItems.length || isSubmitting}>{isSubmitting ? 'Sending...' : 'Place order'}</button></div></form>}</main></div>
}

function OrderTracker({ order, onReceived, confirmingOrderId, receivedOrderIds, receivedError }) {
  const currentIndex = trackingSteps.indexOf(order.status)
  const orderId = getId(order)
  const isReceived = Boolean(order.customerConfirmedAt) || receivedOrderIds.has(orderId)
  const canConfirm = ['served', 'completed'].includes(order.status) && !isReceived
  return <article className={styles.trackingCard}><div className={styles.trackingHeader}><span>Order {orderId.slice(-6)}</span><span><StatusBadge status={order.status} /><PaymentStatusBadge paidStatus={order.paidStatus} /></span></div><div className={styles.steps}>{trackingSteps.map((step, index) => <div className={`${styles.step} ${index <= currentIndex ? styles.stepActive : ''}`} key={step}><span>{index + 1}</span><small>{step.replace('_', ' ')}</small></div>)}</div><p className={styles.trackingNote}>{order.items?.length || 0} items &middot; {formatMoney(order.finalBill)}</p>{canConfirm && <button type="button" className={styles.receivedButton} disabled={confirmingOrderId === orderId} onClick={() => onReceived(order)}>{confirmingOrderId === orderId ? 'Confirming...' : 'Confirm received'}</button>}{isReceived && <p className={styles.receivedMessage} role="status">Received ✓</p>}{receivedError && <p className={styles.receivedError} role="alert">{receivedError}</p>}</article>
}

export default PlaceOrder
