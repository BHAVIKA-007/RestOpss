import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import FloorPlanGrid from '../components/FloorPlanGrid/FloorPlanGrid'
import { useSocket, useSocketEvent } from '../context/SocketContext'
import { getMenuByRestaurantId } from '../services/restaurantService'
import { createReservation, getFloorLayout, suggestCombination } from '../services/reservationService'
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
  const [selectedTableIds, setSelectedTableIds] = useState([])
  const [menu, setMenu] = useState([])
  const [quantities, setQuantities] = useState({})
  const [showMenu, setShowMenu] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
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
    ])
      .then(([layout, rankedSuggestions]) => {
        setTables(layout.tables || [])
        setElements(layout.elements || [])
        setSuggestions(rankedSuggestions || [])
      })
      .catch((requestError) => setError(requestError.message || 'Unable to load table availability.'))
      .finally(() => setIsLoading(false))
  }, [id, joinRestaurantRoom, partySize, timeSlot])

  useEffect(() => {
    if (!showMenu) return
    getMenuByRestaurantId(id).then(setMenu).catch(() => setMenu([]))
  }, [id, showMenu])

  const topIsSingle = suggestions[0]?.tableCount === 1
  const validSingleIds = suggestions.filter((suggestion) => suggestion.tableCount === 1).map((suggestion) => suggestion.tableIds[0])
  const chosenTableIds = selectedSuggestion?.tableIds || selectedTableIds
  const orderItems = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity }))

  function chooseTable(tableId) {
    if (topIsSingle && validSingleIds.includes(tableId)) setSelectedTableIds([tableId])
  }

  function chooseSuggestion(suggestion) {
    setSelectedSuggestion(suggestion)
    setSelectedTableIds([])
  }

  function updateQuantity(menuItemId, amount) {
    setQuantities((current) => ({ ...current, [menuItemId]: Math.max(0, (current[menuItemId] || 0) + amount) }))
  }

  async function handleBooking() {
    if (!chosenTableIds.length) return
    setIsSubmitting(true)
    setError('')
    try {
      const response = await createReservation({ restaurantId: id, tableIds: chosenTableIds, partySize, timeSlot, durationMinutes: 90 })
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
        <p className={styles.intro}>Available tables are shown in green. Combined tables require a quick host approval.</p>
        <dl className={styles.summary}>
          <div><dt>Date</dt><dd>{searchParams.get('date')}</dd></div>
          <div><dt>Time</dt><dd>{searchParams.get('time')}</dd></div>
          <div><dt>Party</dt><dd>{searchParams.get('partySize')} guests</dd></div>
        </dl>
        {isLoading && <p className={styles.status}>Checking the floor plan...</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!isLoading && !error && (
          <>
            <FloorPlanGrid tables={tables} elements={elements} selectedTableIds={chosenTableIds} onTableClick={chooseTable} />
            {topIsSingle ? (
              <p className={styles.helper}>Select an available table that fits your party.</p>
            ) : suggestions.length > 0 ? (
              <section className={styles.suggestions}>
                <h2>Suggested combinations</h2>
                {suggestions.map((suggestion, index) => (
                  <button type="button" key={suggestion.tableIds.join('-')} className={selectedSuggestion === suggestion ? styles.suggestionSelected : styles.suggestion} onClick={() => chooseSuggestion(suggestion)}>
                    <span><strong>Option {index + 1}</strong><small>{suggestion.tableIds.length} tables &middot; {suggestion.totalCapacity} seats</small></span>
                    <em>Requires host approval</em>
                  </button>
                ))}
              </section>
            ) : (
              <div className={styles.empty}><h2>No tables available for this party size/time</h2><p>Try another time or a smaller party size.</p></div>
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
