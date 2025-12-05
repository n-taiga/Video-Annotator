/**
 * Videos API
 */

import { buildApiUrl } from './base'

export async function fetchVideos(): Promise<string[]> {
  const res = await fetch(buildApiUrl('/videos'))
  if (!res.ok) {
    throw new Error(`Failed to load videos: ${res.status}`)
  }
  const data = await res.json()
  return Array.isArray(data.videos) ? data.videos : []
}
