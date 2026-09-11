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

const customerReservationStatusLabels = {
  locked: 'Awaiting Confirmation',
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show'
}

export function getCustomerFacingStatusLabel(status, timeSlot, lockExpiresAt) {
  if (status === 'locked' && [timeSlot, lockExpiresAt].some((value) => value && new Date(value).getTime() < Date.now())) {
    return 'Expired'
  }

  return customerReservationStatusLabels[status] || status.replace('_', ' ')
}
