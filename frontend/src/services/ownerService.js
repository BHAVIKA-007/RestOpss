import { apiRequest } from '../api'

export function getMyRestaurants() {
  return apiRequest('/restaurants/my')
}

export function createRestaurant(details) {
  return apiRequest('/restaurants', {
    method: 'POST',
    body: JSON.stringify(details),
  })
}

export function lookupUserByEmail(email) {
  return apiRequest(`/users/lookup?email=${encodeURIComponent(email)}`)
}

export function assignManager(restaurantId, userId) {
  return apiRequest(`/restaurants/${restaurantId}/assign-manager`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

export function replaceManager(restaurantId, userId) {
  return apiRequest(`/restaurants/${restaurantId}/manager`, {
    method: 'PATCH',
    body: JSON.stringify({ userId }),
  })
}

export function removeManager(restaurantId) {
  return apiRequest(`/restaurants/${restaurantId}/manager`, {
    method: 'DELETE',
  })
}

export function getFloorLayout(restaurantId) {
  return apiRequest(`/floor-layout?restaurantId=${encodeURIComponent(restaurantId)}`)
}

export function getOwnerMenu(restaurantId) {
  return apiRequest(`/menu?restaurantId=${encodeURIComponent(restaurantId)}`)
}

export function getOwnerStaff(restaurantId) {
  return apiRequest(`/staff?restaurantId=${encodeURIComponent(restaurantId)}`)
}
