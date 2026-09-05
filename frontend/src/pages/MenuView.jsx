import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { useAuth } from '../context/AuthContext'
import { getMenuByRestaurantId, getRestaurantById } from '../services/restaurantService'
import styles from './MenuView.module.css'

function MenuView() {
  const { id } = useParams()
  const { user } = useAuth()
  const [restaurant, setRestaurant] = useState(null)
  const [menu, setMenu] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    Promise.all([getRestaurantById(id), getMenuByRestaurantId(id)])
      .then(([restaurantData, menuData]) => {
        setRestaurant(restaurantData)
        setMenu(menuData)
      })
      .catch((requestError) => setError(requestError.message || 'Unable to load the menu.'))
      .finally(() => setIsLoading(false))
  }, [id, user])

  const groupedMenu = menu.reduce((groups, item) => {
    const category = item.category || 'Menu'
    groups[category] = [...(groups[category] || []), item]
    return groups
  }, {})

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <Link to={`/restaurants/${id}`} className={styles.backLink}>&larr; Back to restaurant</Link>
        {!user && (
          <section className={styles.loginNotice}>
            <p className={styles.eyebrow}>Menu access</p>
            <h1>Log in to view the full menu.</h1>
            <p>The restaurant menu is available to logged-in guests.</p>
            <Link to="/login" className={styles.primaryButton}>Log in</Link>
          </section>
        )}
        {user && isLoading && <p className={styles.status}>Loading the menu...</p>}
        {user && error && <p className={styles.error} role="alert">{error}</p>}
        {user && !isLoading && !error && restaurant && (
          <>
            <header className={styles.heading}>
              <p className={styles.eyebrow}>The menu</p>
              <h1>{restaurant.name}</h1>
              <p>{restaurant.address || 'A taste worth making time for.'}</p>
            </header>
            {Object.keys(groupedMenu).length === 0 && <p className={styles.status}>No available menu items yet.</p>}
            <div className={styles.categories}>
              {Object.entries(groupedMenu).map(([category, items]) => (
                <section key={category} className={styles.category}>
                  <h2>{category}</h2>
                  {items.map((item) => (
                    <article className={styles.item} key={item._id}>
                      <div><h3>{item.name}</h3><p>{item.description || 'A house favorite.'}</p></div>
                      <strong>${Number(item.price).toFixed(2)}</strong>
                    </article>
                  ))}
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default MenuView
