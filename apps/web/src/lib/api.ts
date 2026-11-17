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

  updateMe: (body: { full_name: string }) =>
    api<UserPublic>('/api/v1/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),

  refresh: () => api<UserPublic>('/api/v1/auth/refresh', { method: 'POST' }),
}

// --- Organizations ---

export interface OrganizationWithRole {
  id: string
  name: string
  slug: string
  is_personal: boolean
  role: string
}

export interface Member {
  id: string
  organization_id: string
  user_id: string
  role: string
  email: string
  full_name: string
}

export const organizations = {
  list: () => api<OrganizationWithRole[]>('/api/v1/organizations'),
  members: (organizationId: string) =>
    api<Member[]>(`/api/v1/organizations/${organizationId}/members`),
}

// --- Projects ---

export interface Project {
  id: string
  organization_id: string
  code: string
  name: string
  client: string | null
  location: string | null
  description: string | null
}

export interface CreateProjectBody {
  organization_id: string
  code: string
  name: string
  client?: string | null
  location?: string | null
  description?: string | null
}

export const projects = {
  list: (organizationId?: string) => {
    const q = organizationId ? `?organization_id=${organizationId}` : ''
    return api<Project[]>(`/api/v1/projects${q}`)
  },
  create: (body: CreateProjectBody) =>
    api<Project>('/api/v1/projects', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => api<Project>(`/api/v1/projects/${id}`),
  update: (id: string, body: Partial<Omit<CreateProjectBody, 'organization_id'>>) =>
    api<Project>(`/api/v1/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api<void>(`/api/v1/projects/${id}`, { method: 'DELETE' }),
}

// --- Buildings ---

export interface BuildingRevision {
  id: string
  building_id: string
  revision_number: number
  source: string
  status: string
  notes: string | null
}

export interface Building {
  id: string
  project_id: string
  name: string
  active_revision_id: string | null
}

export interface BuildingDetail extends Building {
  revisions: BuildingRevision[]
}

export const buildings = {
  listByProject: (projectId: string) =>
    api<Building[]>(`/api/v1/buildings?project_id=${projectId}`),
  create: (body: { project_id: string; name: string }) =>
    api<Building>('/api/v1/buildings', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => api<BuildingDetail>(`/api/v1/buildings/${id}`),
  uploadRevision: async (buildingId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const url = `${API_BASE}/api/v1/buildings/${buildingId}/revisions/upload`
    const res = await fetch(url, { method: 'POST', body: form, credentials: 'include' })
    const text = await res.text()
    const body = text ? safeJson(text) : null
    if (!res.ok) {
      const msg =
        body && typeof body === 'object' && 'detail' in body
          ? String((body as { detail: unknown }).detail)
          : `HTTP ${res.status}`
      throw new ApiError(res.status, msg, body)
    }
    return body as BuildingRevision
  },
}
