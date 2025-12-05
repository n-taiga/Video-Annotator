/**
 * Annotation API
 */

import { buildApiUrl } from './base'

export async function saveAnnotation(annotation: unknown): Promise<unknown> {
  const res = await fetch(buildApiUrl('/save'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(annotation),
  })
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
    throw new Error(message || `Failed to save annotation: ${res.status}`)
  }
  return res.json()
}

export async function loadAnnotation(videoName: string): Promise<unknown> {
  const ts = Date.now()
  const res = await fetch(buildApiUrl(`/load/${encodeURIComponent(videoName)}?t=${ts}`), {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Failed to load annotation: ${res.status}`)
  }
  return res.json()
}
