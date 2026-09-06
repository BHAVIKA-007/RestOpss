import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { getMyRestaurants } from '../services/ownerService'
import styles from './OwnerDashboard.module.css'

function OwnerDashboard() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyRestaurants()
      .then(setRestaurants)
      .catch((requestError) => setError(requestError.message || 'Unable to load your restaurants.'))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Owner workspace</p>
            <h1>Your restaurants</h1>
            <p>Keep an eye on each room, one restaurant at a time.</p>
          </div>
          <Link to="/owner/restaurants/new" className={styles.primaryButton}>+ New Restaurant</Link>
        </header>

        {isLoading && <p className={styles.status}>Loading your restaurants...</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}

        {!isLoading && !error && restaurants.length === 0 && (
          <section className={styles.emptyState}>
            <span className={styles.emptyMark}>+</span>
            <p className={styles.eyebrow}>A fresh start</p>
            <h2>Create your first restaurant</h2>
            <p>Your owner workspace will take shape as soon as you add a restaurant.</p>
            <Link to="/owner/restaurants/new" className={styles.primaryButton}>Create restaurant</Link>
          </section>
        )}

        {!isLoading && !error && restaurants.length > 0 && (
          <div className={styles.grid}>
            {restaurants.map((restaurant) => (
              <article className={styles.restaurantCard} key={restaurant._id}>
                <button
                  type="button"
                  className={styles.cardBody}
                  onClick={() => navigate(`/owner/restaurants/${restaurant._id}/overview`)}
                >
                  <span className={styles.cardKicker}>Restaurant</span>
                  <h2>{restaurant.name}</h2>
                  <p>{restaurant.address || 'Address not added yet'}</p>
                  <span className={styles.cardArrow} aria-hidden="true">&rarr;</span>
                </button>
                <div className={styles.cardFooter}>
                  <div>
                    <span className={styles.footerLabel}>Manager</span>
                    {restaurant.manager ? (
                      <strong>{restaurant.manager.name}</strong>
                    ) : (
                      <span className={styles.muted}>No manager assigned</span>
                    )}
                  </div>
                  <Link to={`/owner/restaurants/${restaurant._id}/manager`} className={styles.manageLink}>
                    {restaurant.manager ? 'Manage' : 'Assign one'} <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
                <div className={styles.stats} aria-label="Restaurant quick stats">
                  <span>&mdash; reservations today</span>
                  <span>&mdash; tables</span>
                </div>
              </article>
            ))}
            <Link to="/owner/restaurants/new" className={styles.newCard}>
              <span className={styles.emptyMark}>+</span>
              <strong>Add another restaurant</strong>
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}

export default OwnerDashboard
