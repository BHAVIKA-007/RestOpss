import { useEffect, useState } from 'react'
import StatusBadge from '../components/StatusBadge'
import { getManagerReservations } from '../services/managerService'
import styles from './ManagerPages.module.css'

const statusOptions = ['locked', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']

function ManagerReservations() {
  const [reservations, setReservations] = useState([])
  const [selectedStatuses, setSelectedStatuses] = useState([])
  const [date, setDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    getManagerReservations({ status: selectedStatuses, date })
      .then((data) => { if (active) setReservations(data) })
      .catch((requestError) => { if (active) setError(requestError.message || 'Unable to load reservations.') })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [date, selectedStatuses])

  function toggleStatus(status) {
    setSelectedStatuses((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status])
  }

  return (
    <div>
      <header className={styles.pageHeading}><p className={styles.eyebrow}>Manager workspace</p><h1>Every reservation, in order.</h1><p>Filter the service history by status or day.</p></header>
      <section className={styles.filterBar}><div><span className={styles.panelKicker}>Status</span><div className={styles.checkRow}>{statusOptions.map((status) => <label className={styles.filterCheck} key={status}><input type="checkbox" checked={selectedStatuses.includes(status)} onChange={() => toggleStatus(status)} /> {status.replace('_', ' ')}</label>)}</div></div><label className={styles.dateFilter}><span className={styles.panelKicker}>Day</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></section>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <section className={styles.panel}>{isLoading ? <p className={styles.status}>Loading reservations...</p> : reservations.length === 0 ? <p className={styles.status}>No reservations match those filters.</p> : <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>Customer</th><th>Tables</th><th>Party</th><th>Time</th><th>Status</th></tr></thead><tbody>{reservations.map((reservation) => <tr key={reservation._id}><td><strong>{reservation.customer?.name || 'Guest'}</strong><small>{reservation.customer?.email || ''}</small></td><td>{(reservation.tables || []).map((table) => typeof table === 'string' ? table.slice(-4) : `#${table.number}`).join(', ')}</td><td>{reservation.partySize}</td><td>{new Date(reservation.timeSlot).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td><td><StatusBadge status={reservation.status} /></td></tr>)}</tbody></table></div>}</section>
    </div>
  )
}

export default ManagerReservations
