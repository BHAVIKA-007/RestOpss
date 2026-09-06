import { useCallback, useEffect, useState } from 'react'
import FloorPlanGrid from '../components/FloorPlanGrid/FloorPlanGrid'
import { useSocketEvent } from '../context/SocketContext'
import { approveManagerReservation, getManagerFloorLayout, getManagerReservations, rejectManagerReservation } from '../services/managerService'
import styles from './ManagerPages.module.css'

function reservationTableIds(reservation) { return (reservation.tables || []).map((table) => typeof table === 'string' ? table : table._id) }

function ManagerApprovals() {
  const [approvals, setApprovals] = useState([])
  const [floor, setFloor] = useState({ tables: [], elements: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')

  const loadApprovals = useCallback(async () => {
    try { setApprovals(await getManagerReservations({ requiresApproval: 'true', status: ['locked'] })); setError('') } catch (requestError) { setError(requestError.message || 'Unable to load approvals.') } finally { setIsLoading(false) }
  }, [])

  useEffect(() => {
    loadApprovals()
    getManagerFloorLayout().then(setFloor).catch(() => {})
  }, [loadApprovals])
  useSocketEvent('reservation:approvalNeeded', loadApprovals)

  async function handleDecision(id, approve) {
    setWorkingId(id)
    setError('')
    try {
      if (approve) await approveManagerReservation(id)
      else await rejectManagerReservation(id)
      setApprovals((current) => current.filter((reservation) => reservation._id !== id))
    } catch (requestError) { setError(requestError.message || 'Unable to update this approval.') } finally { setWorkingId('') }
  }

  return (
    <div>
      <header className={styles.pageHeading}><p className={styles.eyebrow}>Manager workspace</p><h1>Approvals, kept moving.</h1><p>Review combination requests before the room commits those tables.</p></header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {isLoading ? <p className={styles.status}>Loading approval queue...</p> : approvals.length === 0 ? <section className={styles.emptyPanel}><h2>No pending approvals right now.</h2><p>New combination requests will appear here as they arrive.</p></section> : <div className={styles.approvalList}>{approvals.map((reservation) => <article className={styles.approvalCard} key={reservation._id}><div><span className={styles.panelKicker}>Requested {new Date(reservation.timeSlot).toLocaleString()}</span><h2>Party of {reservation.partySize}</h2><p>{reservation.tables?.length || 0} tables requested</p><div className={styles.approvalActions}><button type="button" className={styles.primaryButton} disabled={workingId === reservation._id} onClick={() => handleDecision(reservation._id, true)}>Approve</button><button type="button" className={styles.smallDanger} disabled={workingId === reservation._id} onClick={() => handleDecision(reservation._id, false)}>Reject</button></div></div><div className={styles.approvalPlan}><FloorPlanGrid compact mode="view-only" tables={floor.tables} elements={floor.elements} selectedTableIds={reservationTableIds(reservation)} /></div></article>)}</div>}
    </div>
  )
}

export default ManagerApprovals
