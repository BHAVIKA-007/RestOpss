import styles from './FloorPlanGrid.module.css'

const tableStatusClass = {
  available: styles.available,
  reserved: styles.unavailable,
  occupied: styles.unavailable,
  cleaning: styles.unavailable,
}

function FloorPlanGrid({ tables = [], elements = [], mode = 'select-single', selectedTableIds = [], onTableClick = () => {} }) {
  const positions = [...tables, ...elements]
  const minX = positions.length ? Math.min(...positions.map((item) => Number(item.gridX) || 0)) : 0
  const maxX = positions.length ? Math.max(...positions.map((item) => Number(item.gridX) || 0)) : 0
  const minY = positions.length ? Math.min(...positions.map((item) => Number(item.gridY) || 0)) : 0
  const maxY = positions.length ? Math.max(...positions.map((item) => Number(item.gridY) || 0)) : 0
  const columns = Math.max(1, maxX - minX + 1)
  const rows = Math.max(1, maxY - minY + 1)

  return (
    <div className={styles.viewport}>
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, minmax(58px, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(58px, 1fr))` }}>
        {elements.map((element) => (
          <span
            className={`${styles.element} ${styles[element.type] || styles.divider}`}
            key={element._id || `${element.type}-${element.gridX}-${element.gridY}`}
            style={{ gridColumn: element.gridX - minX + 1, gridRow: element.gridY - minY + 1 }}
            title={element.type}
          >
            {element.type === 'window' ? 'W' : element.type === 'door' ? 'D' : ''}
          </span>
        ))}
        {tables.map((table) => {
          const tableId = table._id || table.id
          const isSelected = selectedTableIds.includes(tableId)
          const isAvailable = table.status === 'available'
          return (
            <button
              type="button"
              className={`${styles.table} ${tableStatusClass[table.status] || styles.unavailable} ${styles[table.shape] || styles.square} ${isSelected ? styles.selected : ''}`}
              key={tableId}
              style={{ gridColumn: table.gridX - minX + 1, gridRow: table.gridY - minY + 1 }}
              disabled={mode === 'select-single' && !isAvailable}
              onClick={() => isAvailable && onTableClick(tableId)}
              title={`${table.number ? `Table ${table.number}` : 'Table'}: ${table.status}`}
            >
              <strong>{table.number ?? '?'}</strong>
              <small>{table.capacity} seats</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default FloorPlanGrid
