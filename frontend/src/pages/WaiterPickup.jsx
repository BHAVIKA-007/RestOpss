import { useCallback, useEffect, useState } from 'react'
import StatusBadge from '../components/StatusBadge'
import { useSocketEvent } from '../context/SocketContext'
import { deliverWaiterOrder, getWaiterOrders, pickupWaiterOrder } from '../services/waiterService'
import styles from './WaiterPages.module.css'

function WaiterPickup() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => { try { setOrders((await getWaiterOrders()).filter((order) => ['ready', 'picked_up'].includes(order.status))); setError('') } catch (requestError) { setError(requestError.message || 'Unable to load pickup orders.') } finally { setIsLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  useSocketEvent('order:ready', load)

  async function transition(order, action) { setWorkingId(order._id); setError(''); try { if (action === 'pickup') await pickupWaiterOrder(order._id); else await deliverWaiterOrder(order._id); await load() } catch (requestError) { setError(requestError.message || 'Unable to update this order.') } finally { setWorkingId('') } }
  const ready = orders.filter((order) => order.status === 'ready')
  const pickedUp = orders.filter((order) => order.status === 'picked_up')
  const renderOrder = (order, action, label) => <article className={styles.orderCard} key={order._id}><div><h2>Table {order.table?.number || '—'}</h2><p>{order.items?.length || 0} items · <StatusBadge status={order.status} /></p></div><button type="button" className={styles.primaryButton} disabled={workingId === order._id} onClick={() => transition(order, action)}>{workingId === order._id ? 'Updating...' : label}</button></article>

  return <div><header className={styles.heading}><div><p className={styles.eyebrow}>Waiter station</p><h1>Pickup & deliver.</h1><p>Keep the last handoff as clear as the first.</p></div></header>{error && <p className={styles.error} role="alert">{error}</p>}{isLoading ? <p className={styles.status}>Loading kitchen handoff...</p> : <div className={styles.orderList}><section><p className={styles.label}>Ready for pickup</p>{ready.length ? ready.map((order) => renderOrder(order, 'pickup', 'Picked Up')) : <div className={styles.empty}>Nothing waiting at the pass.</div>}</section><section><p className={styles.label}>Picked up</p>{pickedUp.length ? pickedUp.map((order) => renderOrder(order, 'deliver', 'Delivered')) : <div className={styles.empty}>No orders in hand.</div>}</section></div>}</div>
}

export default WaiterPickup
