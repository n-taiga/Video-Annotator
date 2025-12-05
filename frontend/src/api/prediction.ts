/**
 * Prediction API with Multipart Streaming Support
 */

import { buildApiUrl, extractMessage } from './base'
import multipartStream from '../utils/multipartStream'

// ============================================================
// Types
// ============================================================

export interface PredictionMetadata {
  sessionId: string
  frameIndex: number
  objectCount: number
}

export interface ObjectMaskResult {
  objectId: number
  score: number
  width: number
  height: number
  maskBytes: Uint8Array
}

export interface MultipartPredictionResult {
  metadata: PredictionMetadata
  masks: ObjectMaskResult[]
}

export interface PredictPayload {
  sessionId: string
  videoPath: string
  frameIndex: number
  objects: Array<{
    objectId: number
    points: Array<{ x: number; y: number; label: number }>
    meta?: Record<string, unknown>
  }>
  meta?: Record<string, unknown>
}

export interface FrameResult {
  sessionId: string
  frameIndex: number
  results: Array<{
    objectId: number
    score: number
    mask: {
      width: number
      height: number
      format: string
      data: string // base64
    }
    meta?: Record<string, unknown>
  }>
  meta?: Record<string, unknown>
}

// ============================================================
// Multipart Response Parser (Streaming)
// ============================================================

/**
 * Parse multipart/mixed response using streaming parser
 */
async function parseMultipartResponse(response: Response): Promise<MultipartPredictionResult> {
  const contentType = response.headers.get('content-type') || ''
  if (!response.body) {
    throw new Error('Response body is null')
  }

  const stream = multipartStream(contentType, response.body)
  const reader = stream.getReader()

  const masks: ObjectMaskResult[] = []
  let metadata: PredictionMetadata | null = null
  let currentObjectMeta: { objectId: number; score: number; width: number; height: number } | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const { headers, body } = value
      const partContentType = headers.get('Content-Type') || ''

      if (partContentType.includes('application/json')) {
        const json = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>

        if ('sessionId' in json) {
          // Metadata part
          metadata = {
            sessionId: String(json.sessionId ?? ''),
            frameIndex: Number(json.frameIndex ?? 0),
            objectCount: Number(json.objectCount ?? 0),
          }
        } else if ('objectId' in json) {
          // Object metadata part
          currentObjectMeta = {
            objectId: Number(json.objectId ?? 0),
            score: Number(json.score ?? 0),
            width: Number(json.width ?? 0),
            height: Number(json.height ?? 0),
          }
        }
      } else if (partContentType.includes('image/png') && currentObjectMeta) {
        // PNG binary part
        masks.push({
          ...currentObjectMeta,
          maskBytes: body,
        })
        currentObjectMeta = null
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!metadata) {
    throw new Error('No metadata found in multipart response')
  }

  return { metadata, masks }
}

// ============================================================
// Prediction API
// ============================================================

export interface PredictOptions {
  useMultipart?: boolean
  signal?: AbortSignal
}

/**
 * Call prediction endpoint with multipart response support.
 * When useMultipart is true (default), returns binary mask bytes directly via streaming.
 * When useMultipart is false, returns standard JSON with base64-encoded masks.
 */
export async function predictWithMultipart(
  payload: PredictPayload,
  options: PredictOptions = {},
): Promise<MultipartPredictionResult | FrameResult> {
  const { useMultipart = true, signal } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (useMultipart) {
    headers['Accept'] = 'multipart/mixed'
  }

  const res = await fetch(buildApiUrl('/predict'), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok) {
    const message = await extractMessage(res, `Prediction failed: ${res.status}`)
    throw new Error(message)
  }

  const responseContentType = res.headers.get('content-type') || ''
  if (responseContentType.includes('multipart/mixed')) {
    return parseMultipartResponse(res)
  }

  // Fallback to JSON response
  return res.json() as Promise<FrameResult>
}

/**
 * Check if result is MultipartPredictionResult
 */
export function isMultipartResult(
  result: MultipartPredictionResult | FrameResult,
): result is MultipartPredictionResult {
  return 'masks' in result && 'metadata' in result
}
