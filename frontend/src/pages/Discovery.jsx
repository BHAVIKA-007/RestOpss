import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { getRestaurants } from '../services/restaurantService'
import styles from './Discovery.module.css'

const cuisines = ['Italian', 'French', 'Chinese', 'Mexican', 'Japanese', 'Indian', 'Vegan', 'Mediterranean']

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.searchIcon}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}

function Discovery() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedCuisine, setSelectedCuisine] = useState('')
  const [restaurants, setRestaurants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true)
      setError('')
      getRestaurants({ cuisine: selectedCuisine, search })
        .then(setRestaurants)
        .catch((requestError) => setError(requestError.message || 'Unable to load restaurants.'))
        .finally(() => setIsLoading(false))
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [search, selectedCuisine])

  function toggleCuisine(cuisine) {
    setSelectedCuisine((current) => current === cuisine ? '' : cuisine)
  }

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <section className={styles.heading}>
          <p className={styles.eyebrow}>Find your next table</p>
          <h1>Good food is<br />closer than you think.</h1>
          <p>Explore restaurants worth making plans for.</p>
        </section>

        <div className={styles.searchShell}>
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by restaurant name"
            aria-label="Search by restaurant name"
          />
        </div>

        <div className={styles.filters} aria-label="Filter by cuisine">
          <button type="button" className={!selectedCuisine ? styles.activeChip : styles.chip} onClick={() => setSelectedCuisine('')}>All</button>
          {cuisines.map((cuisine) => (
            <button
              type="button"
              className={selectedCuisine === cuisine ? styles.activeChip : styles.chip}
              key={cuisine}
              onClick={() => toggleCuisine(cuisine)}
            >
              {cuisine}
            </button>
          ))}
        </div>

        <div className={styles.resultsHeader}>
          <h2>Restaurants for you</h2>
          {!isLoading && <span>{restaurants.length} found</span>}
        </div>

        {isLoading && <p className={styles.status}>Finding your next favorite...</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!isLoading && !error && restaurants.length === 0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden="true">&#127869;</span>
            <h2>No restaurants found</h2>
            <p>Try a different name or cuisine, and we&apos;ll keep looking.</p>
          </div>
        )}
        {!isLoading && !error && restaurants.length > 0 && (
          <div className={styles.grid}>
            {restaurants.map((restaurant, index) => (
              <button type="button" className={styles.card} key={restaurant._id} onClick={() => navigate(`/restaurants/${restaurant._id}`)}>
                <div className={`${styles.imagePlaceholder} ${styles[`image${index % 4}`]}`}>
                  <span aria-hidden="true">{index % 2 === 0 ? '\u{1F37D}\uFE0F' : '\u{1F964}'}</span>
                  <span className={styles.rating}>&#9733; 4.5 <small>placeholder</small></span>
                </div>
                <div className={styles.cardBody}>
                  <h3>{restaurant.name}</h3>
                  <p>{restaurant.address || 'Address coming soon'}</p>
                  <div className={styles.tags}>
                    {(restaurant.cuisine || []).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        <Link to="/" className={styles.homeLink}>Back to RestOps home</Link>
      </main>
    </div>
  )
}

export default Discovery
