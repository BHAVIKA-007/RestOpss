import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import { useSocketEvent } from '../context/SocketContext'
import { confirmReservation, getMyReservations } from '../services/reservationService'
import { formatDateTime, getId } from '../utils/formatters'
import styles from './ReservationConfirm.module.css'

function ReservationConfirm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [reservation, setReservation] = useState(null)
  const [restaurantName, setRestaurantName] = useState('Your restaurant')
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState('')

  const loadReservation = useCallback(async () => {
    const reservations = await getMyReservations()
    const found = reservations.find((item) => getId(item) === id)
    if (!found) throw new Error('Reservation not found')
    setReservation(found)
    if (found.restaurantId?.name) setRestaurantName(found.restaurantId.name)
    return found
  }, [id])

  useEffect(() => {
    loadReservation().catch((requestError) => setError(requestError.message)).finally(() => setIsLoading(false))
  }, [loadReservation])

  const handleApproval = useCallback((event) => {
    if (event.reservationId !== id) return

    setReservation((current) => current
      ? { ...current, requiresApproval: false, lockExpiresAt: event.lockExpiresAt }
      : current)
  }, [id])

  useSocketEvent('reservation:approved', handleApproval)

  useEffect(() => {
    if (!reservation?.lockExpiresAt) return undefined
    const updateCountdown = () => setSecondsLeft(Math.max(0, Math.floor((new Date(reservation.lockExpiresAt).getTime() - Date.now()) / 1000)))
    updateCountdown()
    const timer = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(timer)
  }, [reservation?.lockExpiresAt])

  async function handleConfirm() {
    setIsConfirming(true)
    setError('')
    try {
      await confirmReservation(id)
      navigate('/reservations/mine', { replace: true })
    } catch (requestError) {
      setError(requestError.status === 409 || requestError.message.toLowerCase().includes('booked')
        ? 'This table was just booked by someone else. Please try a different table or time.'
        : requestError.message)
    } finally {
      setIsConfirming(false)
    }
  }

  if (isLoading) return <div className="routeLoading">Loading your reservation...</div>
  if (error && !reservation) return <div className={styles.page}><NavBar /><main className={styles.center}><h1>Reservation not found</h1><p>{error}</p><Link to="/restaurants">Back to restaurants</Link></main></div>

  const expired = secondsLeft === 0
  const requiresApproval = reservation.requiresApproval
  const preOrder = location.state?.preOrder || []

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <p className={styles.eyebrow}>Step 3 of 3</p>
        <h1>Hold your table.</h1>
        <p className={styles.intro}>{restaurantName}</p>
        <section className={styles.card}>
          <div className={styles.cardTop}><span>Reservation details</span><StatusBadge status={reservation.status} /></div>
          <dl><div><dt>When</dt><dd>{formatDateTime(reservation.timeSlot)}</dd></div><div><dt>Party</dt><dd>{reservation.partySize} guests</dd></div><div><dt>Tables</dt><dd>{reservation.tables.map((table) => getId(table)).join(', ')}</dd></div></dl>
        </section>
        {expired ? (
          <section className={styles.notice}><h2>This booking has expired</h2><p>The table hold timed out. Start again to find a fresh option.</p><Link to={`/restaurants/${getId(reservation.restaurantId)}`}>Back to restaurant</Link></section>
        ) : requiresApproval ? (
          <section className={styles.waiting}><span className={styles.loader} aria-hidden="true" /><h2>Waiting for restaurant approval</h2><p>The restaurant is reviewing your combined-table request. This page will update automatically.</p><strong>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} remaining</strong></section>
        ) : (
          <section className={styles.confirmBox}><p>Your table is held for <strong>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</strong>.</p><button type="button" className={styles.confirmButton} onClick={handleConfirm} disabled={isConfirming}>{isConfirming ? 'Confirming...' : 'Confirm reservation'}</button></section>
        )}
        {error && reservation && <p className={styles.error} role="alert">{error}</p>}
        {preOrder.length > 0 && <p className={styles.preOrderNote}>Your optional menu selections are saved for later.</p>}
      </main>
    </div>
  )
}

export default ReservationConfirm
