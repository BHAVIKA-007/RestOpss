import { apiRequest } from '../api'

export const getHostFloorLayout = () => apiRequest('/floor-layout')
export const updateHostTableStatus = (id, status) => apiRequest(`/tables/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
export const getHostReservations = (filters = {}) => {
  const params = new URLSearchParams()
  if (filters.status?.length) params.set('status', filters.status.join(','))
  const query = params.toString()
  return apiRequest(`/reservations${query ? `?${query}` : ''}`)
}
export const seatReservation = (id) => apiRequest(`/reservations/${id}/seat`, { method: 'PATCH' })
export const suggestCombination = ({ restaurantId, partySize, timeSlot, durationMinutes = 90 }) => {
  const params = new URLSearchParams({ restaurantId, partySize: String(partySize), timeSlot, durationMinutes: String(durationMinutes) })
  return apiRequest(`/reservations/suggest-combination?${params}`)
}
export const allocateWalkIn = (details) => apiRequest('/allocation/allocate', { method: 'POST', body: JSON.stringify(details) })
export const getHostWaitlist = () => apiRequest('/allocation/waiting/position')
export const respondToWaitlist = (id, accept, tableId) => apiRequest(`/allocation/waiting/${id}/respond`, { method: 'PATCH', body: JSON.stringify({ accept, ...(tableId ? { tableId } : {}) }) })
export const expireHostWaitlist = (id) => apiRequest(`/allocation/waiting/${id}/expire-check`, { method: 'PATCH' })
