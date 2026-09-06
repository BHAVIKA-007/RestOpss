import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { useAuth } from '../context/AuthContext'
import { createRestaurant } from '../services/ownerService'
import styles from './CreateRestaurant.module.css'

function CreateRestaurant() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [form, setForm] = useState({ name: '', address: '', phone: '' })
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('Restaurant name is required.')
      return
    }

    setError('')
    setIsSaving(true)
    try {
      await createRestaurant({ name: form.name.trim(), address: form.address.trim(), phone: form.phone.trim() })
      await refreshUser()
      navigate('/owner', { replace: true })
    } catch (requestError) {
      setError(requestError.message || 'Unable to create the restaurant.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <NavBar />
      <main className={styles.content}>
        <Link to="/owner" className={styles.backLink}>&larr; Back to restaurants</Link>
        <section className={styles.formPanel}>
          <p className={styles.eyebrow}>New restaurant</p>
          <h1>Give the next room a name.</h1>
          <p className={styles.intro}>Add the essentials now. You can shape the floor plan and team later.</p>
          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="restaurant-name">Restaurant name <span>*</span></label>
            <input id="restaurant-name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. The Lantern Room" autoFocus />
            <label htmlFor="restaurant-address">Address <small>Optional</small></label>
            <input id="restaurant-address" name="address" value={form.address} onChange={handleChange} placeholder="Street, city" />
            <label htmlFor="restaurant-phone">Phone <small>Optional</small></label>
            <input id="restaurant-phone" name="phone" value={form.phone} onChange={handleChange} placeholder="(555) 010-2040" />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.submitButton} disabled={isSaving}>{isSaving ? 'Creating...' : 'Create restaurant'}</button>
          </form>
        </section>
      </main>
    </div>
  )
}

export default CreateRestaurant
