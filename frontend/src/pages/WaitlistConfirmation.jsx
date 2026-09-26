import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { getRestaurantById } from '../services/restaurantService'
import styles from './WaitlistConfirmation.module.css'

function WaitlistConfirmation() {
  const [searchParams] = useSearchParams()
  const restaurantId = searchParams.get('restaurantId') || ''
  const timeSlot = searchParams.get('timeSlot')
  const partySize = searchParams.get('partySize')
  const needsManagerReview = searchParams.get('needsManagerReview') === 'true'
  const [restaurantName, setRestaurantName] = useState('the restaurant')

  useEffect(() => {
    if (restaurantId) getRestaurantById(restaurantId).then((restaurant) => setRestaurantName(restaurant.name)).catch(() => {})
  }, [restaurantId])

  const requestedTime = timeSlot ? new Date(timeSlot).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) : 'your requested time'

  return <div className={styles.page}><NavBar /><main className={styles.content}><p className={styles.eyebrow}>Waitlist request</p><h1>You&apos;re on the list.</h1><p className={styles.message}>You&apos;re on the waitlist for <strong>{restaurantName}</strong> at <strong>{requestedTime}</strong>{partySize ? ` for ${partySize} guests` : ''}. We&apos;ll notify you if a table opens up.</p>{needsManagerReview && <p className={styles.review}>Your party size also needs manager review. The restaurant will review your request.</p>}<div className={styles.actions}><Link to="/customer/waitlist">My Waitlist Requests</Link><Link to="/restaurants">Explore restaurants</Link></div></main></div>
}

export default WaitlistConfirmation