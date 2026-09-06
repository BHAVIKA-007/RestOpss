import { apiRequest } from '../api'

export const getManagerFloorLayout = () => apiRequest('/floor-layout')

export const saveManagerFloorLayout = (layout) => apiRequest('/floor-layout', {
  method: 'POST',
  body: JSON.stringify(layout),
})

export const getManagerStaff = () => apiRequest('/staff')

export const createManagerStaff = (staff) => apiRequest('/staff', {
  method: 'POST',
  body: JSON.stringify(staff),
})

export const deleteManagerStaff = (id) => apiRequest(`/staff/${id}`, { method: 'DELETE' })

export const getManagerMenu = () => apiRequest('/menu')

export const createManagerMenuItem = (item) => apiRequest('/menu', {
  method: 'POST',
  body: JSON.stringify(item),
})

export const updateManagerMenuItem = (id, changes) => apiRequest(`/menu/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(changes),
})

export const deleteManagerMenuItem = (id) => apiRequest(`/menu/${id}`, { method: 'DELETE' })

export const getManagerReservations = (filters = {}) => {
  const params = new URLSearchParams()
  if (filters.status?.length) params.set('status', filters.status.join(','))
  if (filters.requiresApproval !== undefined) params.set('requiresApproval', filters.requiresApproval)
  if (filters.date) params.set('date', filters.date)
  const query = params.toString()
  return apiRequest(`/reservations${query ? `?${query}` : ''}`)
}

export const approveManagerReservation = (id) => apiRequest(`/reservations/${id}/approve`, { method: 'PATCH' })
export const rejectManagerReservation = (id) => apiRequest(`/reservations/${id}/reject`, { method: 'PATCH' })

export const getManagerWaitlist = () => apiRequest('/allocation/waiting')
export const expireManagerWaitlistEntry = (id) => apiRequest(`/allocation/waiting/${id}/expire-check`, {
  method: 'PATCH',
})

export const getManagerKitchenQueue = () => apiRequest('/kitchen')
