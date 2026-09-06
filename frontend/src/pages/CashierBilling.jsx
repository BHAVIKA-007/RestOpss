import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import NavBar from '../components/NavBar'
import { formatMoney } from '../utils/formatters'
import { formatOrderItems } from '../utils/orderItems'
import styles from './CashierBilling.module.css'

const getId = (value) => typeof value === 'object' && value ? value._id : value

function CashierBilling() {
  const [orders, setOrders] = useState([])
  const [expandedId, setExpandedId] = useState('')
  const [paymentMethods, setPaymentMethods] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    apiRequest('/billing')
      .then(setOrders)
      .catch((requestError) => setError(requestError.message || 'Unable to load pending bills.'))
      .finally(() => setIsLoading(false))
  }, [])

  async function markPaid(order) {
    const orderId = getId(order)
    setWorkingId(orderId); setError(''); setSuccess('')
    try {
      await apiRequest(`/billing/${orderId}/pay`, { method: 'PATCH', body: JSON.stringify({ paymentMethod: paymentMethods[orderId] || 'cash' }) })
      setOrders((current) => current.filter((item) => getId(item) !== orderId))
      setExpandedId('')
      setSuccess(`Table ${order.table?.number || '—'} bill marked paid.`)
    } catch (requestError) { setError(requestError.message || 'Unable to process payment.') } finally { setWorkingId('') }
  }

  return <div className={styles.page}><NavBar /><main className={styles.content}><header className={styles.heading}><div><p className={styles.eyebrow}>Cashier station</p><h1>Close the loop.</h1><p>Review completed orders and settle the room cleanly.</p></div></header>{error && <p className={styles.error} role="alert">{error}</p>}{success && <p className={styles.success} role="status">{success}</p>}{isLoading ? <p className={styles.status}>Loading pending bills...</p> : orders.length === 0 ? <div className={styles.empty}>No pending bills right now</div> : <div className={styles.list}>{orders.map((order) => { const items = formatOrderItems(order.items); const orderId = getId(order); const isExpanded = expandedId === orderId; return <article className={styles.billCard} key={orderId}><button type="button" className={styles.billSummary} onClick={() => setExpandedId(isExpanded ? '' : orderId)}><span><strong>Table {order.table?.number || '—'}</strong><small>{items.length} items</small></span><span><b>{formatMoney(order.finalBill)}</b><em>{isExpanded ? 'Hide' : 'View & Pay'}</em></span></button>{isExpanded && <div className={styles.details}><div className={styles.itemList}>{items.map((item, index) => <div className={styles.item} key={`${item.name}-${index}`}><span>{item.quantity} × {item.name}</span><strong>{formatMoney(item.price * item.quantity)}</strong></div>)}</div><div className={styles.breakdown}><div><span>Subtotal</span><strong>{formatMoney(order.totalAmount)}</strong></div><div><span>Tax</span><strong>{formatMoney(order.taxAmount)}</strong></div><div className={styles.final}><span>Total</span><strong>{formatMoney(order.finalBill)}</strong></div></div><div className={styles.payment}><label>Payment method<select value={paymentMethods[orderId] || 'cash'} onChange={(event) => setPaymentMethods((current) => ({ ...current, [orderId]: event.target.value }))}><option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option></select></label><button type="button" className={styles.payButton} disabled={workingId === orderId} onClick={() => markPaid(order)}>{workingId === orderId ? 'Processing...' : 'Mark Paid'}</button></div><p className={styles.note}>Payment also releases this table or combined-table group on the server.</p></div>}</article> })}</div>}</main></div>
}

export default CashierBilling
