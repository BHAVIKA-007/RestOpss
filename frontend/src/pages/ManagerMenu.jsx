import { useEffect, useState } from 'react'
import { createManagerMenuItem, deleteManagerMenuItem, getManagerMenu, updateManagerMenuItem } from '../services/managerService'
import styles from './ManagerPages.module.css'

const initialForm = { name: '', description: '', price: '', category: '', isAvailable: true }

function ManagerMenu() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const loadMenu = () => getManagerMenu().then(setItems).catch((requestError) => setError(requestError.message || 'Unable to load the menu.'))
  useEffect(() => { loadMenu().finally(() => setIsLoading(false)) }, [])

  function openAdd() { setEditingId(null); setForm(initialForm); setError(''); setIsModalOpen(true) }
  function openEdit(item) { setEditingId(item._id); setForm({ name: item.name, description: item.description || '', price: item.price, category: item.category, isAvailable: item.isAvailable }); setError(''); setIsModalOpen(true) }
  function handleChange(event) { const { name, value, type, checked } = event.target; setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value })) }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      const payload = { ...form, price: Number(form.price) }
      if (editingId) await updateManagerMenuItem(editingId, payload)
      else await createManagerMenuItem(payload)
      setIsModalOpen(false)
      await loadMenu()
    } catch (requestError) { setError(requestError.message || 'Unable to save this menu item.') } finally { setIsSaving(false) }
  }

  async function handleToggle(item) {
    const nextValue = !item.isAvailable
    const previous = items
    setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, isAvailable: nextValue } : entry))
    try { await updateManagerMenuItem(item._id, { isAvailable: nextValue }) } catch (requestError) { setItems(previous); setError(requestError.message || 'Unable to update availability.') }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete ${item.name} from the menu?`)) return
    setError('')
    try { await deleteManagerMenuItem(item._id); setItems((current) => current.filter((entry) => entry._id !== item._id)) } catch (requestError) { setError(requestError.message || 'Unable to delete this menu item.') }
  }

  const grouped = items.reduce((groups, item) => { const category = item.category || 'Uncategorized'; groups[category] = [...(groups[category] || []), item]; return groups }, {})

  return (
    <div>
      <header className={styles.pageHeadingWithAction}><div><p className={styles.eyebrow}>Manager workspace</p><h1>What&apos;s on the menu?</h1><p>Keep the offer legible for the team and the guest.</p></div><button type="button" className={styles.primaryButton} onClick={openAdd}>+ Add Item</button></header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {isLoading ? <p className={styles.status}>Loading menu...</p> : Object.keys(grouped).length === 0 ? <section className={styles.panel}><p className={styles.status}>No menu items yet.</p></section> : <div className={styles.menuGroups}>{Object.entries(grouped).map(([category, categoryItems]) => <section className={styles.panel} key={category}><div className={styles.panelHeading}><div><span className={styles.panelKicker}>Category</span><h2>{category}</h2></div></div><div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>Item</th><th>Price</th><th>Available</th><th aria-label="Actions" /></tr></thead><tbody>{categoryItems.map((item) => <tr key={item._id}><td><strong>{item.name}</strong><small>{item.description}</small></td><td>${Number(item.price).toFixed(2)}</td><td><button type="button" className={`${styles.toggle} ${item.isAvailable ? styles.toggleOn : ''}`} aria-pressed={item.isAvailable} onClick={() => handleToggle(item)}><span /></button></td><td className={styles.rowActions}><button type="button" className={styles.smallButton} onClick={() => openEdit(item)}>Edit</button><button type="button" className={styles.smallDanger} onClick={() => handleDelete(item)}>Delete</button></td></tr>)}</tbody></table></div></section>)}</div>}
      {isModalOpen && <div className={styles.modalBackdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="menu-modal-title"><div className={styles.modalHeading}><div><span className={styles.panelKicker}>{editingId ? 'Edit item' : 'New menu item'}</span><h2 id="menu-modal-title">{editingId ? 'Edit menu item' : 'Add menu item'}</h2></div><button type="button" className={styles.closeButton} onClick={() => setIsModalOpen(false)} aria-label="Close">&times;</button></div><form className={styles.formGrid} onSubmit={handleSubmit}><label>Name<input name="name" value={form.name} onChange={handleChange} required /></label><label>Description<textarea name="description" value={form.description} onChange={handleChange} rows="3" /></label><label>Price<input name="price" type="number" min="0" step="0.01" value={form.price} onChange={handleChange} required /></label><label>Category<input name="category" value={form.category} onChange={handleChange} required /></label><label className={styles.checkboxField}><input name="isAvailable" type="checkbox" checked={form.isAvailable} onChange={handleChange} /> Available to guests</label><button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : editingId ? 'Save changes' : 'Add item'}</button></form></section></div>}
    </div>
  )
}

export default ManagerMenu
