import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { getRestaurantById } from '../services/restaurantService'
import styles from './Booking.module.css'

const RESERVATION_LEAD_TIME_MINUTES = 30

const formatLocalDate = (value = new Date()) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatLocalTime = (value) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`

const getMinimumTodayTime = (now = new Date()) => {
  const minimum = new Date(now.getTime() + RESERVATION_LEAD_TIME_MINUTES * 60 * 1000)
  minimum.setSeconds(0, 0)
  if (now.getSeconds() > 0 || now.getMilliseconds() > 0) minimum.setMinutes(minimum.getMinutes() + 1)
  return minimum
}

const isBookingTimeValid = (selectedDate, selectedTime, now = new Date()) => {
  if (!selectedDate || !selectedTime || selectedDate < formatLocalDate(now)) return false
  if (selectedDate > formatLocalDate(now)) return true

  const [hours, minutes] = selectedTime.split(':').map(Number)
  const selectedDateTime = new Date(now)
  selectedDateTime.setHours(hours, minutes, 0, 0)
  return selectedDateTime.getTime() >= now.getTime() + RESERVATION_LEAD_TIME_MINUTES * 60 * 1000
}

function Booking() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [restaurant, setRestaurant] = useState(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [error, setError] = useState('')
  const [timeMessage, setTimeMessage] = useState('')

  useEffect(() => {
    getRestaurantById(id).then(setRestaurant).catch(() => setError('Restaurant not found'))
  }, [id])

  const today = formatLocalDate()
  const minimumTime = date === today ? formatLocalTime(getMinimumTodayTime()) : undefined
  const canContinue = Boolean(date && time && partySize >= 1 && partySize <= 20 && date >= today && isBookingTimeValid(date, time))

  function changePartySize(amount) {
    setPartySize((current) => Math.min(20, Math.max(1, current + amount)))
  }

  function handleDateChange(event) {
    const nextDate = event.target.value
    setDate(nextDate)

    if (time && !isBookingTimeValid(nextDate, time)) {
      setTime('')
      setTimeMessage('That time is no longer available for this date. Please choose a new time.')
    } else {
      setTimeMessage('')
    }
  }

  function handleTimeChange(event) {
    const nextTime = event.target.value
    setTime(nextTime)
    setTimeMessage(isBookingTimeValid(date, nextTime) ? '' : 'Please choose a time at least 30 minutes from now.')
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!isBookingTimeValid(date, time)) {
      setTimeMessage('Please choose a time at least 30 minutes from now.')
      return
    }
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
              <input id="booking-date" type="date" min={today} value={date} onChange={handleDateChange} required />
              <label htmlFor="booking-time">Time</label>
              <input id="booking-time" type="time" min={minimumTime} value={time} onChange={handleTimeChange} required />
              {timeMessage && <p className={styles.error} role="alert">{timeMessage}</p>}
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
