import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import {
  assignManager,
  getMyRestaurants,
  lookupUserByEmail,
  removeManager,
  replaceManager,
} from '../services/ownerService'
import styles from './ManagerAssignment.module.css'

function ManagerAssignment() {
  const { id } = useParams()
  const [restaurant, setRestaurant] = useState(null)
  const [email, setEmail] = useState('')
  const [candidate, setCandidate] = useState(null)
  const [isReplacing, setIsReplacing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  const refreshRestaurant = useCallback(async () => {
    const restaurants = await getMyRestaurants()
    const current = restaurants.find((item) => item._id === id)
    if (!current) {
      setNotFound(true)
      return
    }
    setRestaurant(current)
  }, [id])

  useEffect(() => {
    refreshRestaurant()
      .catch((requestError) => setError(requestError.message || 'Unable to load this restaurant.'))
      .finally(() => setIsLoading(false))
  }, [refreshRestaurant])

  async function handleFind(event) {
    event.preventDefault()
    if (!email.trim()) {
      setError('Enter an email address to search.')
      return
    }

    setError('')
    setCandidate(null)
    setIsWorking(true)
    try {
      const user = await lookupUserByEmail(email.trim())
      setCandidate(user)
    } catch (requestError) {
      setError(requestError.status === 404
        ? 'No user found with this email — they need to register first.'
        : requestError.message || 'Unable to look up that user.')
    } finally {
      setIsWorking(false)
    }
  }

  async function handleManagerSave() {
    if (!candidate) return
    setError('')
    setIsWorking(true)
    try {
      if (isReplacing) {
        await replaceManager(id, candidate._id)
      } else {
        await assignManager(id, candidate._id)
      }
      await refreshRestaurant()
      setCandidate(null)
      setEmail('')
      setIsReplacing(false)
    } catch (requestError) {
      const message = requestError.message || ''
      setError(message.toLowerCase().includes('already a manager')
        ? 'This user already manages another restaurant. Choose a user who is not currently assigned elsewhere.'
        : message || 'Unable to save this manager assignment.')
    } finally {
      setIsWorking(false)
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remove this manager from the restaurant?')) return

    setError('')
    setIsWorking(true)
    try {
      await removeManager(id)
      await refreshRestaurant()
    } catch (requestError) {
      setError(requestError.message || 'Unable to remove this manager.')
    } finally {
      setIsWorking(false)
    }
  }

  function startReplacing() {
    setIsReplacing(true)
    setCandidate(null)
    setEmail('')
    setError('')
  }

  function cancelReplacing() {
    setIsReplacing(false)
    setCandidate(null)
    setEmail('')
    setError('')
  }

  const showForm = !restaurant?.manager || isReplacing

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <Link to="/owner" className={styles.backLink}>&larr; Back to restaurants</Link>
        {isLoading && <p className={styles.status}>Loading restaurant details...</p>}
        {notFound && !isLoading && <p className={styles.error} role="alert">That restaurant is not in your owner workspace.</p>}
        {!isLoading && restaurant && (
          <>
            <header className={styles.heading}>
              <p className={styles.eyebrow}>Restaurant management</p>
              <h1>{restaurant.name}</h1>
              <p>Choose one person to lead this restaurant&apos;s day-to-day team.</p>
            </header>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {restaurant.manager && !isReplacing && (
              <section className={styles.managerCard}>
                <div>
                  <span className={styles.cardLabel}>Current manager</span>
                  <h2>{restaurant.manager.name}</h2>
                  <p>{restaurant.manager.email}</p>
                </div>
                <div className={styles.actions}>
                  <button type="button" className={styles.secondaryButton} onClick={startReplacing}>Replace Manager</button>
                  <button type="button" className={styles.dangerButton} onClick={handleRemove} disabled={isWorking}>Remove Manager</button>
                </div>
              </section>
            )}
            {showForm && (
              <section className={styles.formPanel}>
                <div className={styles.panelHeading}>
                  <div>
                    <span className={styles.cardLabel}>{isReplacing ? 'Replace manager' : 'Assign manager'}</span>
                    <h2>{isReplacing ? 'Find a new manager' : 'Find someone to lead the room'}</h2>
                  </div>
                  {isReplacing && <button type="button" className={styles.textButton} onClick={cancelReplacing}>Cancel</button>}
                </div>
                <form onSubmit={handleFind} className={styles.searchForm}>
                  <label htmlFor="manager-email">User email</label>
                  <div className={styles.searchRow}>
                    <input id="manager-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="manager@example.com" />
                    <button type="submit" className={styles.primaryButton} disabled={isWorking}>{isWorking ? 'Searching...' : 'Find User'}</button>
                  </div>
                </form>
                {candidate && (
                  <div className={styles.candidateCard}>
                    <div><span className={styles.cardLabel}>User found</span><h3>{candidate.name}</h3><p>{candidate.email}</p></div>
                    <button type="button" className={styles.primaryButton} onClick={handleManagerSave} disabled={isWorking}>{isWorking ? 'Saving...' : isReplacing ? 'Replace Manager' : 'Assign as Manager'}</button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default ManagerAssignment
