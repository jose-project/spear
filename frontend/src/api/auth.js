import { apiFetch, setTokens, clearTokens } from './client'

export async function register(username, email, password) {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })
  setTokens(data.accessToken, data.refreshToken)
  return data
}

export async function login(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setTokens(data.accessToken, data.refreshToken)
  return data
}

export async function logout() {
  await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  clearTokens()
}
