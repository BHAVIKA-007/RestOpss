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
  missed: 'Missed',
  seated: 'Seated',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show'
}

export function getCustomerFacingStatusLabel(status, timeSlot, lockExpiresAt, durationMinutes) {
  if (status === 'locked' && [timeSlot, lockExpiresAt].some((value) => value && new Date(value).getTime() < Date.now())) {
    return 'Expired'
  }

  if (status === 'confirmed' && hasReservationWindowPassed(timeSlot, durationMinutes)) {
    return customerReservationStatusLabels.missed
  }

  return customerReservationStatusLabels[status] || status.replace('_', ' ')
}

export function hasReservationWindowPassed(timeSlot, durationMinutes, now = Date.now()) {
  const start = new Date(timeSlot).getTime()
  const duration = Number(durationMinutes)
  if (!Number.isFinite(start) || !Number.isFinite(duration)) return false
  return now >= start + duration * 60000
}
