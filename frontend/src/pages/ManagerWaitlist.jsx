import { useCallback, useEffect, useState } from 'react'
import StatusBadge from '../components/StatusBadge'
import { useSocketEvent } from '../context/SocketContext'
import { cancelManagerWaitlistEntry, expireManagerWaitlistEntry, getManagerWaitlist } from '../services/managerService'
import styles from './ManagerPages.module.css'

function decorateEntries(entries) {
  const waitingEntries = entries.filter((entry) => entry.status === 'waiting' && !entry.needsManagerReview)
  return entries.map((entry) => ({
    ...entry,
    position: entry.status === 'waiting' && !entry.needsManagerReview ? waitingEntries.findIndex((item) => item._id === entry._id) + 1 : null,
    waitingSinceMinutes: Math.max(0, Math.round((Date.now() - new Date(entry.createdAt).getTime()) / 60000)),
  }))
}

function ManagerWaitlist() {
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const loadWaitlist = useCallback(async () => {
    try { setEntries(decorateEntries(await getManagerWaitlist())); setNow(Date.now()); setError('') } catch (requestError) { setError(requestError.message || 'Unable to load the waitlist.') } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { loadWaitlist() }, [loadWaitlist])
  useSocketEvent('waitlist:notified', loadWaitlist)
  useSocketEvent('waitlist:managerReviewNeeded', loadWaitlist)
  useSocketEvent('waitlist:cancelled', loadWaitlist)

  function isPastDeadline(entry) { return entry.status === 'notified' && entry.responseDeadline && new Date(entry.responseDeadline).getTime() < now }

  async function handleExpiry(id) {
    setWorkingId(id)
    setError('')
    try { await expireManagerWaitlistEntry(id); await loadWaitlist() } catch (requestError) { setError(requestError.message || 'Unable to check expiry.') } finally { setWorkingId('') }
  }

  async function handleCancel(id) {
    if (!window.confirm('Cancel this waitlist entry?')) return
    setWorkingId(id)
    setError('')
    try { await cancelManagerWaitlistEntry(id); await loadWaitlist() } catch (requestError) { setError(requestError.message || 'Unable to cancel this entry.') } finally { setWorkingId('') }
  }

  return (
    <div>
      <header className={styles.pageHeading}><p className={styles.eyebrow}>Manager workspace</p><h1>The waitlist, visible.</h1><p>Keep guests moving through the room with a clear next step.</p></header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <section className={styles.panel}>{isLoading ? <p className={styles.status}>Loading waitlist...</p> : entries.length === 0 ? <p className={styles.status}>The waitlist is clear.</p> : <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>Position</th><th>Guest</th><th>Waiting</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>{entries.map((entry) => <tr className={entry.needsManagerReview ? styles.reviewRow : ''} key={entry._id}><td>{entry.position || '—'}</td><td><strong>{entry.guestName || entry.displayName || 'Walk-in guest'}</strong>{entry.groupSize && <small>Party of {entry.groupSize}</small>}</td><td>{entry.waitingSinceMinutes} min</td><td>{entry.status === 'expired' ? <StatusBadge status="expired" label="Expired — no longer waiting" /> : entry.needsManagerReview ? <StatusBadge status="manager_review" label="Needs Manager Decision" /> : <StatusBadge status={entry.status} />}</td><td><button type="button" className={styles.smallDanger} disabled={workingId === entry._id} onClick={() => handleCancel(entry._id)}>{workingId === entry._id ? 'Cancelling...' : 'Cancel'}</button>{isPastDeadline(entry) && <button type="button" className={styles.smallButton} disabled={workingId === entry._id} onClick={() => handleExpiry(entry._id)}>{workingId === entry._id ? 'Checking...' : 'Check Expiry'}</button>}</td></tr>)}</tbody></table></div>}</section>
    </div>
  )
}

export default ManagerWaitlist
