import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api'
import NavBar from '../components/NavBar'
import { useSocketEvent } from '../context/SocketContext'
import { formatMoney } from '../utils/formatters'
import { formatOrderItems } from '../utils/orderItems'
import styles from './ChefKitchen.module.css'

const columns = [
  { status: 'pending', title: 'Pending', action: 'Accept', next: 'accepted' },
  { status: 'accepted', title: 'Accepted', action: 'Start Preparing', next: 'preparing' },
  { status: 'preparing', title: 'Preparing', action: 'Mark Ready', next: 'ready' },
  { status: 'ready', title: 'Ready' },
]

const getId = (value) => typeof value === 'object' && value ? value._id : value

function mergeOrders(current, incoming) {
  const byId = new Map(current.map((order) => [getId(order), order]))
  incoming.forEach((order) => byId.set(getId(order), order))
  return [...byId.values()]
}

function ChefKitchen() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')

  const loadOrders = useCallback(async () => {
    try {
      const incoming = await apiRequest('/kitchen')
      setOrders((current) => mergeOrders(current, incoming))
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to load the kitchen queue.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])
  useSocketEvent('order:placed', loadOrders)
  useSocketEvent('order:accepted', loadOrders)
  useSocketEvent('order:preparing', loadOrders)
  useSocketEvent('order:ready', loadOrders)

  async function transition(order, nextStatus) {
    const orderId = getId(order)
    setWorkingId(orderId)
    setError('')
    setOrders((current) => current.map((item) => getId(item) === orderId ? { ...item, status: nextStatus } : item))

    try {
      await apiRequest(`/kitchen/${orderId}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) })
    } catch (requestError) {
      setError(requestError.message || 'Unable to update this order.')
      await loadOrders()
    } finally {
      setWorkingId('')
    }
  }

  const grouped = useMemo(() => Object.fromEntries(columns.map((column) => [column.status, orders.filter((order) => order.status === column.status)])), [orders])

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <header className={styles.heading}>
          <div><p className={styles.eyebrow}>Kitchen display</p><h1>Keep the pass moving.</h1><p>One queue, four clear moments.</p></div>
          <span className={styles.liveLabel}><i /> Live queue</span>
        </header>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {isLoading ? <p className={styles.status}>Loading the kitchen queue...</p> : <div className={styles.board}>{columns.map((column) => <section className={styles.column} key={column.status}><div className={styles.columnHeading}><h2>{column.title}</h2><span>{grouped[column.status].length}</span></div>{grouped[column.status].length === 0 ? <div className={styles.empty}>Nothing here</div> : <div className={styles.cards}>{grouped[column.status].map((order) => <article className={styles.orderCard} key={getId(order)}><div className={styles.cardTop}><span>Table {order.table?.number || '—'}</span><small>#{String(getId(order)).slice(-5)}</small></div><div className={styles.items}>{formatOrderItems(order.items).map((item, index) => <div className={styles.item} key={`${item.name}-${index}`}><span>{item.quantity} × {item.name}</span><strong>{formatMoney(item.price * item.quantity)}</strong></div>)}</div>{column.action ? <button type="button" className={styles.actionButton} disabled={workingId === getId(order)} onClick={() => transition(order, column.next)}>{workingId === getId(order) ? 'Updating...' : column.action}</button> : <span className={styles.waiting}>Waiting for pickup</span>}</article>)}</div>}</section>)}</div>}
      </main>
    </div>
  )
}

export default ChefKitchen
