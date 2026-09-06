import { useEffect, useState } from 'react'
import StatusBadge from '../components/StatusBadge'
import { createManagerStaff, deleteManagerStaff, getManagerStaff } from '../services/managerService'
import styles from './ManagerPages.module.css'

const initialForm = { name: '', email: '', password: '', role: 'waiter' }

function ManagerStaff() {
  const [staff, setStaff] = useState([])
  const [form, setForm] = useState(initialForm)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const loadStaff = () => getManagerStaff().then(setStaff).catch((requestError) => setError(requestError.message || 'Unable to load staff.'))

  useEffect(() => { loadStaff().finally(() => setIsLoading(false)) }, [])

  function handleChange(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })) }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      await createManagerStaff(form)
      setForm(initialForm)
      setIsModalOpen(false)
      await loadStaff()
    } catch (requestError) {
      setError(requestError.message || 'Unable to add staff member.')
    } finally { setIsSaving(false) }
  }

  async function handleRemove(member) {
    if (!window.confirm(`Remove ${member.name} from staff?`)) return
    setError('')
    try { await deleteManagerStaff(member._id); await loadStaff() } catch (requestError) { setError(requestError.message || 'Unable to remove staff member.') }
  }

  return (
    <div>
      <header className={styles.pageHeadingWithAction}><div><p className={styles.eyebrow}>Manager workspace</p><h1>Your team.</h1><p>Keep the people on the floor clear, current, and ready.</p></div><button type="button" className={styles.primaryButton} onClick={() => { setError(''); setIsModalOpen(true) }}>+ Add Staff</button></header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <section className={styles.panel}>
        {isLoading ? <p className={styles.status}>Loading staff...</p> : staff.length === 0 ? <p className={styles.status}>No staff members yet.</p> : <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>Name</th><th>Email</th><th>Role</th><th aria-label="Actions" /></tr></thead><tbody>{staff.map((member) => <tr key={member._id}><td><strong>{member.name}</strong></td><td>{member.email}</td><td><StatusBadge status={member.role} /></td><td><button type="button" className={styles.smallDanger} onClick={() => handleRemove(member)}>Remove</button></td></tr>)}</tbody></table></div>}
      </section>
      {isModalOpen && <div className={styles.modalBackdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="staff-modal-title"><div className={styles.modalHeading}><div><span className={styles.panelKicker}>New teammate</span><h2 id="staff-modal-title">Add staff</h2></div><button type="button" className={styles.closeButton} onClick={() => setIsModalOpen(false)} aria-label="Close">&times;</button></div><form className={styles.formGrid} onSubmit={handleSubmit}><label>Name<input name="name" value={form.name} onChange={handleChange} required /></label><label>Email<input name="email" type="email" value={form.email} onChange={handleChange} required /></label><label>Password<input name="password" type="password" value={form.password} onChange={handleChange} minLength="6" required /></label><label>Role<select name="role" value={form.role} onChange={handleChange}><option value="waiter">Waiter</option><option value="chef">Chef</option><option value="cashier">Cashier</option><option value="host">Host</option></select></label><button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Adding...' : 'Add staff'}</button></form></section></div>}
    </div>
  )
}

export default ManagerStaff
