import { apiFetch } from './client'

export function placeBet(amount, autoCashoutAt) {
  return apiFetch('/api/bets', {
    method: 'POST',
    body: JSON.stringify({ amount, autoCashoutAt: autoCashoutAt || null }),
  })
}

export function cashout(betId) {
  return apiFetch(`/api/bets/${betId}/cashout`, { method: 'POST' })
}

export function getMyBets(page = 1, pageSize = 20) {
  return apiFetch(`/api/bets/me?page=${page}&pageSize=${pageSize}`)
}

export function getActiveBets() {
  return apiFetch('/api/bets/me/active')
}

export function getRoundBets(roundId) {
  return apiFetch(`/api/bets/${roundId}/all`)
}

export function getServerBalance() {
  return apiFetch('/api/users/me/balance')
}

export function getAllRecentBets(count = 30) {
  return apiFetch(`/api/bets/recent?count=${count}`)
}
