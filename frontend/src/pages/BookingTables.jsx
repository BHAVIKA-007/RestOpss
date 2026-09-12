import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import FloorPlanGrid from '../components/FloorPlanGrid/FloorPlanGrid'
import { useSocket, useSocketEvent } from '../context/SocketContext'
import { getMenuByRestaurantId } from '../services/restaurantService'
import { createReservation, getFloorLayout, getTableAvailability, joinWaitlist, suggestCombination } from '../services/reservationService'
import styles from './BookingTables.module.css'

function BookingTables() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { joinRestaurantRoom } = useSocket()
  const date = searchParams.get('date') || ''
  const time = searchParams.get('time') || ''
  const partySize = Number(searchParams.get('partySize') || 0)
  const timeSlot = useMemo(() => {
    const parsed = new Date(`${date}T${time}`)
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
  }, [date, time])
  const [tables, setTables] = useState([])
  const [elements, setElements] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [menu, setMenu] = useState([])
  const [quantities, setQuantities] = useState({})
  const [showMenu, setShowMenu] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState(null)
  const [hoveredSuggestion, setHoveredSuggestion] = useState(null)
  const [availability, setAvailability] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false)
  const [waitlistMessage, setWaitlistMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleTableStatus = useCallback((event) => {
    setTables((current) => current.map((table) => table._id === event.tableId ? { ...table, status: event.status } : table))
  }, [])

  useSocketEvent('table:statusChanged', handleTableStatus)

  useEffect(() => {
    if (!timeSlot || !partySize) {
      setError('Return to the previous step and choose a valid date, time, and party size.')
      setIsLoading(false)
      return
    }

    joinRestaurantRoom(id)
    setIsLoading(true)
    Promise.all([
      getFloorLayout(id),
      suggestCombination({ restaurantId: id, partySize, timeSlot }),
      getTableAvailability({ restaurantId: id, timeSlot }),
    ])
      .then(([layout, rankedSuggestions, requestedAvailability]) => {
        setTables(layout.tables || [])
        setElements(layout.elements || [])
        setSuggestions(rankedSuggestions || [])
        setAvailability(Object.fromEntries((requestedAvailability || []).map((item) => [item.tableId, item.availableAtRequestedTime])))
      })
      .catch((requestError) => setError(requestError.message || 'Unable to load table availability.'))
      .finally(() => setIsLoading(false))
  }, [id, joinRestaurantRoom, partySize, timeSlot])

  useEffect(() => {
    if (!showMenu) return
    getMenuByRestaurantId(id).then(setMenu).catch(() => setMenu([]))
  }, [id, showMenu])

  const chosenTableIds = selectedSuggestion?.tableIds || []
  const orderItems = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity }))

  function chooseSuggestion(suggestion) {
    setSelectedSuggestion(suggestion)
  }

  function updateQuantity(menuItemId, amount) {
    setQuantities((current) => ({ ...current, [menuItemId]: Math.max(0, (current[menuItemId] || 0) + amount) }))
  }

  async function handleJoinWaitlist() {
    setIsJoiningWaitlist(true)
    setWaitlistMessage('')
    try {
      const response = await joinWaitlist(id, partySize)
      setWaitlistMessage(`You joined the waitlist at position ${response.position}.`)
    } catch (requestError) {
      setWaitlistMessage(requestError.message || 'Unable to join the waitlist.')
    } finally {
      setIsJoiningWaitlist(false)
    }
  }

  async function handleBooking() {
    if (!chosenTableIds.length) return
    setIsSubmitting(true)
    setError('')
    try {
      const response = await createReservation({ restaurantId: id, tableIds: chosenTableIds, partySize, timeSlot })
      navigate(`/reservations/${response._id}/confirm`, { state: { preOrder: orderItems } })
    } catch (requestError) {
      setError(requestError.message || 'Unable to hold that table. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <div className={styles.stepHeader}><span>Step 2 of 3</span><strong>Choose your table</strong><div><i /></div></div>
        <p className={styles.eyebrow}>Tables for your visit</p>
        <h1>Choose your table.</h1>
        <p className={styles.intro}>Choose one of the ranked table options below. Combined tables require a quick host approval.</p>
        <dl className={styles.summary}>
          <div><dt>Date</dt><dd>{searchParams.get('date')}</dd></div>
          <div><dt>Time</dt><dd>{searchParams.get('time')}</dd></div>
          <div><dt>Party</dt><dd>{searchParams.get('partySize')} guests</dd></div>
        </dl>
        {isLoading && <p className={styles.status}>Checking the floor plan...</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!isLoading && !error && (
          <>
            <FloorPlanGrid tables={tables} elements={elements} availabilityOverride={availability} selectedTableIds={chosenTableIds} highlightedTableIds={hoveredSuggestion?.tableIds || []} />
            {suggestions.length > 0 ? (
              <section className={styles.suggestions}>
                <h2>Available table options</h2>
                {suggestions.map((suggestion, index) => (
                  <button type="button" key={suggestion.tableIds.join('-')} className={selectedSuggestion === suggestion ? styles.suggestionSelected : styles.suggestion} onClick={() => chooseSuggestion(suggestion)} onMouseEnter={() => setHoveredSuggestion(suggestion)} onMouseLeave={() => setHoveredSuggestion(null)}>
                    <span><strong>Option {index + 1}</strong><small>{suggestion.tableIds.length === 1 ? '1 table' : `${suggestion.tableIds.length} tables`} &middot; {suggestion.totalCapacity} seats</small></span>
                    <em>{suggestion.tableIds.length > 1 ? 'Requires host approval' : 'Best fit'}</em>
                  </button>
                ))}
              </section>
            ) : (
              <div className={styles.empty}><h2>No suitable table for this party size at this time</h2><p>Try a different time, adjust your party size, or join the waitlist.</p><div className={styles.emptyActions}><Link to={`/restaurants/${id}/book`}>Try a different time or party size</Link><button type="button" onClick={handleJoinWaitlist} disabled={isJoiningWaitlist}>{isJoiningWaitlist ? 'Joining waitlist...' : 'Join the waitlist'}</button></div>{waitlistMessage && <p role="status">{waitlistMessage}</p>}</div>
            )}
            <section className={styles.preorder}>
              <button type="button" onClick={() => setShowMenu((current) => !current)}>{showMenu ? 'Hide menu' : 'Add items now? (optional)'}</button>
              {showMenu && <div className={styles.menuPicker}>{menu.length === 0 && <p>No menu items available.</p>}{menu.map((item) => <div key={item._id}><span><strong>{item.name}</strong><small>${Number(item.price).toFixed(2)}</small></span><div><button type="button" onClick={() => updateQuantity(item._id, -1)}>-</button><b>{quantities[item._id] || 0}</b><button type="button" onClick={() => updateQuantity(item._id, 1)}>+</button></div></div>)}</div>}
            </section>
            <button type="button" className={styles.bookButton} disabled={!chosenTableIds.length || isSubmitting || !suggestions.length} onClick={handleBooking}>{isSubmitting ? 'Holding table...' : chosenTableIds.length > 1 ? 'Book This Combination' : 'Book This Table'} <span>&rarr;</span></button>
          </>
        )}
        <Link to={`/restaurants/${id}/book`} className={styles.backLink}>Back to reservation details</Link>
      </main>
    </div>
  )
}

export default BookingTables
