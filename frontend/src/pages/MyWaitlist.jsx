import { useEffect, useState } from 'react'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import { cancelMyWaitlistRequest, getMyWaitlistRequests } from '../services/reservationService'
import { getId } from '../utils/formatters'
import styles from './MyWaitlist.module.css'

function MyWaitlist() {
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')

  async function loadEntries() {
    try {
      setEntries(await getMyWaitlistRequests())
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to load waitlist requests.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadEntries() }, [])

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

  return <div className={styles.page}><NavBar /><main className={styles.content}><p className={styles.eyebrow}>Your requests</p><h1>My Waitlist Requests</h1>{error && <p className={styles.error} role="alert">{error}</p>}{isLoading ? <p className={styles.empty}>Loading waitlist requests...</p> : entries.length === 0 ? <p className={styles.empty}>You have no waitlist requests.</p> : <div className={styles.list}>{entries.map((entry) => { const id = getId(entry); return <article className={styles.item} key={id}><div className={styles.itemHeading}><h2>{entry.restaurantId?.name || entry.displayName || `Restaurant ${String(getId(entry.restaurantId)).slice(-6)}`}</h2><StatusBadge status={entry.status} label={entry.status === 'expired' ? 'Expired — no longer waiting' : undefined} /></div><p>Party of {entry.groupSize}</p><p>Requested {new Date(entry.requestedTimeSlot).toLocaleString()}</p>{entry.position && <p>Current position: {entry.position}</p>}<button type="button" className={styles.cancelButton} disabled={workingId === id} onClick={() => handleCancel(entry)}>{workingId === id ? 'Cancelling...' : 'Cancel request'}</button></article> })}</div>}</main></div>
}

export default MyWaitlist