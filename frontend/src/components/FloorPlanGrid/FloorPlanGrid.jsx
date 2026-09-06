import styles from './FloorPlanGrid.module.css'

const tableStatusClass = {
  available: styles.available,
  reserved: styles.unavailable,
  occupied: styles.unavailable,
  cleaning: styles.unavailable,
}

function FloorPlanGrid({
  tables = [],
  elements = [],
  mode = 'select-single',
  selectedTableIds = [],
  highlightedTableIds = [],
  adjacentTableIds = [],
  builderColumns = 12,
  builderRows = 8,
  compact = false,
  onCellClick = () => {},
  onTableClick = () => {},
  onElementClick = () => {},
}) {
  const positions = [...tables, ...elements]
  const minX = mode === 'builder' ? 0 : positions.length ? Math.min(...positions.map((item) => Number(item.gridX) || 0)) : 0
  const maxX = mode === 'builder' ? Math.max(builderColumns - 1, ...positions.map((item) => Number(item.gridX) || 0)) : positions.length ? Math.max(...positions.map((item) => Number(item.gridX) || 0)) : 0
  const minY = mode === 'builder' ? 0 : positions.length ? Math.min(...positions.map((item) => Number(item.gridY) || 0)) : 0
  const maxY = mode === 'builder' ? Math.max(builderRows - 1, ...positions.map((item) => Number(item.gridY) || 0)) : positions.length ? Math.max(...positions.map((item) => Number(item.gridY) || 0)) : 0
  const columns = Math.max(1, maxX - minX + 1)
  const rows = Math.max(1, maxY - minY + 1)
  const occupiedCells = new Set(positions.map((item) => `${item.gridX}-${item.gridY}`))
  const cells = mode === 'builder'
    ? Array.from({ length: columns * rows }, (_, index) => ({ gridX: index % columns, gridY: Math.floor(index / columns) }))
    : []

  return (
    <div className={`${styles.viewport} ${mode === 'builder' ? styles.builderViewport : ''} ${compact ? styles.compact : ''}`}>
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, minmax(58px, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(58px, 1fr))` }}>
        {cells.map((cell) => (
          <button
            aria-label={`Place at grid column ${cell.gridX + 1}, row ${cell.gridY + 1}`}
            className={`${styles.cell} ${occupiedCells.has(`${cell.gridX}-${cell.gridY}`) ? styles.occupied : ''}`}
            disabled={occupiedCells.has(`${cell.gridX}-${cell.gridY}`)}
            key={`cell-${cell.gridX}-${cell.gridY}`}
            onClick={() => onCellClick(cell.gridX, cell.gridY)}
            style={{ gridColumn: cell.gridX - minX + 1, gridRow: cell.gridY - minY + 1 }}
            type="button"
          />
        ))}
        {elements.map((element) => (
          <button
            className={`${styles.element} ${styles[element.type] || styles.divider}`}
            disabled={mode !== 'builder'}
            key={element._id || `${element.type}-${element.gridX}-${element.gridY}`}
            onClick={() => mode === 'builder' && onElementClick(element)}
            style={{ gridColumn: element.gridX - minX + 1, gridRow: element.gridY - minY + 1 }}
            title={element.type}
            type="button"
          >
            {element.type === 'window' ? 'W' : element.type === 'door' ? 'D' : ''}
          </button>
        ))}
        {tables.map((table) => {
          const tableId = table._id || table.id || table.clientId
          const isSelected = selectedTableIds.includes(tableId)
          const isHighlighted = highlightedTableIds.includes(tableId)
          const isAdjacent = adjacentTableIds.includes(tableId)
          const isAvailable = table.status === 'available'
          return (
            <button
              type="button"
              className={`${styles.table} ${tableStatusClass[table.status] || styles.unavailable} ${styles[table.shape] || styles.square} ${isSelected || isHighlighted ? styles.selected : ''} ${isAdjacent ? styles.adjacent : ''}`}
              key={tableId}
              style={{ gridColumn: table.gridX - minX + 1, gridRow: table.gridY - minY + 1 }}
              disabled={mode === 'view-only' || (mode === 'select-single' && !isAvailable)}
              onClick={mode === 'view-only' ? undefined : () => (mode === 'builder' || isAvailable) && onTableClick(tableId)}
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
