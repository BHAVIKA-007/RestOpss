import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { createWaiterOrder, getWaiterMenu } from '../services/waiterService'
import { formatMoney } from '../utils/formatters'
import styles from './WaiterPages.module.css'

function WaiterOrder() {
  const { id } = useParams()
  const { user } = useAuth()
  const [menu, setMenu] = useState([])
  const [quantities, setQuantities] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)

  useEffect(() => { getWaiterMenu(user.restaurantId).then(setMenu).catch((requestError) => setError(requestError.message || 'Unable to load the menu.')).finally(() => setIsLoading(false)) }, [user.restaurantId])

  const grouped = useMemo(() => menu.reduce((groups, item) => { const category = item.category || 'Menu'; groups[category] = [...(groups[category] || []), item]; return groups }, {}), [menu])
  const selected = Object.entries(quantities).filter(([, quantity]) => quantity > 0)
  const total = selected.reduce((sum, [itemId, quantity]) => sum + Number(menu.find((item) => item._id === itemId)?.price || 0) * quantity, 0)
  function change(itemId, amount) { setQuantities((current) => ({ ...current, [itemId]: Math.max(0, (current[itemId] || 0) + amount) })) }

  async function submit(event) {
    event.preventDefault(); if (!selected.length) return
    setError(''); setIsSubmitting(true)
    try { const response = await createWaiterOrder({ table: id, customer: null, items: selected.map(([itemId, quantity]) => { const item = menu.find((entry) => entry._id === itemId); return { name: item.name, price: Number(item.price), quantity } }) }); setSuccess(response.order) } catch (requestError) { setError(requestError.message || 'Unable to send this order.') } finally { setIsSubmitting(false) }
  }

  if (success) return <div><header className={styles.heading}><div><p className={styles.eyebrow}>Waiter station</p><h1>Order sent.</h1><p>Kitchen has the ticket for table {id}.</p></div></header><section className={styles.formPanel}><StatusBadge status={success.status} /><p className={styles.caption}>The order is now moving through the kitchen handoff.</p><Link to="/waiter/tables" className={styles.primaryButton}>Back to My Tables</Link></section></div>
  return <div><header className={styles.heading}><div><p className={styles.eyebrow}>Table {id}</p><h1>Take an order.</h1><p>Build the ticket from the current menu.</p></div><Link to="/waiter/tables" className={styles.secondaryButton}>Back to tables</Link></header>{error && <p className={styles.error} role="alert">{error}</p>}{isLoading ? <p className={styles.status}>Loading menu...</p> : <form onSubmit={submit}>{Object.entries(grouped).map(([category, items]) => <section className={styles.category} key={category}><h2>{category}</h2>{items.map((item) => <div className={styles.menuItem} key={item._id}><span><strong>{item.name}</strong><small>{item.description || 'No description added.'}</small></span><div><span>{formatMoney(item.price)}</span><div className={styles.quantity}><button type="button" onClick={() => change(item._id, -1)}>-</button><em>{quantities[item._id] || 0}</em><button type="button" onClick={() => change(item._id, 1)}>+</button></div></div></div>)}</section>)}<div className={styles.totalBar}><span>{selected.length} items · <strong>{formatMoney(total)}</strong></span><button type="submit" className={styles.primaryButton} disabled={!selected.length || isSubmitting}>{isSubmitting ? 'Sending...' : 'Send to kitchen'}</button></div></form>}</div>
}

export default WaiterOrder
