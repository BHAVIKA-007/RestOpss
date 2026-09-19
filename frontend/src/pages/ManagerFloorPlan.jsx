import { useEffect, useMemo, useState } from 'react'
import FloorPlanGrid from '../components/FloorPlanGrid/FloorPlanGrid'
import { assignTableWaiter, createManagerTable, deleteManagerTable, getManagerFloorLayout, getManagerStaff, saveManagerFloorLayout, updateManagerTable } from '../services/managerService'
import styles from './ManagerFloorPlan.module.css'
import shared from './ManagerPages.module.css'

const emptyLayout = { tables: [], elements: [] }
const objectIdPattern = /^[a-f\d]{24}$/i

function ManagerFloorPlan() {
  const [layout, setLayout] = useState(emptyLayout)
  const [waiters, setWaiters] = useState([])
  const [activeTool, setActiveTool] = useState(null)
  const [selectedTableId, setSelectedTableId] = useState(null)
  const [selectedElement, setSelectedElement] = useState(null)
  const [adjacencyMode, setAdjacencyMode] = useState(false)
  const [tableShape, setTableShape] = useState('square')
  const [tableCapacity, setTableCapacity] = useState(4)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [waiterMessage, setWaiterMessage] = useState({ type: '', text: '' })
  const [tableDraft, setTableDraft] = useState(null)
  const [isSavingTable, setIsSavingTable] = useState(false)

  useEffect(() => {
    Promise.all([getManagerFloorLayout(), getManagerStaff()])
      .then(([data, staff]) => {
        setLayout({ tables: data.tables || [], elements: data.elements || [] })
        setWaiters((staff || []).filter((member) => member.role === 'waiter'))
      })
      .catch((error) => setMessage({ type: 'error', text: error.message || 'Unable to load the floor plan.' }))
      .finally(() => setIsLoading(false))
  }, [])

  const selectedTable = layout.tables.find((table) => (table._id || table.id) === selectedTableId)
  const selectedAdjacentIds = selectedTable?.adjacentTo || []
  const nextTableNumber = useMemo(() => layout.tables.reduce((highest, table) => Math.max(highest, Number(table.number) || 0), 0) + 1, [layout.tables])

  function chooseTool(tool) {
    setActiveTool((current) => current === tool ? null : tool)
    setSelectedTableId(null)
    setSelectedElement(null)
    setAdjacencyMode(false)
    setMessage({ type: '', text: '' })
  }

  function handleCellClick(gridX, gridY) {
    if (!activeTool) return
    if (activeTool === 'table') {
      setTableDraft({ number: nextTableNumber, capacity: Math.max(1, Number(tableCapacity) || 1), gridX, gridY, shape: tableShape, combinable: false, adjacentTo: [] })
    } else {
      setLayout((current) => ({ ...current, elements: [...current.elements, { type: activeTool, gridX, gridY }] }))
    }
    setActiveTool(null)
  }

  function handleTableClick(tableId) {
    if (adjacencyMode && selectedTableId && tableId !== selectedTableId) {
      setLayout((current) => ({
        ...current,
        tables: current.tables.map((table) => {
          const currentId = table._id || table.id
          if (currentId !== selectedTableId) return table
          const adjacentTo = table.adjacentTo || []
          return { ...table, adjacentTo: adjacentTo.includes(tableId) ? adjacentTo.filter((id) => id !== tableId) : [...adjacentTo, tableId] }
        }),
      }))
      return
    }
    setSelectedTableId(tableId)
    const table = layout.tables.find((item) => (item._id || item.id || item.clientId) === tableId)
    setTableDraft(table ? { ...table, adjacentTo: table.adjacentTo || [] } : null)
    setSelectedElement(null)
    setActiveTool(null)
  }

  function updateSelectedTable(changes) {
    setTableDraft((current) => current ? { ...current, ...changes } : current)
    setLayout((current) => ({ ...current, tables: current.tables.map((table) => (table._id || table.id) === selectedTableId ? { ...table, ...changes } : table) }))
  }

  function updateTableDraft(changes) {
    setTableDraft((current) => current ? { ...current, ...changes } : current)
  }

  async function saveTableDraft() {
    if (!tableDraft) return
    setIsSavingTable(true)
    setMessage({ type: '', text: '' })
    try {
      const payload = {
        number: Number(tableDraft.number),
        capacity: Number(tableDraft.capacity),
        gridX: Number(tableDraft.gridX),
        gridY: Number(tableDraft.gridY),
        shape: tableDraft.shape,
        combinable: Boolean(tableDraft.combinable),
        adjacentTo: tableDraft.adjacentTo || [],
      }
      const response = tableDraft._id
        ? await updateManagerTable(tableDraft._id, payload)
        : await createManagerTable(payload)
      const savedTable = response.table
      setLayout((current) => ({ ...current, tables: tableDraft._id ? current.tables.map((table) => (table._id || table.id) === tableDraft._id ? savedTable : table) : [...current.tables, savedTable] }))
      setSelectedTableId(savedTable._id)
      setTableDraft({ ...savedTable, adjacentTo: savedTable.adjacentTo || [] })
      setActiveTool(null)
      setMessage({ type: 'success', text: tableDraft._id ? 'Table updated.' : 'Table created.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to save the table.' })
    } finally {
      setIsSavingTable(false)
    }
  }

  async function changeAssignedWaiter(event) {
    const waiterId = event.target.value || null
    setWaiterMessage({ type: '', text: '' })
    try {
      await assignTableWaiter(selectedTableId, waiterId)
      updateSelectedTable({ assignedWaiter: waiterId })
      setWaiterMessage({ type: 'success', text: waiterId ? 'Waiter assigned.' : 'Waiter unassigned.' })
    } catch (error) {
      setWaiterMessage({ type: 'error', text: error.message || 'Unable to assign waiter.' })
    }
  }

  function handleElementClick(element) {
    setSelectedElement(element)
    setSelectedTableId(null)
    setTableDraft(null)
    setActiveTool(null)
  }

  function deleteSelected() {
    if (selectedTableId) {
      const remove = async () => {
        try {
          if (objectIdPattern.test(selectedTableId)) await deleteManagerTable(selectedTableId)
          setLayout((current) => ({ ...current, tables: current.tables.filter((table) => (table._id || table.id || table.clientId) !== selectedTableId).map((table) => ({ ...table, adjacentTo: (table.adjacentTo || []).filter((id) => id !== selectedTableId) })) }))
          setSelectedTableId(null)
          setTableDraft(null)
          setAdjacencyMode(false)
          setMessage({ type: 'success', text: 'Table deleted.' })
        } catch (error) {
          setMessage({ type: 'error', text: error.message || 'Unable to delete the table.' })
        }
      }
      remove()
      return
    }
    if (selectedElement) {
      setLayout((current) => ({ ...current, elements: current.elements.filter((element) => element !== selectedElement) }))
      setSelectedElement(null)
      setMessage({ type: 'success', text: 'Element removed. Save the layout to apply the change.' })
    }
  }

  async function handleSave() {
    setIsSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const newTables = layout.tables.filter((table) => !table._id)
      const savePayload = {
        elements: layout.elements,
        tables: layout.tables.map((table) => {
          const saveTable = {
            ...table,
            adjacentTo: (table.adjacentTo || []).filter((tableId) => objectIdPattern.test(tableId)),
          }
          delete saveTable.clientId
          return saveTable
        }),
      }
      const savedLayout = await saveManagerFloorLayout(savePayload)

      if (newTables.length > 0) {
        const createdTables = (savedLayout.tables || []).filter((table) => newTables.some((item) => item.number === table.number && item.gridX === table.gridX && item.gridY === table.gridY))
        const temporaryToPersistedId = new Map()
        newTables.forEach((table) => {
          const createdTable = createdTables.find((candidate) => candidate.number === table.number && candidate.gridX === table.gridX && candidate.gridY === table.gridY)
          if (createdTable) temporaryToPersistedId.set(table.clientId, createdTable._id)
        })

        const completePayload = {
          elements: layout.elements,
          tables: layout.tables.map((table) => ({
            ...table,
            _id: table._id || temporaryToPersistedId.get(table.clientId),
            adjacentTo: (table.adjacentTo || []).map((tableId) => temporaryToPersistedId.get(tableId) || tableId).filter((tableId) => objectIdPattern.test(tableId)),
          })).map((table) => {
            const persistedTable = { ...table }
            delete persistedTable.clientId
            return persistedTable
          }),
        }
        await saveManagerFloorLayout(completePayload)
      }
      setMessage({ type: 'success', text: 'Floor plan saved successfully.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to save the floor plan.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <header className={shared.pageHeading}>
        <p className={shared.eyebrow}>Manager workspace</p>
        <h1>Shape the room around the service.</h1>
        <p>Place the room pieces, then connect tables that can work as a combination.</p>
      </header>
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <span className={styles.groupLabel}>Place</span>
          <button type="button" className={`${styles.toolButton} ${activeTool === 'table' ? styles.active : ''}`} onClick={() => chooseTool('table')}>+ Table</button>
          <button type="button" className={`${styles.toolButton} ${activeTool === 'wall' ? styles.active : ''}`} onClick={() => chooseTool('wall')}>Wall</button>
          <button type="button" className={`${styles.toolButton} ${activeTool === 'window' ? styles.active : ''}`} onClick={() => chooseTool('window')}>Window</button>
          <button type="button" className={`${styles.toolButton} ${activeTool === 'door' ? styles.active : ''}`} onClick={() => chooseTool('door')}>Door</button>
          <button type="button" className={`${styles.toolButton} ${activeTool === 'divider' ? styles.active : ''}`} onClick={() => chooseTool('divider')}>Divider</button>
        </div>
        <div className={styles.tableOptions}>
          <label>Shape <select value={tableShape} onChange={(event) => setTableShape(event.target.value)}><option value="square">Square</option><option value="round">Round</option><option value="rect">Rectangle</option></select></label>
          <label>Seats <input type="number" min="1" value={tableCapacity} onChange={(event) => setTableCapacity(event.target.value)} /></label>
        </div>
        <button type="button" className={styles.saveButton} onClick={handleSave} disabled={isLoading || isSaving}>{isSaving ? 'Saving...' : 'Save Layout'}</button>
      </div>
      {activeTool && <p className={styles.instruction}>Click an empty grid cell to place {activeTool}.</p>}
      {message.text && <p className={message.type === 'error' ? shared.error : styles.success} role="status">{message.text}</p>}
      {isLoading ? <p className={shared.status}>Loading your current floor plan...</p> : (
        <div className={styles.builderLayout}>
          <section className={styles.canvasPanel}>
            <FloorPlanGrid
              mode="builder"
              tables={layout.tables}
              elements={layout.elements}
              selectedTableIds={selectedTableId ? [selectedTableId] : []}
              adjacentTableIds={adjacencyMode ? selectedAdjacentIds : []}
              onCellClick={handleCellClick}
              onTableClick={handleTableClick}
              onElementClick={handleElementClick}
            />
            <p className={styles.canvasHint}>Click a table to edit it. Click an element to select it.</p>
          </section>
          <aside className={styles.editPanel}>
            {tableDraft ? (
              <>
                <span className={styles.groupLabel}>{tableDraft._id ? `Edit table ${tableDraft.number}` : 'Add table'}</span>
                <label>Number <input type="number" min="1" value={tableDraft.number} onChange={(event) => updateTableDraft({ number: event.target.value })} /></label>
                <label>Capacity <input type="number" min="1" value={tableDraft.capacity} onChange={(event) => updateTableDraft({ capacity: event.target.value })} /></label>
                <label>Grid column <input type="number" min="0" value={tableDraft.gridX} onChange={(event) => updateTableDraft({ gridX: event.target.value })} /></label>
                <label>Grid row <input type="number" min="0" value={tableDraft.gridY} onChange={(event) => updateTableDraft({ gridY: event.target.value })} /></label>
                <label>Shape <select value={tableDraft.shape || 'square'} onChange={(event) => updateTableDraft({ shape: event.target.value })}><option value="square">Square</option><option value="round">Round</option><option value="rect">Rectangle</option></select></label>
                <label className={styles.checkLabel}><input type="checkbox" checked={Boolean(tableDraft.combinable)} onChange={(event) => updateTableDraft({ combinable: event.target.checked })} /> Combinable</label>
                <fieldset className={styles.adjacencyField}><legend>Adjacent tables</legend>{layout.tables.filter((table) => (table._id || table.id || table.clientId) !== (tableDraft._id || tableDraft.id || tableDraft.clientId)).map((table) => { const id = table._id || table.id || table.clientId; return <label className={styles.checkLabel} key={id}><input type="checkbox" checked={(tableDraft.adjacentTo || []).includes(id)} onChange={(event) => updateTableDraft({ adjacentTo: event.target.checked ? [...(tableDraft.adjacentTo || []), id] : (tableDraft.adjacentTo || []).filter((adjacentId) => adjacentId !== id) })} /> Table {table.number}</label> })}</fieldset>
                {tableDraft._id && <label>Assigned Waiter <select value={typeof selectedTable?.assignedWaiter === 'object' ? selectedTable.assignedWaiter?._id || '' : selectedTable?.assignedWaiter || ''} onChange={changeAssignedWaiter}><option value="">Unassigned</option>{waiters.map((waiter) => <option value={waiter._id} key={waiter._id}>{waiter.name}</option>)}</select></label>}
                {waiterMessage.text && <p className={waiterMessage.type === 'error' ? shared.error : styles.success} role="status">{waiterMessage.text}</p>}
                <button type="button" className={styles.saveButton} onClick={saveTableDraft} disabled={isSavingTable}>{isSavingTable ? 'Saving table...' : tableDraft._id ? 'Save table changes' : 'Create table'}</button>
                {tableDraft._id && <button type="button" className={styles.deleteButton} onClick={deleteSelected}>Delete table</button>}
              </>
            ) : selectedElement ? (
              <><span className={styles.groupLabel}>Selected element</span><h2>{selectedElement.type}</h2><button type="button" className={styles.deleteButton} onClick={deleteSelected}>Delete element</button></>
            ) : (
              <><span className={styles.groupLabel}>Editing guide</span><h2>Start with a tool.</h2><p className={styles.helpText}>Choose a piece above, then click an empty cell. New tables begin at number {nextTableNumber}.</p></>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

export default ManagerFloorPlan
