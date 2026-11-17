/**
 * Thin fetch wrapper that always sends cookies (credentials: 'include')
 * and parses JSON responses. Throws on non-2xx with a typed error.
 */

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  })

  const text = await res.text()
  const body = text ? safeJson(text) : null

  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : `HTTP ${res.status}`
    throw new ApiError(res.status, message, body)
  }

  return body as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// --- Typed auth helpers ---

export interface UserPublic {
  id: string
  email: string
  full_name: string
  is_admin: boolean
}

export const auth = {
  register: (body: { email: string; password: string; full_name: string }) =>
    api<UserPublic>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    api<{ user: UserPublic }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () => api<void>('/api/v1/auth/logout', { method: 'POST' }),

  me: () => api<UserPublic>('/api/v1/auth/me'),

  refresh: () => api<UserPublic>('/api/v1/auth/refresh', { method: 'POST' }),
}
