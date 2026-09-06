import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { useSocketEvent } from '../context/SocketContext'
import { expireHostWaitlist, getHostWaitlist, respondToWaitlist } from '../services/hostService'
import styles from './HostPages.module.css'

function decorate(entries) { const waiting = entries.filter((entry) => entry.status === 'waiting'); return entries.map((entry) => ({ ...entry, position: entry.status === 'waiting' ? waiting.findIndex((item) => item._id === entry._id) + 1 : null, waitingSinceMinutes: Math.max(0, Math.round((Date.now() - new Date(entry.createdAt).getTime()) / 60000)) })) }

function HostWaitlist() {
  const [entries, setEntries] = useState([])
  const [tableIds, setTableIds] = useState({})
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => { try { setEntries(decorate(await getHostWaitlist())); setNow(Date.now()); setError('') } catch (requestError) { setError(requestError.message || 'Unable to load the waitlist.') } finally { setIsLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  useSocketEvent('waitlist:notified', (event) => { if (event.waitingQueueId && event.tableId) setTableIds((current) => ({ ...current, [event.waitingQueueId]: event.tableId })); load() })

  async function respond(entry, accept) { setWorkingId(entry._id); setError(''); try { await respondToWaitlist(entry._id, accept, entry.tableId || tableIds[entry._id]); await load() } catch (requestError) { setError(requestError.message || 'Unable to respond. The current backend may require the notified table ID.') } finally { setWorkingId('') } }
  async function expire(entry) { setWorkingId(entry._id); setError(''); try { await expireHostWaitlist(entry._id); await load() } catch (requestError) { setError(requestError.message || 'Expiry check is not available for this host account yet.') } finally { setWorkingId('') } }

  return <div><header className={styles.heading}><div><p className={styles.eyebrow}>Host station</p><h1>Keep the queue moving.</h1><p>Respond quickly when a held table is ready for the next guest.</p></div><Link to="/host/walkin" className={styles.primaryButton}>Seat walk-in</Link></header>{error && <p className={styles.error} role="alert">{error}</p>}{isLoading ? <p className={styles.status}>Loading waitlist...</p> : entries.length === 0 ? <div className={styles.empty}>The waitlist is clear.</div> : <div className={styles.list}>{entries.map((entry) => { const stale = entry.status === 'notified' && entry.responseDeadline && new Date(entry.responseDeadline).getTime() < now; return <article className={styles.queueCard} key={entry._id}><span className={styles.position}>{entry.position || '—'}</span><div><h2>{entry.guestName || entry.displayName || 'Walk-in guest'}</h2><p>{entry.waitingSinceMinutes} min waiting · party of {entry.groupSize} · <StatusBadge status={entry.status} /></p></div><div className={styles.queueActions}>{entry.status === 'notified' && <><button type="button" className={styles.primaryButton} disabled={workingId === entry._id} onClick={() => respond(entry, true)}>Accept</button><button type="button" className={styles.secondaryButton} disabled={workingId === entry._id} onClick={() => respond(entry, false)}>Decline</button></>}{stale && <button type="button" className={styles.secondaryButton} disabled={workingId === entry._id} onClick={() => expire(entry)}>Check Expiry</button>}</div></article> })}</div>}</div>
}

export default HostWaitlist
