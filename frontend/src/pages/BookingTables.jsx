import { Link, useParams, useSearchParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import styles from './BookingTables.module.css'

function BookingTables() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <p className={styles.eyebrow}>Step 2 of 3</p>
        <h1>Choose your table.</h1>
        <p>Your table selection experience is coming next.</p>
        <dl>
          <div><dt>Date</dt><dd>{searchParams.get('date')}</dd></div>
          <div><dt>Time</dt><dd>{searchParams.get('time')}</dd></div>
          <div><dt>Party</dt><dd>{searchParams.get('partySize')} guests</dd></div>
        </dl>
        <Link to={`/restaurants/${id}/book`} className={styles.backLink}>Back to reservation details</Link>
      </main>
    </div>
  )
}

export default BookingTables
