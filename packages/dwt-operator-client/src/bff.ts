import type { CreateMovementBody, ReserveResponse } from './types'

export function createBffClient(baseUrl = '') {
  const root = baseUrl.replace(/\/$/, '')

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${root}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    const text = await response.text()
    const body = text ? JSON.parse(text) : {}
    if (!response.ok) {
      const message = typeof body === 'object' && body && 'message' in body ? String(body.message) : response.statusText
      throw new Error(message)
    }
    return body as T
  }

  return {
    reserveIds(movementCount: number): Promise<ReserveResponse> {
      return request<ReserveResponse>('/bff/id-reservations', {
        method: 'POST',
        body: JSON.stringify({ movementCount, deliveryCount: 0 }),
      })
    },
    createMovement(body: CreateMovementBody): Promise<unknown> {
      return request('/bff/movements', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    health(): Promise<{ ok: boolean }> {
      return request('/bff/health')
    },
  }
}
