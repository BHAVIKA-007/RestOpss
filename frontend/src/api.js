const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const getStoredToken = () => localStorage.getItem('restops_token')

export const setStoredToken = (token) => localStorage.setItem('restops_token', token)

export const clearStoredToken = () => localStorage.removeItem('restops_token')

export async function apiRequest(path, options = {}) {
  const token = getStoredToken()
  const headers = new Headers(options.headers || {})

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = typeof data === 'string' ? data : data.message
    const error = new Error(message || 'Something went wrong. Please try again.')
    error.status = response.status
    throw error
  }

  return data
}

export const loginRequest = (credentials) => apiRequest('/users/login', {
  method: 'POST',
  body: JSON.stringify(credentials),
})

export const registerRequest = (details) => apiRequest('/users/register', {
  method: 'POST',
  body: JSON.stringify(details),
})

export const getCurrentUser = () => apiRequest('/users/me')
