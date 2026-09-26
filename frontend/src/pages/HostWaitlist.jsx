import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { useSocketEvent } from '../context/SocketContext'
import { cancelHostWaitlist, expireHostWaitlist, getHostWaitlist, seatGuestWaitlistEntry } from '../services/hostService'
import styles from './HostPages.module.css'

function requestedTimeLabel(entry, now) {
  const requestedTime = new Date(entry.requestedTimeSlot)
  if (requestedTime.getTime() > now) return `Requested for ${requestedTime.toLocaleString()}`
  return `${Math.max(0, Math.round((now - requestedTime.getTime()) / 60000))} min waiting`
}

function HostWaitlist() {
  const [entries, setEntries] = useState([])
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      setEntries(await getHostWaitlist())
      setNow(Date.now())
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to load the waitlist.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  useSocketEvent('waitlist:notified', load)
  useSocketEvent('waitlist:seatNow', load)
  useSocketEvent('waitlist:cancelled', load)
  useSocketEvent('waitlist:allocated', load)
  useSocketEvent('waitlist:expired', load)
  useSocketEvent('waitlist:managerReviewNeeded', load)

  async function seatNow(entry) {
    setWorkingId(entry._id)
    setError('')
    try {
      await seatGuestWaitlistEntry(entry._id)
      await load()
    } catch (requestError) {
      setError(requestError.message || 'Unable to seat this guest.')
    } finally {
      setWorkingId('')
    }
  }

  async function expire(entry) {
    setWorkingId(entry._id)
    setError('')
    try {
      await expireHostWaitlist(entry._id)
      await load()
    } catch (requestError) {
      setError(requestError.message || 'Unable to expire this notification.')
    } finally {
      setWorkingId('')
    }
  }

  async function cancel(entry) {
    if (!window.confirm('Cancel this waitlist entry?')) return
    setWorkingId(entry._id)
    setError('')
    try {
      await cancelHostWaitlist(entry._id)
      await load()
    } catch (requestError) {
      setError(requestError.message || 'Unable to cancel this entry.')
    } finally {
      setWorkingId('')
    }
  }

  return (
    <div>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Host station</p>
          <h1>Keep the queue moving.</h1>
          <p>Match open tables to guests, then take the next clear action.</p>
        </div>
        <Link to="/host/walkin" className={styles.primaryButton}>Seat walk-in</Link>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {isLoading ? <p className={styles.status}>Loading waitlist...</p> : entries.length === 0 ? <div className={styles.empty}>The waitlist is clear.</div> : (
        <div className={styles.list}>
          {entries.map((entry) => {
            const deadlinePassed = entry.status === 'notified' && entry.responseDeadline && new Date(entry.responseDeadline).getTime() < now
            const hasGuestMatch = !entry.customer && entry.status === 'waiting' && entry.matchedTableIds?.length > 0
            const matchedTables = (entry.matchedTableIds || []).map((table) => typeof table === 'object' ? `Table ${table.number}` : `Table ${table}`).join(', ')
            return (
              <article className={`${styles.queueCard} ${entry.needsManagerReview ? styles.reviewCard : ''}`} key={entry._id}>
                <span className={styles.position}>{entry.position || '—'}</span>
                <div>
                  <h2>{entry.displayName || entry.customer?.name || entry.guestName || 'Walk-in guest'}</h2>
                  <p>{requestedTimeLabel(entry, now)} · party of {entry.groupSize}{matchedTables && ` · Matched: ${matchedTables}`}</p>
                </div>
                <div className={styles.queueActions}>
                  {entry.status === 'expired' ? <StatusBadge status="expired" label="Expired" /> : entry.needsManagerReview ? <StatusBadge status="manager_review" label="Needs Manager Decision" /> : <StatusBadge status={entry.status} />}
                  {entry.status === 'notified' && <span className={styles.caption}>Customer has 10 minutes to respond.</span>}
                  {hasGuestMatch && <button type="button" className={styles.primaryButton} disabled={workingId === entry._id} onClick={() => seatNow(entry)}>{workingId === entry._id ? 'Seating...' : 'Seat Now'}</button>}
                  {deadlinePassed && <button type="button" className={styles.secondaryButton} disabled={workingId === entry._id} onClick={() => expire(entry)}>Expire notification</button>}
                  <button type="button" className={styles.secondaryButton} disabled={workingId === entry._id} onClick={() => cancel(entry)}>{workingId === entry._id ? 'Cancelling...' : 'Cancel'}</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default HostWaitlist
