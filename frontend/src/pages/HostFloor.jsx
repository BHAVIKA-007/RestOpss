import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import FloorPlanGrid from '../components/FloorPlanGrid/FloorPlanGrid'
import { useAuth } from '../context/AuthContext'
import { useSocket, useSocketEvent } from '../context/SocketContext'
import { getHostFloorLayout, getHostReservations, seatReservation, updateHostTableStatus } from '../services/hostService'
import styles from './HostPages.module.css'

const getId = (value) => typeof value === 'object' && value ? value._id : value
const SEATING_BUFFER_MINUTES = 15

function HostFloor() {
  const { user } = useAuth()
  const { joinRestaurantRoom } = useSocket()
  const [floor, setFloor] = useState({ tables: [], elements: [] })
  const [reservations, setReservations] = useState([])
  const [selectedTableId, setSelectedTableId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [layout, confirmed] = await Promise.all([getHostFloorLayout(), getHostReservations({ status: ['confirmed', 'seated'] })])
      setFloor(layout)
      setReservations(confirmed)
      setError('')
    } catch (requestError) { setError(requestError.message || 'Unable to load the live floor.') } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { if (user?.restaurantId) joinRestaurantRoom(user.restaurantId); load() }, [joinRestaurantRoom, load, user?.restaurantId])
  useSocketEvent('table:statusChanged', load)

  const selectedTable = floor.tables.find((table) => getId(table) === selectedTableId)
  const matchingReservations = reservations.filter((reservation) => reservation.tables?.some((table) => getId(table) === selectedTableId))
  const confirmedReservations = matchingReservations.filter((reservation) => reservation.status === 'confirmed')
  const seatedReservations = matchingReservations.filter((reservation) => reservation.status === 'seated')

  async function changeStatus(status) {
    setWorking(true); setError('')
    try { await updateHostTableStatus(selectedTableId, status); await load() } catch (requestError) { setError(requestError.message || 'Unable to update table status.') } finally { setWorking(false) }
  }

  async function seat(id) {
    setWorking(true); setError('')
    const reservation = reservations.find((item) => getId(item) === id)
    if (reservation && Date.now() < new Date(reservation.timeSlot).getTime() - SEATING_BUFFER_MINUTES * 60 * 1000) {
      setError('Too early to seat this reservation - please wait until closer to the reserved time')
      setWorking(false)
      return
    }
    try { await seatReservation(id); setSelectedTableId(''); await load() } catch (requestError) { setError(requestError.message || 'Unable to seat this reservation.') } finally { setWorking(false) }
  }

  return <div><header className={styles.heading}><div><p className={styles.eyebrow}>Host station</p><h1>Live floor.</h1><p>Keep the room moving with small, timely decisions.</p></div><Link to="/host/walkin" className={styles.primaryButton}>Seat walk-in</Link></header>{error && <p className={styles.error} role="alert">{error}</p>}{isLoading ? <p className={styles.status}>Loading the live floor...</p> : <section className={styles.panel + ' ' + styles.floorPanel}><FloorPlanGrid mode="host-action" tables={floor.tables} elements={floor.elements} selectedTableIds={selectedTableId ? [selectedTableId] : []} onTableClick={setSelectedTableId} />{selectedTable && <div className={styles.actionMenu}><span className={styles.label}>Table {selectedTable.number}</span><h2>{selectedTable.status}</h2>{(confirmedReservations.length > 0 || seatedReservations.length > 0) && <div className={styles.reservationPicker}><span className={styles.label}>{seatedReservations.length > 0 ? 'Current reservation' : 'Reservation details'}</span>{[...seatedReservations, ...confirmedReservations].map((reservation) => <div key={reservation._id}><strong>{reservation.customer?.name || 'Walk-in guest'}</strong><p>Party of {reservation.partySize} &middot; {new Date(reservation.timeSlot).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>{reservation.status === 'confirmed' && <button type="button" disabled={working} onClick={() => seat(reservation._id)}>Seat This Reservation</button>}</div>)}</div>}<p>Choose the next front-of-house action.</p><div className={styles.actionRow}>{selectedTable.status === 'cleaning' ? <button type="button" className={styles.actionButton} disabled={working} onClick={() => changeStatus('available')}>Mark as Available</button> : <button type="button" className={styles.actionButton} disabled={working} onClick={() => changeStatus('cleaning')}>Mark as Cleaning</button>}<Link to="/host/walkin" state={{ tableId: selectedTableId }} className={styles.secondaryButton}>Seat a Walk-in Here</Link></div></div>}</section>}</div>
}

export default HostFloor
