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

// Endpoints exentos de auto-refresh (evita bucles).
const AUTH_EXEMPT = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/register']

// Promesa compartida: si varias requests reciben 401 a la vez, todas esperan al mismo refresh.
let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      return res.ok
    } catch {
      return false
    } finally {
      // Permite siguientes intentos cuando venza otra vez
      setTimeout(() => {
        refreshPromise = null
      }, 100)
    }
  })()
  return refreshPromise
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let res = await fetch(url, { ...init, credentials: 'include', headers })

  if (res.status === 401 && !AUTH_EXEMPT.some((p) => path.startsWith(p))) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      res = await fetch(url, { ...init, credentials: 'include', headers })
    } else if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
      // Devuelve una promesa que nunca resuelve mientras redirige
      return new Promise<T>(() => {})
    }
  }

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
  forces_status?: 'none' | 'queued' | 'importing' | 'loaded' | 'invalid'
  forces_notes?: string | null
}

export interface ForcesSummary {
  status: 'none' | 'queued' | 'importing' | 'loaded' | 'invalid'
  notes: string | null
  n_records: number
  n_elements_with_forces: number
  n_load_cases: number
  load_cases: string[]
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

// --- Geometría de revisión (para visor 3D) ---

export interface GeomLevel {
  id: string
  name: string
  elevation: number
  height: number | null
}

export interface GeomNode {
  id: string
  tag: string
  x: number
  y: number
  z: number
  level_id: string | null
}

export interface GeomElement {
  id: string
  tag: string
  kind: string
  level_id: string | null
  section_id: string | null
  node_i_id: string | null
  node_j_id: string | null
  properties: Record<string, unknown>
}

export interface RevisionGeometry {
  levels: GeomLevel[]
  nodes: GeomNode[]
  elements: GeomElement[]
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
  dispatchImport: (buildingId: string, revisionId: string) =>
    api<BuildingRevision>(`/api/v1/buildings/${buildingId}/revisions/${revisionId}/import`, {
      method: 'POST',
    }),
  getGeometry: (buildingId: string, revisionId: string) =>
    api<RevisionGeometry>(`/api/v1/buildings/${buildingId}/revisions/${revisionId}/geometry`),
  uploadForces: async (buildingId: string, revisionId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const url = `${API_BASE}/api/v1/buildings/${buildingId}/revisions/${revisionId}/forces/upload`
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
  getForcesSummary: (buildingId: string, revisionId: string) =>
    api<ForcesSummary>(`/api/v1/buildings/${buildingId}/revisions/${revisionId}/forces/summary`),
  getBeamGroups: (buildingId: string, revisionId: string, levelId?: string) => {
    const q = levelId ? `?level_id=${levelId}` : ''
    return api<BeamGroupsResponse>(
      `/api/v1/buildings/${buildingId}/revisions/${revisionId}/beam-groups${q}`,
    )
  },
}

export interface BeamGroupSpan {
  element_id: string
  tag: string
  section_name: string | null
  offset_m: number
  length_m: number
  flipped: boolean
  ni: [number, number, number]
  nj: [number, number, number]
}

export interface BeamGroupPublic {
  id: string
  level_id: string | null
  total_length_m: number
  n_spans: number
  direction: [number, number, number]
  origin: [number, number, number]
  end: [number, number, number]
  supports_m: number[]
  spans: BeamGroupSpan[]
}

export interface BeamGroupsResponse {
  level_id: string | null
  n_beams: number
  n_groups: number
  groups: BeamGroupPublic[]
}

// --- Analysis runs ---

export interface AnalysisRun {
  id: string
  building_revision_id: string
  created_by_user_id: string
  kind: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  inputs: Record<string, unknown>
  result_summary: Record<string, unknown> | null
  log: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export const analyses = {
  list: (buildingId: string, revisionId: string) =>
    api<AnalysisRun[]>(`/api/v1/buildings/${buildingId}/revisions/${revisionId}/analyses`),
  create: (buildingId: string, revisionId: string, kind = 'quick_check') =>
    api<AnalysisRun>(`/api/v1/buildings/${buildingId}/revisions/${revisionId}/analyses`, {
      method: 'POST',
      body: JSON.stringify({ kind }),
    }),
  get: (runId: string) => api<AnalysisRun>(`/api/v1/analyses/${runId}`),
}

// --- Beam designs ---

export interface BeamDesignConfig {
  fc_mpa: number
  fy_mpa: number
  fys_mpa: number
  cover_mm: number
  ductility: 'DES' | 'DMO' | 'Ninguna'
  live_load_kN_m2: number
  dead_extra_kN_m2: number
  tributary_width_m: number
}

export interface BeamDesign {
  id: string
  building_revision_id: string
  created_by_user_id: string
  name: string
  element_ids: string[]
  config: BeamDesignConfig
  status: 'pending' | 'running' | 'completed' | 'completed_with_warnings' | 'failed'
  result_summary: Record<string, unknown> | null
  log: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

// --- Stats overview ---

export interface RecentActivityItem {
  kind: 'import' | 'analysis' | 'design'
  label: string
  project_name: string | null
  project_id: string | null
  building_id: string | null
  revision_id: string | null
  status: string | null
  created_at: string
}

export interface OverviewStats {
  n_projects: number
  n_buildings: number
  n_revisions_total: number
  n_revisions_imported: number
  n_analyses_total: number
  n_analyses_completed: number
  n_designs_total: number
  n_designs_completed: number
  recent_activity: RecentActivityItem[]
}

export const stats = {
  overview: (projectId?: string) =>
    api<OverviewStats>(
      projectId
        ? `/api/v1/stats/overview?project_id=${projectId}`
        : '/api/v1/stats/overview',
    ),
}

// --- Column designs ---

export interface ColumnDesignConfig {
  fc_mpa: number
  fy_mpa: number
  fys_mpa: number
  cover_mm: number
  ductility: 'DES' | 'DMO' | 'Ninguna'
  rho_long_target: number
  tributary_area_m2: number
  levels_above: number
  dead_slab_kN_m2: number
  live_kN_m2: number
  Pu_kN?: number | null
  Mux_kNm?: number | null
  Muy_kNm?: number | null
  Vu_kN?: number | null
}

export interface ColumnDesign {
  id: string
  building_revision_id: string
  created_by_user_id: string
  name: string
  element_ids: string[]
  config: ColumnDesignConfig
  status: 'pending' | 'running' | 'completed' | 'completed_with_warnings' | 'failed'
  result_summary: Record<string, unknown> | null
  log: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export const columnDesigns = {
  list: (buildingId: string, revisionId: string) =>
    api<ColumnDesign[]>(
      `/api/v1/buildings/${buildingId}/revisions/${revisionId}/column-designs`,
    ),
  createByLevel: (
    buildingId: string,
    revisionId: string,
    levelId: string,
    config: Partial<ColumnDesignConfig>,
  ) =>
    api<ColumnDesign>(
      `/api/v1/buildings/${buildingId}/revisions/${revisionId}/column-designs/by-level`,
      { method: 'POST', body: JSON.stringify({ level_id: levelId, config }) },
    ),
  get: (id: string) => api<ColumnDesign>(`/api/v1/column-designs/${id}`),
}

// --- Wall designs ---

export interface WallDesignConfig {
  fc_mpa: number
  fy_mpa: number
  cover_mm: number
  ductility: 'DES' | 'DMO' | 'Ninguna'
  rho_h_target: number
  rho_v_target: number
  Pu_kN: number
  Vu_kN: number
  Mu_kNm: number
  t_cm?: number | null
  Lw_cm?: number | null
  hw_cm?: number | null
}

export interface WallDesign {
  id: string
  building_revision_id: string
  created_by_user_id: string
  name: string
  element_ids: string[]
  config: WallDesignConfig
  status: 'pending' | 'running' | 'completed' | 'completed_with_warnings' | 'failed'
  result_summary: Record<string, unknown> | null
  log: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export const wallDesigns = {
  list: (buildingId: string, revisionId: string) =>
    api<WallDesign[]>(
      `/api/v1/buildings/${buildingId}/revisions/${revisionId}/wall-designs`,
    ),
  createByLevel: (
    buildingId: string,
    revisionId: string,
    levelId: string,
    config: Partial<WallDesignConfig>,
  ) =>
    api<WallDesign>(
      `/api/v1/buildings/${buildingId}/revisions/${revisionId}/wall-designs/by-level`,
      { method: 'POST', body: JSON.stringify({ level_id: levelId, config }) },
    ),
}

// --- Footing designs ---

export interface FootingDesignConfig {
  fc_mpa: number
  fy_mpa: number
  cover_mm: number
  Pu_kN: number
  P_serv_kN?: number | null
  q_adm_kPa: number
  gamma_soil_kN_m3: number
  overburden_depth_m: number
  bc_cm: number
  hc_cm: number
}

export interface FootingDesign {
  id: string
  building_revision_id: string
  created_by_user_id: string
  name: string
  element_ids: string[]
  config: FootingDesignConfig
  status: 'pending' | 'running' | 'completed' | 'completed_with_warnings' | 'failed'
  result_summary: Record<string, unknown> | null
  log: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export const footingDesigns = {
  list: (buildingId: string, revisionId: string) =>
    api<FootingDesign[]>(
      `/api/v1/buildings/${buildingId}/revisions/${revisionId}/footing-designs`,
    ),
  createByLevel: (
    buildingId: string,
    revisionId: string,
    levelId: string,
    config: Partial<FootingDesignConfig>,
  ) =>
    api<FootingDesign>(
      `/api/v1/buildings/${buildingId}/revisions/${revisionId}/footing-designs/by-level`,
      { method: 'POST', body: JSON.stringify({ level_id: levelId, config }) },
    ),
}

export const designs = {
  list: (buildingId: string, revisionId: string) =>
    api<BeamDesign[]>(`/api/v1/buildings/${buildingId}/revisions/${revisionId}/beam-designs`),
  createByLevel: (
    buildingId: string,
    revisionId: string,
    levelId: string,
    config: Partial<BeamDesignConfig>,
  ) =>
    api<BeamDesign>(
      `/api/v1/buildings/${buildingId}/revisions/${revisionId}/beam-designs/by-level`,
      { method: 'POST', body: JSON.stringify({ level_id: levelId, config }) },
    ),
  create: (
    buildingId: string,
    revisionId: string,
    name: string,
    elementIds: string[],
    config: Partial<BeamDesignConfig>,
  ) =>
    api<BeamDesign>(`/api/v1/buildings/${buildingId}/revisions/${revisionId}/beam-designs`, {
      method: 'POST',
      body: JSON.stringify({ name, element_ids: elementIds, config }),
    }),
  get: (designId: string) => api<BeamDesign>(`/api/v1/beam-designs/${designId}`),
  dxfUrl: (designId: string) => `${API_BASE}/api/v1/beam-designs/${designId}/export/dxf`,
  pdfUrl: (designId: string) => `${API_BASE}/api/v1/beam-designs/${designId}/export/pdf`,
}
