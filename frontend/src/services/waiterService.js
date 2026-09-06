import { apiRequest } from '../api'

export const getMyTables = () => apiRequest('/tables/mine')
export const getWaiterMenu = (restaurantId) => apiRequest(`/menu/${restaurantId}`)
export const getWaiterOrders = () => apiRequest('/orders')
export const createWaiterOrder = (order) => apiRequest('/orders', { method: 'POST', body: JSON.stringify(order) })
export const pickupWaiterOrder = (id) => apiRequest(`/orders/${id}/pickup`, { method: 'PATCH' })
export const deliverWaiterOrder = (id) => apiRequest(`/orders/${id}/deliver`, { method: 'PATCH' })
