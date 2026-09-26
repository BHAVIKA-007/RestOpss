import { apiRequest } from '../api'

export function getFloorLayout(restaurantId) {
  return apiRequest(`/floor-layout?restaurantId=${encodeURIComponent(restaurantId)}`)
}

export function suggestCombination({ restaurantId, partySize, timeSlot }) {
  const params = new URLSearchParams({ restaurantId, partySize: String(partySize), timeSlot })
  return apiRequest(`/reservations/suggest-combination?${params}`)
}

export function getTableAvailability({ restaurantId, timeSlot }) {
  const params = new URLSearchParams({ restaurantId, timeSlot })
  return apiRequest(`/reservations/table-availability?${params}`)
}

export function createReservation(payload) {
  return apiRequest('/reservations', { method: 'POST', body: JSON.stringify(payload) })
}

export function joinWaitlist(restaurantId, groupSize, requestedTimeSlot) {
  return apiRequest('/allocation/waiting/join', { method: 'POST', body: JSON.stringify({ restaurantId, groupSize, requestedTimeSlot }) })
}

export function getMyWaitlistRequests() {
  return apiRequest('/allocation/waiting/mine')
}

export function cancelMyWaitlistRequest(id) {
  return apiRequest(`/allocation/waiting/${id}/cancel`, { method: 'PATCH' })
}

export function respondToMyWaitlistRequest(id, accept) {
  return apiRequest(`/allocation/waiting/${id}/respond`, { method: 'PATCH', body: JSON.stringify({ accept }) })
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
