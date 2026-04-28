import { apiFetch } from './client'

export function getHistory(count = 20) {
  return apiFetch(`/api/games/history?count=${count}`)
}

export function getCurrentRound() {
  return apiFetch('/api/games/current')
}
