import { apiRequest } from '../api'

export function getFloorLayout(restaurantId) {
  return apiRequest(`/floor-layout?restaurantId=${encodeURIComponent(restaurantId)}`)
}

export function suggestCombination({ restaurantId, partySize, timeSlot, durationMinutes = 90 }) {
  const params = new URLSearchParams({ restaurantId, partySize: String(partySize), timeSlot, durationMinutes: String(durationMinutes) })
  return apiRequest(`/reservations/suggest-combination?${params}`)
}

export function createReservation(payload) {
  return apiRequest('/reservations', { method: 'POST', body: JSON.stringify(payload) })
}

export function getMyReservations() {
  return apiRequest('/reservations/my')
}

export function confirmReservation(id) {
  return apiRequest(`/reservations/${id}/confirm`, { method: 'PATCH' })
}

export function cancelReservation(id) {
  return apiRequest(`/reservations/${id}/cancel`, { method: 'PATCH' })
}
