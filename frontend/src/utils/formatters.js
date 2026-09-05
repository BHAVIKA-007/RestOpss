export function formatDateTime(value) {
  if (!value) return 'Date and time pending'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

export function getId(value) {
  return typeof value === 'object' && value !== null ? value._id : value
}
