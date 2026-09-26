import { apiRequest } from '../api'

export function getTimingConfig() {
  return apiRequest('/restaurants/config/timing')
}