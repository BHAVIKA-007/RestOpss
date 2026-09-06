import { useEffect, useMemo, useState } from 'react'
import FloorPlanGrid from '../components/FloorPlanGrid/FloorPlanGrid'
import { getManagerFloorLayout, saveManagerFloorLayout } from '../services/managerService'
import styles from './ManagerFloorPlan.module.css'
import shared from './ManagerPages.module.css'

const emptyLayout = { tables: [], elements: [] }
const objectIdPattern = /^[a-f\d]{24}$/i

function ManagerFloorPlan() {
  const [layout, setLayout] = useState(emptyLayout)
  const [activeTool, setActiveTool] = useState(null)
  const [selectedTableId, setSelectedTableId] = useState(null)
  const [selectedElement, setSelectedElement] = useState(null)
  const [adjacencyMode, setAdjacencyMode] = useState(false)
  const [tableShape, setTableShape] = useState('square')
  const [tableCapacity, setTableCapacity] = useState(4)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    getManagerFloorLayout()
      .then((data) => setLayout({ tables: data.tables || [], elements: data.elements || [] }))
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
      setLayout((current) => ({
        ...current,
        tables: [...current.tables, { clientId: `new-${Date.now()}-${gridX}-${gridY}`, number: nextTableNumber, capacity: Math.max(1, Number(tableCapacity) || 1), gridX, gridY, shape: tableShape, combinable: false, adjacentTo: [], status: 'available' }],
      }))
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
    setSelectedElement(null)
    setActiveTool(null)
  }

  function updateSelectedTable(changes) {
    setLayout((current) => ({ ...current, tables: current.tables.map((table) => (table._id || table.id) === selectedTableId ? { ...table, ...changes } : table) }))
  }

  function handleElementClick(element) {
    setSelectedElement(element)
    setSelectedTableId(null)
    setActiveTool(null)
  }

  function deleteSelected() {
    if (selectedTableId) {
      setLayout((current) => ({ ...current, tables: current.tables.filter((table) => (table._id || table.id) !== selectedTableId) }))
      setSelectedTableId(null)
      setAdjacencyMode(false)
      setMessage({ type: 'success', text: 'Table removed from this editing session. Existing tables are not deleted by bulk save.' })
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
      await saveManagerFloorLayout(savePayload)
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
            {selectedTable ? (
              <>
                <span className={styles.groupLabel}>Selected table {selectedTable.number}</span>
                <label>Capacity <input type="number" min="1" value={selectedTable.capacity} onChange={(event) => updateSelectedTable({ capacity: Math.max(1, Number(event.target.value) || 1) })} /></label>
                <label>Shape <select value={selectedTable.shape || 'square'} onChange={(event) => updateSelectedTable({ shape: event.target.value })}><option value="square">Square</option><option value="round">Round</option><option value="rect">Rectangle</option></select></label>
                <label className={styles.checkLabel}><input type="checkbox" checked={Boolean(selectedTable.combinable)} onChange={(event) => updateSelectedTable({ combinable: event.target.checked })} /> Combinable</label>
                <button type="button" className={`${styles.secondaryButton} ${adjacencyMode ? styles.active : ''}`} onClick={() => setAdjacencyMode((current) => !current)}>{adjacencyMode ? 'Done linking' : 'Link Adjacent Tables'}</button>
                {adjacencyMode && <p className={styles.helpText}>Click other tables to toggle them into this table&apos;s adjacency list.</p>}
                <button type="button" className={styles.deleteButton} onClick={deleteSelected}>Delete from session</button>
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
