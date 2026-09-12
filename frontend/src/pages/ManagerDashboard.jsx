import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import FloorPlanGrid from '../components/FloorPlanGrid/FloorPlanGrid'
import { useAuth } from '../context/AuthContext'
import { useSocket, useSocketEvent } from '../context/SocketContext'
import { getRestaurantById, updateRestaurantSettings } from '../services/restaurantService'
import {
  getManagerFloorLayout,
  getManagerKitchenQueue,
  getManagerReservations,
  getManagerWaitlist,
} from '../services/managerService'
import styles from './ManagerPages.module.css'

const emptySnapshot = { approvals: 0, waitlist: 0, kitchen: 0, floor: { tables: [], elements: [] } }

function ManagerDashboard() {
  const { user } = useAuth()
  const { joinRestaurantRoom } = useSocket()
  const [snapshot, setSnapshot] = useState(emptySnapshot)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [seatingDuration, setSeatingDuration] = useState(60)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')

  const loadSnapshot = useCallback(async () => {
    try {
      const [floor, approvals, waitlist, kitchen] = await Promise.all([
        getManagerFloorLayout(),
        getManagerReservations({ requiresApproval: 'true', status: ['locked'] }),
        getManagerWaitlist(),
        getManagerKitchenQueue(),
      ])
      setSnapshot({
        floor,
        approvals: approvals.length,
        waitlist: waitlist.filter((entry) => ['waiting', 'notified'].includes(entry.status)).length,
        kitchen: kitchen.length,
      })
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to load the manager snapshot.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.restaurantId) joinRestaurantRoom(user.restaurantId)
    loadSnapshot()
    if (user?.restaurantId) getRestaurantById(user.restaurantId).then((restaurant) => setSeatingDuration(restaurant.defaultSeatingDurationMinutes || 60)).catch(() => {})
  }, [joinRestaurantRoom, loadSnapshot, user?.restaurantId])

  async function saveSettings(event) {
    event.preventDefault()
    setIsSavingSettings(true)
    setSettingsMessage('')
    try {
      const response = await updateRestaurantSettings(user.restaurantId, { defaultSeatingDurationMinutes: Number(seatingDuration) })
      setSeatingDuration(response.restaurant.defaultSeatingDurationMinutes)
      setSettingsMessage('Saved.')
    } catch (requestError) {
      setSettingsMessage(requestError.message || 'Unable to save seating time.')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleLiveUpdate = useCallback(() => { loadSnapshot() }, [loadSnapshot])
  useSocketEvent('table:statusChanged', handleLiveUpdate)
  useSocketEvent('reservation:approvalNeeded', handleLiveUpdate)
  useSocketEvent('waitlist:notified', handleLiveUpdate)

  return (
    <div>
      <header className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>Manager workspace</p><h1>Good service starts here.</h1><p>One clear view of the room, the queue, and what needs your attention.</p></div>
      </header>
      {isLoading && <p className={styles.status}>Loading your snapshot...</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.dashboardGrid}>
        <section className={`${styles.panel} ${styles.floorPreview}`}>
          <div className={styles.panelHeading}><div><span className={styles.panelKicker}>Live room</span><h2>Floor plan</h2></div><Link to="/manager/floor-plan" className={styles.textLink}>Open &rarr;</Link></div>
          <FloorPlanGrid compact mode="view-only" tables={snapshot.floor.tables} elements={snapshot.floor.elements} />
        </section>
        <div className={styles.snapshotStack}>
          <Link to="/manager/approvals" className={styles.statCard}><span className={styles.statLabel}>Pending approvals</span><strong>{snapshot.approvals}</strong><span>Needs a decision &rarr;</span></Link>
          <Link to="/manager/waitlist" className={styles.statCard}><span className={styles.statLabel}>Active waitlist</span><strong>{snapshot.waitlist}</strong><span>Guests in motion &rarr;</span></Link>
          <div className={styles.statCard}><span className={styles.statLabel}>Kitchen queue</span><strong>{snapshot.kitchen}</strong><span>Current open orders</span></div>
        </div>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><span className={styles.panelKicker}>Reservation settings</span><h2>Average seating time</h2></div></div>
        <form className={styles.formGrid} onSubmit={saveSettings}>
          <label>Minutes per seating<input type="number" min="15" max="240" step="1" value={seatingDuration} onChange={(event) => setSeatingDuration(event.target.value)} /></label>
          <div><button type="submit" className={styles.primaryButton} disabled={isSavingSettings || !user?.restaurantId}>{isSavingSettings ? 'Saving...' : 'Save seating time'}</button>{settingsMessage && <p className={styles.status} role="status">{settingsMessage}</p>}</div>
        </form>
      </section>
    </div>
  )
}

export default ManagerDashboard
