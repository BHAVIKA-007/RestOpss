import { useEffect, useState } from 'react'
import StatusBadge from '../components/StatusBadge'
import { assignTableWaiter, createManagerStaff, deleteManagerStaff, getManagerFloorLayout, getManagerStaff } from '../services/managerService'
import styles from './ManagerPages.module.css'

const initialForm = { name: '', email: '', password: '', role: 'waiter' }

function ManagerStaff() {
  const [staff, setStaff] = useState([])
  const [tables, setTables] = useState([])
  const [expandedWaiterId, setExpandedWaiterId] = useState('')
  const [assignmentMessage, setAssignmentMessage] = useState({})
  const [form, setForm] = useState(initialForm)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const loadStaff = () => Promise.all([getManagerStaff(), getManagerFloorLayout()]).then(([members, floor]) => { setStaff(members); setTables(floor.tables || []) }).catch((requestError) => setError(requestError.message || 'Unable to load staff.'))

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

  async function toggleTableAssignment(waiter, table, checked) {
    const key = `${waiter._id}-${table._id}`
    setAssignmentMessage((current) => ({ ...current, [key]: '' }))
    try {
      await assignTableWaiter(table._id, checked ? waiter._id : null)
      setTables((current) => current.map((item) => item._id === table._id ? { ...item, assignedWaiter: checked ? waiter._id : null } : item))
      setAssignmentMessage((current) => ({ ...current, [key]: checked ? 'Assigned' : 'Unassigned' }))
    } catch (requestError) {
      setAssignmentMessage((current) => ({ ...current, [key]: requestError.message || 'Unable to update assignment.' }))
    }
  }

  function assignedTablesFor(waiter) {
    return tables.filter((table) => (typeof table.assignedWaiter === 'object' ? table.assignedWaiter?._id : table.assignedWaiter) === waiter._id)
  }

  return (
    <div>
      <header className={styles.pageHeadingWithAction}><div><p className={styles.eyebrow}>Manager workspace</p><h1>Your team.</h1><p>Keep the people on the floor clear, current, and ready.</p></div><button type="button" className={styles.primaryButton} onClick={() => { setError(''); setIsModalOpen(true) }}>+ Add Staff</button></header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <section className={styles.panel}>
        {isLoading ? <p className={styles.status}>Loading staff...</p> : staff.length === 0 ? <p className={styles.status}>No staff members yet.</p> : <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Coverage</th><th aria-label="Actions" /></tr></thead><tbody>{staff.map((member) => { const assignedTables = member.role === 'waiter' ? assignedTablesFor(member) : []; const isExpanded = expandedWaiterId === member._id; return <tr key={member._id}><td><strong>{member.name}</strong></td><td>{member.email}</td><td><StatusBadge status={member.role} /></td><td>{member.role === 'waiter' ? <>{assignedTables.length ? `Covering: ${assignedTables.map((table) => `Table ${table.number}`).join(', ')}` : 'No tables assigned'}<button type="button" className={styles.smallButton} onClick={() => setExpandedWaiterId(isExpanded ? '' : member._id)}>{isExpanded ? 'Hide Tables' : 'Manage Tables'}</button>{isExpanded && <div className={styles.assignmentList}>{tables.map((table) => { const key = `${member._id}-${table._id}`; return <label key={table._id}><input type="checkbox" checked={assignedTables.some((assigned) => assigned._id === table._id)} onChange={(event) => toggleTableAssignment(member, table, event.target.checked)} /> Table {table.number}{assignmentMessage[key] && <small>{assignmentMessage[key]}</small>}</label>})}</div>}</> : '—'}</td><td><button type="button" className={styles.smallDanger} onClick={() => handleRemove(member)}>Remove</button></td></tr>})}</tbody></table></div>}
      </section>
      {isModalOpen && <div className={styles.modalBackdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="staff-modal-title"><div className={styles.modalHeading}><div><span className={styles.panelKicker}>New teammate</span><h2 id="staff-modal-title">Add staff</h2></div><button type="button" className={styles.closeButton} onClick={() => setIsModalOpen(false)} aria-label="Close">&times;</button></div><form className={styles.formGrid} onSubmit={handleSubmit}><label>Name<input name="name" value={form.name} onChange={handleChange} required /></label><label>Email<input name="email" type="email" value={form.email} onChange={handleChange} required /></label><label>Password<input name="password" type="password" value={form.password} onChange={handleChange} minLength="6" required /></label><label>Role<select name="role" value={form.role} onChange={handleChange}><option value="waiter">Waiter</option><option value="chef">Chef</option><option value="cashier">Cashier</option><option value="host">Host</option></select></label><button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Adding...' : 'Add staff'}</button></form></section></div>}
    </div>
  )
}

export default ManagerStaff
