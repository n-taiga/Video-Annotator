/**
 * Labels API (Action Labels & Object Labels)
 */

import { buildApiUrl, extractMessage } from './base'

export type LabelDictionary = Record<string, string>

// Legacy alias for backward compatibility
export type ActionLabelDictionary = LabelDictionary

function parseLabelsResponse(data: unknown): LabelDictionary {
  const source =
    data && typeof data === 'object' && 'labels' in data && typeof (data as { labels: unknown }).labels === 'object'
      ? (data as { labels: Record<string, unknown> }).labels
      : {}
  const out: LabelDictionary = {}
  for (const [key, val] of Object.entries(source)) {
    if (typeof key !== 'string' || typeof val !== 'string') continue
    out[key] = val
  }
  return out
}

// ============================================================
// Action Labels
// ============================================================

export async function fetchActionLabels(): Promise<LabelDictionary> {
  const res = await fetch(buildApiUrl('/config/action-labels'), { cache: 'no-store' })
  if (!res.ok) {
    const message = await extractMessage(res, `Failed to load action labels: ${res.status}`)
    throw new Error(message)
  }
  const data = await res.json()
  return parseLabelsResponse(data)
}

export async function updateActionLabels(labels: LabelDictionary): Promise<LabelDictionary> {
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
  return parseLabelsResponse(data)
}

// ============================================================
// Object Labels
// ============================================================

export async function fetchObjectLabels(): Promise<LabelDictionary> {
  const res = await fetch(buildApiUrl('/config/object-labels'), { cache: 'no-store' })
  if (!res.ok) {
    const message = await extractMessage(res, `Failed to load object labels: ${res.status}`)
    throw new Error(message)
  }
  const data = await res.json()
  return parseLabelsResponse(data)
}

export async function updateObjectLabels(labels: LabelDictionary): Promise<LabelDictionary> {
  const res = await fetch(buildApiUrl('/config/object-labels'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels }),
  })
  if (!res.ok) {
    const message = await extractMessage(res, `Failed to update object labels: ${res.status}`)
    throw new Error(message)
  }
  const data = await res.json()
  return parseLabelsResponse(data)
}
