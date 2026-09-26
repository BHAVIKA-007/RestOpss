import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { getManagerReservations } from '../services/managerService'
import { getEarliestSeatingTime, isSeatingAvailable, markNoShowReservation, seatReservation } from '../services/hostService'
import styles from './ManagerPages.module.css'
import { useTiming } from '../context/TimingContext'

const statusOptions = ['locked', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']

function ManagerReservations() {
  const location = useLocation()
  const timing = useTiming()
  const isHostView = location.pathname.startsWith('/host/')
  const today = new Date().toLocaleDateString('en-CA')
  const [reservations, setReservations] = useState([])
  const [selectedStatuses, setSelectedStatuses] = useState([])
  const [date, setDate] = useState(isHostView ? today : '')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [workingId, setWorkingId] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    getManagerReservations({ status: selectedStatuses, date })
      .then((data) => { if (active) setReservations(data) })
      .catch((requestError) => { if (active) setError(requestError.message || 'Unable to load reservations.') })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [date, selectedStatuses])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  async function seatConfirmedReservation(id) {
    setWorkingId(id)
    setError('')
    const reservation = reservations.find((item) => item._id === id)
    if (reservation && timing && !isSeatingAvailable(reservation.timeSlot, timing.seatingBufferMinutes, now)) {
      setError(`Too early to seat this reservation - available at ${getEarliestSeatingTime(reservation.timeSlot, timing.seatingBufferMinutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
      setWorkingId('')
      return
    }
    try {
      await seatReservation(id)
      setReservations((current) => current.map((item) => item._id === id ? { ...item, status: 'seated' } : item))
    } catch (requestError) {
      setError(requestError.message || 'Unable to seat this reservation.')
    } finally {
      setWorkingId('')
    }
  }

  async function markNoShow(id) {
    setWorkingId(id)
    setError('')
    try {
      await markNoShowReservation(id)
      setReservations((current) => current.map((reservation) => reservation._id === id ? { ...reservation, status: 'no_show' } : reservation))
    } catch (requestError) {
      setError(requestError.message || 'Unable to mark this reservation as no-show.')
    } finally {
      setWorkingId('')
    }
  }

  function noShowControl(reservation) {
    if (reservation.status !== 'confirmed') return null
    if (!timing) return <span className={styles.status}>Loading timing...</span>
    const availableAt = new Date(new Date(reservation.timeSlot).getTime() + timing.noShowGraceMinutes * 60000)
    if (now < availableAt.getTime()) return <span className={styles.status}>Available at {availableAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
    return <button type="button" className={styles.smallDanger} disabled={workingId === reservation._id} onClick={() => markNoShow(reservation._id)}>{workingId === reservation._id ? 'Marking...' : 'Mark No-Show'}</button>
  }

  function seatControl(reservation) {
    if (reservation.status !== 'confirmed') return null
    if (!timing) return <span className={styles.status}>Loading timing...</span>
    const availableAt = getEarliestSeatingTime(reservation.timeSlot, timing.seatingBufferMinutes)
    const tooEarly = now < availableAt.getTime()
    return <span className={styles.rowActions}><button type="button" className={styles.smallButton} disabled={workingId === reservation._id || tooEarly} onClick={() => seatConfirmedReservation(reservation._id)}>{workingId === reservation._id ? 'Seating...' : 'Seat'}</button>{tooEarly && <small className={styles.status}>Available at {availableAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>}</span>
  }

  function toggleStatus(status) {
    setSelectedStatuses((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status])
  }

  return (
    <div>
      <header className={styles.pageHeading}><p className={styles.eyebrow}>{isHostView ? 'Host station' : 'Manager workspace'}</p><h1>Every reservation, in order.</h1><p>{isHostView ? "Today's reservations, ready for timely decisions." : 'Filter the service history by status or day.'}</p></header>
      <section className={styles.filterBar}><div><span className={styles.panelKicker}>Status</span><div className={styles.checkRow}>{statusOptions.map((status) => <label className={styles.filterCheck} key={status}><input type="checkbox" checked={selectedStatuses.includes(status)} onChange={() => toggleStatus(status)} /> {status.replace('_', ' ')}</label>)}</div></div><label className={styles.dateFilter}><span className={styles.panelKicker}>Day</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></section>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <section className={styles.panel}>{isLoading ? <p className={styles.status}>Loading reservations...</p> : reservations.length === 0 ? <p className={styles.status}>No reservations match those filters.</p> : <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>Customer</th><th>Tables</th><th>Party</th><th>Time</th><th>Status</th><th>Action</th></tr></thead><tbody>{reservations.map((reservation) => <tr key={reservation._id}><td><strong>{reservation.customer?.name || 'Guest'}</strong><small>{reservation.customer?.email || ''}</small></td><td>{(reservation.tables || []).map((table) => typeof table === 'string' ? table.slice(-4) : `#${table.number}`).join(', ')}</td><td>{reservation.partySize}</td><td>{new Date(reservation.timeSlot).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td><td><StatusBadge status={reservation.status} /></td><td><div className={styles.rowActions}>{seatControl(reservation)}{noShowControl(reservation)}</div></td></tr>)}</tbody></table></div>}</section>
    </div>
  )
}

export default ManagerReservations
