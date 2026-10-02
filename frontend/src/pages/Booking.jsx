import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { getRestaurantById, getRestaurantMaxCapacity } from '../services/restaurantService'
import styles from './Booking.module.css'
import { useTiming } from '../context/TimingContext'

const DEFAULT_PARTY_SIZE_UPPER_BOUND = 30

const formatLocalDate = (value = new Date()) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatLocalTime = (value) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`

const getMinimumTodayTime = (leadTimeMinutes, now = new Date()) => {
  const minimum = new Date(now.getTime() + leadTimeMinutes * 60 * 1000)
  minimum.setSeconds(0, 0)
  if (now.getSeconds() > 0 || now.getMilliseconds() > 0) minimum.setMinutes(minimum.getMinutes() + 1)
  return minimum
}

const isBookingTimeValid = (selectedDate, selectedTime, leadTimeMinutes, now = new Date()) => {
  if (!selectedDate || !selectedTime || selectedDate < formatLocalDate(now)) return false
  if (selectedDate > formatLocalDate(now)) return true

  const [hours, minutes] = selectedTime.split(':').map(Number)
  const selectedDateTime = new Date(now)
  selectedDateTime.setHours(hours, minutes, 0, 0)
  return selectedDateTime.getTime() >= now.getTime() + leadTimeMinutes * 60 * 1000
}

function Booking() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const timing = useTiming()
  const [restaurant, setRestaurant] = useState(null)
  const [date, setDate] = useState(() => searchParams.get('date') || '')
  const [time, setTime] = useState(() => searchParams.get('time') || '')
  const [partySize, setPartySize] = useState(() => Number(searchParams.get('partySize')) || 2)
  const [partySizeUpperBound, setPartySizeUpperBound] = useState(DEFAULT_PARTY_SIZE_UPPER_BOUND)
  const [error, setError] = useState('')
  const [timeMessage, setTimeMessage] = useState('')

  useEffect(() => {
    getRestaurantById(id).then(setRestaurant).catch(() => setError('Restaurant not found'))
    getRestaurantMaxCapacity(id)
      .then(({ maxCapacity }) => {
        const computedMaxCapacity = Number(maxCapacity)
        if (Number.isFinite(computedMaxCapacity) && computedMaxCapacity > 0) {
          setPartySizeUpperBound(Math.ceil(computedMaxCapacity * 1.1))
        } else {
          setPartySizeUpperBound(DEFAULT_PARTY_SIZE_UPPER_BOUND)
        }
      })
      .catch(() => setPartySizeUpperBound(DEFAULT_PARTY_SIZE_UPPER_BOUND))
  }, [id])

  const today = formatLocalDate()
  const minimumTime = date === today && timing ? formatLocalTime(getMinimumTodayTime(timing.reservationLeadTimeMinutes)) : undefined
  const canContinue = Boolean(timing && date && time && partySize >= 1 && partySize <= partySizeUpperBound && date >= today && isBookingTimeValid(date, time, timing.reservationLeadTimeMinutes))

  function changePartySize(amount) {
    setPartySize((current) => Math.min(partySizeUpperBound, Math.max(1, current + amount)))
  }

  function handleDateChange(event) {
    const nextDate = event.target.value
    setDate(nextDate)

    if (time && timing && !isBookingTimeValid(nextDate, time, timing.reservationLeadTimeMinutes)) {
      setTime('')
      setTimeMessage('That time is no longer available for this date. Please choose a new time.')
    } else {
      setTimeMessage('')
    }
  }

  function handleTimeChange(event) {
    const nextTime = event.target.value
    setTime(nextTime)
    setTimeMessage(timing && isBookingTimeValid(date, nextTime, timing.reservationLeadTimeMinutes) ? '' : 'Please choose a valid time.')
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!timing || !isBookingTimeValid(date, time, timing.reservationLeadTimeMinutes)) {
      setTimeMessage('Please choose a valid time.')
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
                <small>Between 1 and {partySizeUpperBound} guests</small>
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
