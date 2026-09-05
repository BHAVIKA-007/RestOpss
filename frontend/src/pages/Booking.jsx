import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { getRestaurantById } from '../services/restaurantService'
import styles from './Booking.module.css'

function Booking() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [restaurant, setRestaurant] = useState(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [error, setError] = useState('')

  useEffect(() => {
    getRestaurantById(id).then(setRestaurant).catch(() => setError('Restaurant not found'))
  }, [id])

  const today = new Date().toISOString().split('T')[0]
  const canContinue = Boolean(date && time && partySize >= 1 && partySize <= 20 && date >= today)

  function changePartySize(amount) {
    setPartySize((current) => Math.min(20, Math.max(1, current + amount)))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!canContinue) return
    const params = new URLSearchParams({ date, time, partySize: String(partySize) })
    navigate(`/restaurants/${id}/book/tables?${params.toString()}`)
  }

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <Link to={`/restaurants/${id}`} className={styles.backLink}>&larr; Back to restaurant</Link>
        <div className={styles.stepHeader}>
          <div><span>Step 1 of 3</span><strong>Plan your visit</strong></div>
          <div className={styles.progress}><span /></div>
        </div>
        {error ? <p className={styles.error}>{error}</p> : (
          <>
            <p className={styles.eyebrow}>Reserve a table</p>
            <h1>{restaurant?.name || 'Your reservation'}</h1>
            <p className={styles.intro}>Choose a date, time, and party size. We&apos;ll find the right table next.</p>
            <form className={styles.form} onSubmit={handleSubmit}>
              <label htmlFor="booking-date">Date</label>
              <input id="booking-date" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} required />
              <label htmlFor="booking-time">Time</label>
              <input id="booking-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
              <fieldset>
                <legend>Party size</legend>
                <div className={styles.stepper}>
                  <button type="button" onClick={() => changePartySize(-1)} aria-label="Decrease party size">-</button>
                  <strong>{partySize}</strong>
                  <button type="button" onClick={() => changePartySize(1)} aria-label="Increase party size">+</button>
                </div>
                <small>Between 1 and 20 guests</small>
              </fieldset>
              <button type="submit" className={styles.continueButton} disabled={!canContinue}>Continue to table selection <span aria-hidden="true">&rarr;</span></button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}

export default Booking
