import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import { useSocketEvent } from '../context/SocketContext'
import { cancelMyWaitlistRequest, getMyWaitlistRequests, respondToMyWaitlistRequest } from '../services/reservationService'
import { getId } from '../utils/formatters'
import styles from './MyWaitlist.module.css'

function MyWaitlist() {
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')
  const [notification, setNotification] = useState('')

  const loadEntries = useCallback(async () => {
    try {
      setEntries(await getMyWaitlistRequests())
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to load waitlist requests.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])
  useSocketEvent('waitlist:notified', (event) => {
    setNotification('A table match is ready. Accept it within 10 minutes to confirm your reservation.')
    loadEntries()
    return event
  })

  async function respond(entry, accept) {
    const id = getId(entry)
    setWorkingId(id)
    setError('')
    try {
      const result = await respondToMyWaitlistRequest(id, accept)
      setNotification(accept ? result.message : 'You declined the table match.')
      await loadEntries()
    } catch (requestError) {
      setError(requestError.message || 'Unable to respond to this table match.')
      await loadEntries()
    } finally {
      setWorkingId('')
    }
  }

  async function handleCancel(entry) {
    if (!window.confirm('Cancel this waitlist request?')) return
    const id = getId(entry)
    setWorkingId(id)
    setError('')
    try {
      await cancelMyWaitlistRequest(id)
      await loadEntries()
    } catch (requestError) {
      setError(requestError.message || 'Unable to cancel this request.')
    } finally {
      setWorkingId('')
    }
  }

  return <div className={styles.page}><NavBar /><main className={styles.content}><p className={styles.eyebrow}>Your requests</p><h1>My Waitlist Requests</h1>{notification && <p className={styles.notice} role="status">{notification}</p>}{error && <p className={styles.error} role="alert">{error}</p>}{isLoading ? <p className={styles.empty}>Loading waitlist requests...</p> : entries.length === 0 ? <p className={styles.empty}>You have no waitlist requests.</p> : <div className={styles.list}>{entries.map((entry) => { const id = getId(entry); const isNotified = entry.status === 'notified'; const tableLabels = (entry.matchedTableIds || []).map((table) => typeof table === 'object' ? `Table ${table.number}` : String(table)).join(', '); const reservationId = getId(entry.reservation); return <article className={styles.item} key={id}><div className={styles.itemHeading}><h2>{entry.restaurantId?.name || entry.displayName || `Restaurant ${String(getId(entry.restaurantId)).slice(-6)}`}</h2><StatusBadge status={entry.status} label={entry.status === 'expired' ? 'Expired — no longer waiting' : undefined} /></div><p>Party of {entry.groupSize}</p><p>Requested {new Date(entry.requestedTimeSlot).toLocaleString()}</p>{tableLabels && <p>Table match: {tableLabels}</p>}{isNotified && <><p>Respond by {new Date(entry.responseDeadline).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</p><div className={styles.responseActions}><button type="button" className={styles.acceptButton} disabled={workingId === id} onClick={() => respond(entry, true)}>{workingId === id ? 'Working...' : 'Accept'}</button><button type="button" className={styles.declineButton} disabled={workingId === id} onClick={() => respond(entry, false)}>Decline</button></div></>}{entry.status === 'allocated' && reservationId && <Link to={`/reservations/${reservationId}`}>View confirmed reservation</Link>}<button type="button" className={styles.cancelButton} disabled={workingId === id} onClick={() => handleCancel(entry)}>{workingId === id ? 'Working...' : 'Cancel request'}</button></article> })}</div>}</main></div>
}

export default MyWaitlist