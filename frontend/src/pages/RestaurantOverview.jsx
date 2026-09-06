import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import FloorPlanGrid from '../components/FloorPlanGrid/FloorPlanGrid'
import NavBar from '../components/NavBar'
import StatusBadge from '../components/StatusBadge'
import {
  getFloorLayout,
  getMyRestaurants,
  getOwnerMenu,
  getOwnerStaff,
} from '../services/ownerService'
import styles from './RestaurantOverview.module.css'

const initialSection = { isLoading: true, error: '', data: null }

function RestaurantOverview() {
  const { id } = useParams()
  const [restaurant, setRestaurant] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [floor, setFloor] = useState(initialSection)
  const [menu, setMenu] = useState(initialSection)
  const [staff, setStaff] = useState(initialSection)

  useEffect(() => {
    let isCurrent = true

    async function loadOverview() {
      try {
        const restaurants = await getMyRestaurants()
        const current = restaurants.find((item) => item._id === id)
        if (!current) {
          setPageError('That restaurant is not in your owner workspace.')
          return
        }
        if (isCurrent) setRestaurant(current)

        const results = await Promise.allSettled([
          getFloorLayout(id),
          getOwnerMenu(id),
          getOwnerStaff(id),
        ])
        if (!isCurrent) return

        const [floorResult, menuResult, staffResult] = results
        setFloor({ isLoading: false, error: floorResult.status === 'rejected' ? floorResult.reason?.message : '', data: floorResult.status === 'fulfilled' ? floorResult.value : null })
        setMenu({ isLoading: false, error: menuResult.status === 'rejected' ? menuResult.reason?.message : '', data: menuResult.status === 'fulfilled' ? menuResult.value : [] })
        setStaff({ isLoading: false, error: staffResult.status === 'rejected' ? staffResult.reason?.message : '', data: staffResult.status === 'fulfilled' ? staffResult.value : [] })
      } catch (requestError) {
        if (isCurrent) setPageError(requestError.message || 'Unable to load this restaurant.')
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    loadOverview()
    return () => { isCurrent = false }
  }, [id])

  const groupedMenu = (Array.isArray(menu.data) ? menu.data : []).reduce((groups, item) => {
    const category = item.category || 'Menu'
    groups[category] = [...(groups[category] || []), item]
    return groups
  }, {})

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <Link to="/owner" className={styles.backLink}>&larr; Back to restaurants</Link>
        {isLoading && <p className={styles.status}>Loading restaurant overview...</p>}
        {pageError && !isLoading && <p className={styles.error} role="alert">{pageError}</p>}
        {!isLoading && restaurant && (
          <>
            <header className={styles.heading}>
              <div><p className={styles.eyebrow}>Owner overview</p><h1>{restaurant.name}</h1><p>{restaurant.address || 'Restaurant details at a glance.'}</p></div>
              <Link to={`/owner/restaurants/${id}/manager`} className={styles.manageLink}>Manage manager &rarr;</Link>
            </header>
            <div className={styles.sections}>
              <section className={styles.section}>
                <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>The room</p><h2>Floor Plan</h2></div><span className={styles.readOnly}>Read only</span></div>
                {floor.isLoading && <p className={styles.status}>Loading the floor plan...</p>}
                {floor.error && <p className={styles.unavailable}>Not available for this view yet.</p>}
                {!floor.isLoading && !floor.error && <FloorPlanGrid mode="view-only" tables={floor.data?.tables || []} elements={floor.data?.elements || []} />}
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>What&apos;s on</p><h2>Menu</h2></div><span className={styles.readOnly}>Read only</span></div>
                {menu.isLoading && <p className={styles.status}>Loading the menu...</p>}
                {menu.error && <p className={styles.unavailable}>Not available for this view yet.</p>}
                {!menu.isLoading && !menu.error && Object.keys(groupedMenu).length === 0 && <p className={styles.status}>No menu items yet.</p>}
                {!menu.isLoading && !menu.error && Object.entries(groupedMenu).map(([category, items]) => (
                  <div className={styles.category} key={category}>
                    <h3>{category}</h3>
                    {items.map((item) => <article className={styles.menuItem} key={item._id}><div><strong>{item.name}</strong><p>{item.description || 'No description added.'}</p></div><span>${Number(item.price).toFixed(2)}</span></article>)}
                  </div>
                ))}
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>The team</p><h2>Staff</h2></div><span className={styles.readOnly}>Read only</span></div>
                {staff.isLoading && <p className={styles.status}>Loading the staff...</p>}
                {staff.error && <p className={styles.unavailable}>Not available for this view yet.</p>}
                {!staff.isLoading && !staff.error && (staff.data || []).length === 0 && <p className={styles.status}>No staff members yet.</p>}
                {!staff.isLoading && !staff.error && <div className={styles.staffList}>{(staff.data || []).map((member) => <div className={styles.staffRow} key={member._id}><div><strong>{member.name}</strong><p>{member.email}</p></div><StatusBadge status={member.role} /></div>)}</div>}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default RestaurantOverview
