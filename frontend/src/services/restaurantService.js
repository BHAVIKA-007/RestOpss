import { apiRequest } from '../api'

export function getRestaurants({ cuisine = '', search = '' } = {}) {
  const params = new URLSearchParams()

  if (cuisine) params.set('cuisine', cuisine)
  if (search) params.set('search', search)

  const query = params.toString()
  return apiRequest(`/restaurants${query ? `?${query}` : ''}`)
}

export function getRestaurantById(id) {
  return apiRequest(`/restaurants/${id}`)
}

export function getMenuByRestaurantId(id) {
  return apiRequest(`/menu/${id}`)
}
