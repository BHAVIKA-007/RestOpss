import { useCallback, useEffect, useState } from 'react'
import StatusBadge from '../components/StatusBadge'
import { useSocketEvent } from '../context/SocketContext'
import { cancelManagerWaitlistEntry, expireManagerWaitlistEntry, getManagerWaitlist } from '../services/managerService'
import { seatGuestWaitlistEntry } from '../services/hostService'
import styles from './ManagerPages.module.css'

function requestedTimeLabel(entry, now) {
  const requestedTime = new Date(entry.requestedTimeSlot)
  if (requestedTime.getTime() > now) return `Requested for ${requestedTime.toLocaleString()}`
  return `${Math.max(0, Math.round((now - requestedTime.getTime()) / 60000))} min waiting`
}

function ManagerWaitlist() {
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const loadWaitlist = useCallback(async () => {
    try {
      setEntries(await getManagerWaitlist())
      setNow(Date.now())
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to load the waitlist.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadWaitlist() }, [loadWaitlist])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  useSocketEvent('waitlist:notified', loadWaitlist)
  useSocketEvent('waitlist:seatNow', loadWaitlist)
  useSocketEvent('waitlist:cancelled', loadWaitlist)
  useSocketEvent('waitlist:allocated', loadWaitlist)
  useSocketEvent('waitlist:expired', loadWaitlist)
  useSocketEvent('waitlist:managerReviewNeeded', loadWaitlist)

  async function seatNow(entry) {
    setWorkingId(entry._id)
    setError('')
    try {
      await seatGuestWaitlistEntry(entry._id)
      await loadWaitlist()
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
      await expireManagerWaitlistEntry(entry._id)
      await loadWaitlist()
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
      await cancelManagerWaitlistEntry(entry._id)
      await loadWaitlist()
    } catch (requestError) {
      setError(requestError.message || 'Unable to cancel this entry.')
    } finally {
      setWorkingId('')
    }
  }

  return (
    <div>
      <header className={styles.pageHeading}>
        <p className={styles.eyebrow}>Manager workspace</p>
        <h1>The waitlist, visible.</h1>
        <p>Match open tables to guests, then take the next clear action.</p>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <section className={styles.panel}>
        {isLoading ? <p className={styles.status}>Loading waitlist...</p> : entries.length === 0 ? <p className={styles.status}>The waitlist is clear.</p> : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead><tr><th>Position</th><th>Guest</th><th>Requested time</th><th>Status</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {entries.map((entry) => {
                  const deadlinePassed = entry.status === 'notified' && entry.responseDeadline && new Date(entry.responseDeadline).getTime() < now
                  const hasGuestMatch = !entry.customer && entry.status === 'waiting' && entry.matchedTableIds?.length > 0
                  const matchedTables = (entry.matchedTableIds || []).map((table) => typeof table === 'object' ? `Table ${table.number}` : `Table ${table}`).join(', ')
                  return (
                    <tr className={entry.needsManagerReview ? styles.reviewRow : ''} key={entry._id}>
                      <td>{entry.position || '—'}</td>
                      <td><strong>{entry.displayName || entry.customer?.name || entry.guestName || 'Walk-in guest'}</strong><small>Party of {entry.groupSize}{matchedTables && ` · Matched ${matchedTables}`}</small></td>
                      <td>{requestedTimeLabel(entry, now)}</td>
                      <td>{entry.status === 'expired' ? <StatusBadge status="expired" label="Expired" /> : entry.needsManagerReview ? <StatusBadge status="manager_review" label="Needs Manager Decision" /> : <StatusBadge status={entry.status} />}</td>
                      <td><div className={styles.rowActions}>
                        {hasGuestMatch && <button type="button" className={styles.smallButton} disabled={workingId === entry._id} onClick={() => seatNow(entry)}>{workingId === entry._id ? 'Seating...' : 'Seat Now'}</button>}
                        {entry.status === 'notified' && <small className={styles.status}>Awaiting customer response</small>}
                        {deadlinePassed && <button type="button" className={styles.smallButton} disabled={workingId === entry._id} onClick={() => expire(entry)}>Expire</button>}
                        <button type="button" className={styles.smallDanger} disabled={workingId === entry._id} onClick={() => cancel(entry)}>{workingId === entry._id ? 'Cancelling...' : 'Cancel'}</button>
                      </div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default ManagerWaitlist
