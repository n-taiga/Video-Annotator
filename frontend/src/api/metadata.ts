/**
 * Metadata API
 */

import { buildApiUrl } from './base'

export async function fetchMetadata(): Promise<string[]> {
  const res = await fetch(buildApiUrl('/metadata'), { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to load metadata list: ${res.status}`)
  }
  const data = await res.json()
  return Array.isArray(data.metadata) ? data.metadata : []
}

export async function fetchMetadataItem(id: string): Promise<unknown> {
  const res = await fetch(buildApiUrl(`/metadata/${encodeURIComponent(id)}`), { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to load metadata item: ${res.status}`)
  }
  return res.json()
}
