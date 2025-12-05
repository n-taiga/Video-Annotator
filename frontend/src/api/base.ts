/**
 * API Base utilities
 */

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

/**
 * Extract error message from Response
 */
export function extractMessage(res: Response, fallback: string): Promise<string> {
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
