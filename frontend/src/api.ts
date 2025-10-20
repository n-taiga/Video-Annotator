const resolveApiBase = () => {
  const envApiUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL
  if (envApiUrl) {
    if (envApiUrl.startsWith('/')) {
      return envApiUrl.replace(/\/$/, '')
    }
    return envApiUrl
  }
  if (typeof window !== 'undefined') {
    return '/api'
  }
  return 'http://localhost:8000'
}

const API_URL = resolveApiBase()

export const API_BASE_URL = API_URL

export function buildApiUrl(path: string): string {
  const base = API_URL.replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

export async function saveAnnotation(annotation: any) {
  const res = await fetch(buildApiUrl('/save'), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(annotation),
  });
  if (!res.ok) {
    let message = ''
    try {
      const data = await res.json()
      if (data && typeof data.detail === 'string') {
        message = data.detail
      } else if (data) {
        message = JSON.stringify(data)
      }
    } catch {
      message = await res.text().catch(() => res.statusText)
    }
    throw new Error(message || `Failed to save annotation: ${res.status}`);
  }
  return res.json();
}

export async function loadAnnotation(videoName: string) {
  // Add cache-buster to ensure latest file is fetched
  const ts = Date.now()
  const res = await fetch(buildApiUrl(`/load/${encodeURIComponent(videoName)}?t=${ts}`), {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to load annotation: ${res.status}`);
  }
  return res.json();
}

export async function fetchVideos(): Promise<string[]> {
  const res = await fetch(buildApiUrl('/videos'));
  if (!res.ok) {
    throw new Error(`Failed to load videos: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data.videos) ? data.videos : [];
}

export type ActionLabelDictionary = Record<string, string>

function extractMessage(res: Response, fallback: string): Promise<string> {
  return res
    .json()
    .then(body => {
      if (body && typeof body === 'object' && typeof body.detail === 'string') {
        return body.detail
      }
      return JSON.stringify(body)
    })
    .catch(async () => {
      try {
        return await res.text()
      } catch {
        return fallback
      }
    })
}

export async function fetchActionLabels(): Promise<ActionLabelDictionary> {
  const res = await fetch(buildApiUrl('/config/action-labels'), { cache: 'no-store' })
  if (!res.ok) {
    const message = await extractMessage(res, `Failed to load action labels: ${res.status}`)
    throw new Error(message)
  }
  const data = await res.json()
  const source = data && typeof data === 'object' && data.labels && typeof data.labels === 'object' ? data.labels : {}
  const out: ActionLabelDictionary = {}
  for (const [key, val] of Object.entries(source)) {
    if (typeof key !== 'string' || typeof val !== 'string') continue
    out[key] = val
  }
  return out
}

export async function updateActionLabels(labels: ActionLabelDictionary): Promise<ActionLabelDictionary> {
  const res = await fetch(buildApiUrl('/config/action-labels'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels }),
  })
  if (!res.ok) {
    const message = await extractMessage(res, `Failed to update action labels: ${res.status}`)
    throw new Error(message)
  }
  const data = await res.json()
  const source = data && typeof data === 'object' && data.labels && typeof data.labels === 'object' ? data.labels : {}
  const out: ActionLabelDictionary = {}
  for (const [key, val] of Object.entries(source)) {
    if (typeof key !== 'string' || typeof val !== 'string') continue
    out[key] = val
  }
  return out
}