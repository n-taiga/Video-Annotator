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