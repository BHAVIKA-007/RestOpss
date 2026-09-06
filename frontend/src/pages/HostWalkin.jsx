import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { allocateWalkIn, getHostFloorLayout, suggestCombination } from '../services/hostService'
import styles from './HostPages.module.css'

function HostWalkin() {
  const { user } = useAuth()
  const location = useLocation()
  const [groupSize, setGroupSize] = useState(2)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const [result, setResult] = useState(null)
  const [tables, setTables] = useState([])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (location.state?.tableId) setSuggestion({ preferredTableId: location.state.tableId })
  }, [location.state])

  useEffect(() => { getHostFloorLayout().then((data) => setTables(data.tables || [])).catch(() => {}) }, [])

  async function handleSubmit(event) {
    event.preventDefault(); setError(''); setResult(null); setIsSubmitting(true)
    const timeSlot = new Date().toISOString()
    try {
      const proposed = await suggestCombination({ restaurantId: user.restaurantId, partySize: groupSize, timeSlot })
      setSuggestion(proposed)
    } catch { setSuggestion(null) }
    try {
      const allocation = await allocateWalkIn({ restaurantId: user.restaurantId, groupSize: Number(groupSize), ...(guestName.trim() ? { guestName: guestName.trim() } : {}), ...(guestPhone.trim() ? { guestPhone: guestPhone.trim() } : {}) })
      const assignedTable = tables.find((table) => String(table._id) === String(allocation.tableId))
      setResult({ ...allocation, tableNumber: assignedTable?.number })
    } catch (requestError) { setError(requestError.message || 'Unable to seat this walk-in.') } finally { setIsSubmitting(false) }
  }

  return <div><header className={styles.heading}><div><p className={styles.eyebrow}>Host station</p><h1>Seat a walk-in.</h1><p>Find the next good fit, then let the live allocator make the final call.</p></div></header><section className={styles.formPanel}>{error && <p className={styles.error} role="alert">{error}</p>}{!result ? <form className={styles.formGrid} onSubmit={handleSubmit}><label>Party size<div className={styles.stepper}><button type="button" onClick={() => setGroupSize((value) => Math.max(1, value - 1))}>−</button><output>{groupSize}</output><button type="button" onClick={() => setGroupSize((value) => value + 1)}>+</button></div></label><label>Guest name <span>(optional)</span><input value={guestName} onChange={(event) => setGuestName(event.target.value)} /></label><label>Guest phone <span>(optional)</span><input value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} /></label><p className={styles.caption}>The table suggestion is helpful context, not a guarantee. Verify against the live floor view because walk-ins may already have changed the room.</p><button type="submit" className={styles.primaryButton} disabled={isSubmitting}>{isSubmitting ? 'Finding a table...' : 'Seat guest'}</button></form> : <div className={styles.result}><h2>{result.status === 'allocated' ? `Table ${result.tableNumber ?? result.tableId} is ready.` : result.status === 'waiting' ? 'Guest joined the waitlist.' : 'Manager attention needed.'}</h2><p>{result.status === 'waiting' ? `They are position ${result.position || 'in the queue'}.` : result.message || 'The allocator could not complete this seating.'}</p><div className={styles.actionRow}><Link to="/host/floor" className={styles.primaryButton}>Back to floor</Link>{result.status === 'waiting' && <Link to="/host/waitlist" className={styles.secondaryButton}>Open waitlist</Link>}</div></div>}{suggestion && !result && <p className={styles.caption}>Suggested combination: {suggestion.map ? suggestion.map((item) => item.tableIds?.join(', ')).join(' · ') : 'available options returned'}.</p>}</section></div>
}

export default HostWalkin
