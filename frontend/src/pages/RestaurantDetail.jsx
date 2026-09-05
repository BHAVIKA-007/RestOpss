import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { useAuth } from '../context/AuthContext'
import { getMenuByRestaurantId, getRestaurantById } from '../services/restaurantService'
import styles from './RestaurantDetail.module.css'

function RestaurantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [restaurant, setRestaurant] = useState(null)
  const [menu, setMenu] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [menuLoading, setMenuLoading] = useState(false)
  const [error, setError] = useState('')
  const [menuMessage, setMenuMessage] = useState('')

  useEffect(() => {
    setIsLoading(true)
    getRestaurantById(id)
      .then(setRestaurant)
      .catch((requestError) => setError(requestError.message || 'Restaurant not found'))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => {
    if (!user) {
      setMenuMessage('Log in to view the full menu.')
      return
    }

    setMenuLoading(true)
    getMenuByRestaurantId(id)
      .then(setMenu)
      .catch(() => setMenuMessage('The menu is temporarily unavailable.'))
      .finally(() => setMenuLoading(false))
  }, [id, user])

  if (isLoading) return <div className="routeLoading">Loading restaurant...</div>
  if (error || !restaurant) {
    return (
      <div className={styles.page}>
        <NavBar />
        <main className={styles.notFound}>
          <p className={styles.eyebrow}>A wrong turn</p>
          <h1>Restaurant not found</h1>
          <p>We couldn&apos;t find the restaurant you were looking for.</p>
          <Link to="/restaurants" className={styles.secondaryButton}>Back to discovery</Link>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <Link to="/restaurants" className={styles.backLink}>&larr; All restaurants</Link>
        <section className={styles.hero}>
          <div className={styles.heroImage} aria-hidden="true">&#127869;</div>
          <div className={styles.heroInfo}>
            <p className={styles.eyebrow}>Restaurant</p>
            <h1>{restaurant.name}</h1>
            <p className={styles.address}>{restaurant.address || 'Address coming soon'}</p>
            {restaurant.phone && <p className={styles.phone}>{restaurant.phone}</p>}
            <div className={styles.tags}>
              {(restaurant.cuisine || []).map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          </div>
        </section>

        <section className={styles.menuSection}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>A taste of what&apos;s next</p>
              <h2>Menu preview</h2>
            </div>
            {user && <Link to={`/restaurants/${id}/menu`} className={styles.menuLink}>View full menu &rarr;</Link>}
          </div>
          {menuLoading && <p className={styles.muted}>Loading menu...</p>}
          {!menuLoading && menuMessage && <p className={styles.notice}>{menuMessage} {!user && <Link to="/login">Log in</Link>}</p>}
          {!menuLoading && !menuMessage && menu.length === 0 && <p className={styles.muted}>Menu items are coming soon.</p>}
          {!menuLoading && !menuMessage && menu.length > 0 && (
            <div className={styles.menuList}>
              {menu.slice(0, 5).map((item) => (
                <div className={styles.menuItem} key={item._id}>
                  <div><h3>{item.name}</h3><p>{item.description || 'A house favorite.'}</p></div>
                  <strong>${Number(item.price).toFixed(2)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <button type="button" className={styles.bookButton} onClick={() => navigate(`/restaurants/${id}/book`)}>Book a table</button>
      </main>
    </div>
  )
}

export default RestaurantDetail
