import { apiRequest } from '../api'

export function getMyOrders() {
  return apiRequest('/orders/mine')
}

export function getMyOrder(id) {
  return apiRequest(`/orders/mine/${id}`)
}

export function createCustomerOrder(payload) {
  return apiRequest('/orders/mine', { method: 'POST', body: JSON.stringify(payload) })
}

export function confirmOrderReceived(id) {
  return apiRequest(`/orders/mine/${id}/confirm-received`, { method: 'PATCH' })
}
