import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useSocket, useSocketEvent } from '../context/SocketContext'
import { getMyTables, getWaiterOrders } from '../services/waiterService'
import styles from './WaiterPages.module.css'

const getId = (value) => typeof value === 'object' && value ? value._id : value

function WaiterTables() {
  const { user } = useAuth()
  const { joinRestaurantRoom } = useSocket()
  const [tables, setTables] = useState([])
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => { try { const [myTables, allOrders] = await Promise.all([getMyTables(), getWaiterOrders()]); setTables(myTables); setOrders(allOrders.filter((order) => ['pending', 'accepted', 'preparing', 'ready', 'picked_up'].includes(order.status))) } catch (requestError) { setError(requestError.message || 'Unable to load your tables.') } finally { setIsLoading(false) } }, [])
  useEffect(() => { if (user?.restaurantId) joinRestaurantRoom(user.restaurantId); load() }, [joinRestaurantRoom, load, user?.restaurantId])
  useSocketEvent('table:statusChanged', (event) => { setTables((current) => current.map((table) => getId(table) === event.tableId ? { ...table, status: event.status } : table)) })

  return <div><header className={styles.heading}><div><p className={styles.eyebrow}>Waiter station</p><h1>Your tables.</h1><p>See the room assigned to you, then move straight into an order.</p></div></header>{error && <p className={styles.error} role="alert">{error}</p>}{isLoading ? <p className={styles.status}>Loading assigned tables...</p> : tables.length === 0 ? <div className={styles.empty}>No tables assigned to you yet — ask your manager to assign some.</div> : <div className={styles.cardGrid}>{tables.map((table) => { const order = orders.find((item) => getId(item.table) === getId(table)); return <Link className={styles.card} to={`/waiter/tables/${getId(table)}/order`} key={getId(table)}><span className={styles.label}>Table</span><h2>{table.number}</h2><StatusBadge status={table.status} /><div className={styles.cardFooter}><span className={styles.link}>Take order &rarr;</span></div>{order && <div className={styles.orderHint}>Current order: {order.items?.length || 0} items · {order.status.replace('_', ' ')}</div>}</Link> })}</div>}</div>
}

export default WaiterTables
