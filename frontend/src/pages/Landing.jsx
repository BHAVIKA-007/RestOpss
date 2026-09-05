import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Landing.module.css'

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.searchIcon}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.filterIcon}>
      <path d="M4 7h16M7 12h10M10 17h4" />
    </svg>
  )
}

function Landing() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.logo} aria-label="RestOps home">
          Rest<span>Ops</span>
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link to="/login" className={styles.loginLink}>Log in</Link>
          <Link to="/register" className={styles.primaryButton}>Get started</Link>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>A better seat is closer than you think</p>
            <h1>Make room for a meal worth remembering.</h1>
            <p className={styles.subheading}>
              Discover the right table at the right time, with less waiting and more enjoying.
            </p>
            <div className={styles.searchShell}>
              <SearchIcon />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search for a restaurant"
                aria-label="Search for a restaurant"
              />
              <button type="button" className={styles.filterButton} aria-label="Open filters">
                <FilterIcon />
              </button>
            </div>
            <div className={styles.quickLinks} aria-label="Popular searches">
              <span>Try searching</span>
              <button type="button" onClick={() => setSearchQuery('Italian')}>Italian</button>
              <button type="button" onClick={() => setSearchQuery('Rooftop')}>Rooftop</button>
              <button type="button" onClick={() => setSearchQuery('Date night')}>Date night</button>
            </div>
          </div>
          <div className={styles.heroAccent} aria-hidden="true">
            <span className={styles.accentCircle} />
            <span className={styles.accentLine} />
            <span className={styles.accentLabel}>Good tables<br />start here</span>
          </div>
        </section>

        <section className={styles.ownerSection}>
          <div>
            <p className={styles.ownerEyebrow}>For restaurant teams</p>
            <h2>Your tables, running beautifully.</h2>
            <p>Bring reservations, staff, and service into one calm, clear place.</p>
          </div>
          <Link to="/register" className={styles.ownerButton}>Grow with RestOps <span aria-hidden="true">&#8594;</span></Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>&copy; 2026 RestOps</span>
        <div className={styles.footerLinks}>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
          <a href="#terms">Terms</a>
        </div>
      </footer>
    </div>
  )
}

export default Landing