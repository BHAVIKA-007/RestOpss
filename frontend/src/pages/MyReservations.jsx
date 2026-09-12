import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import { getRestaurantById } from '../services/restaurantService'
import { cancelReservation, getMyReservations } from '../services/reservationService'
import { formatDateTime, getCustomerFacingStatusLabel, getId } from '../utils/formatters'
import styles from './MyReservations.module.css'

const upcomingStatuses = ['locked', 'confirmed', 'seated']
const pastStatuses = ['completed', 'no_show']

function MyReservations() {
  const navigate = useNavigate()
  const [reservations, setReservations] = useState([])
  const [restaurantNames, setRestaurantNames] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyReservations()
      .then(async (items) => {
        setReservations(items)
        const ids = [...new Set(items.map((item) => getId(item.restaurantId)).filter(Boolean))]
        const results = await Promise.all(ids.map(async (restaurantId) => {
          try { return [restaurantId, (await getRestaurantById(restaurantId)).name] } catch { return [restaurantId, ''] }
        }))
        setRestaurantNames(Object.fromEntries(results))
      })
      .catch((requestError) => setError(requestError.message || 'Unable to load reservations.'))
      .finally(() => setIsLoading(false))
  }, [])

  async function handleCancel(event, reservation) {
    event.stopPropagation()
    if (!window.confirm('Cancel this reservation?')) return
    try {
      await cancelReservation(getId(reservation))
      setReservations((current) => current.map((item) => getId(item) === getId(reservation) ? { ...item, status: 'cancelled' } : item))
    } catch (requestError) {
      setError(requestError.message || 'Unable to cancel this reservation.')
    }
  }

  function section(title, items) {
    return <section className={styles.section}><div className={styles.sectionTitle}><h2>{title}</h2><span>{items.length}</span></div>{items.length === 0 ? <p className={styles.empty}>Nothing here yet.</p> : items.map((reservation) => <article className={styles.card} key={getId(reservation)} onClick={() => navigate(`/reservations/${getId(reservation)}`)}><div className={styles.cardHeader}><h3>{restaurantNames[getId(reservation.restaurantId)] || `Restaurant ${String(getId(reservation.restaurantId)).slice(-6)}`}</h3><StatusBadge status={reservation.status} label={getCustomerFacingStatusLabel(reservation.status, reservation.timeSlot, reservation.lockExpiresAt)} /></div><p>{formatDateTime(reservation.timeSlot)} &middot; {reservation.partySize} guests</p><p className={styles.tables}>{reservation.tables?.length || 0} table{reservation.tables?.length === 1 ? '' : 's'}</p>{['locked', 'confirmed'].includes(reservation.status) && <button type="button" className={styles.cancelButton} onClick={(event) => handleCancel(event, reservation)}>Cancel</button>}</article>)}</section>
  }

  const isExpiredLocked = (item) => item.status === 'locked' && [item.timeSlot, item.lockExpiresAt].some((value) => value && new Date(value).getTime() < Date.now())
  const bySoonest = (a, b) => new Date(a.timeSlot) - new Date(b.timeSlot)
  const byMostRecent = (a, b) => new Date(b.timeSlot) - new Date(a.timeSlot)
  const upcoming = reservations.filter((item) => upcomingStatuses.includes(item.status) && !isExpiredLocked(item)).sort(bySoonest)
  const past = reservations.filter((item) => pastStatuses.includes(item.status)).sort(byMostRecent)
  const cancelled = reservations.filter((item) => item.status === 'cancelled').sort(byMostRecent)
  const expired = reservations.filter(isExpiredLocked)

  return <div className={styles.page}><NavBar /><main className={styles.content}><p className={styles.eyebrow}>Your plans</p><h1>My reservations</h1>{isLoading && <p className={styles.empty}>Loading reservations...</p>}{error && <p className={styles.error} role="alert">{error}</p>}{!isLoading && !error && <>{section('Upcoming', upcoming)}{section('Past', past)}{section('Expired / Incomplete', expired)}{section('Cancelled', cancelled)}</>}</main></div>
}

export default MyReservations
