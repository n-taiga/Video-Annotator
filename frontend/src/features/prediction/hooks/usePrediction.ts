import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import { buildApiUrl } from '../../../api'
import { createSessionId } from '../../video'
import type { VideoClickData } from '../../video'
import type { Interaction, TimelineSnapshot } from '../../timeline'
import {
  getTrackletColor,
  MAX_TRACKLET_ID,
  decodeMaskFromBase64,
  decodeMaskFromBytes,
  drawColorizedMask,
  drawMaskOutline,
} from '../../../common/mask'
import multipartStream from '../../../utils/multipartStream'
import type { ClickPoint } from '../types'
import { useMaskCache } from './useMaskCache'

async function captureVideoFrameToCanvas(video: HTMLVideoElement): Promise<HTMLCanvasElement> {
  if (!video) throw new Error('No video element')
  if (!video.videoWidth || !video.videoHeight) {
    await new Promise<void>(resolve => {
      const onLoaded = () => { resolve() }
      video.addEventListener('loadedmetadata', onLoaded, { once: true })
      setTimeout(() => resolve(), 500)
    })
  }
  const w = video.videoWidth || 640
  const h = video.videoHeight || 360
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D context not available')
  ctx.drawImage(video, 0, 0, w, h)
  return canvas
}

interface DrawResult {
  success: boolean
  error?: string
  aborted?: boolean
}

export interface UsePredictionStateInput {
  mainVideoRef: RefObject<HTMLVideoElement>
  currentTime: number
  currentTimeRef: MutableRefObject<number | null>
  getFrameIndexForTime: (time: number | null | undefined) => number
  selectedVideoFile: string
}

/** Default mask opacity */
const DEFAULT_MASK_OPACITY = 0.4

export interface UsePredictionStateOutput {
  clickPoints: ClickPoint[]
  setClickPoints: Dispatch<SetStateAction<ClickPoint[]>>
  overlayCanvasRef: RefObject<HTMLCanvasElement>
  activeTrackletId: number
  cycleActiveTracklet: () => void
  trackletColorFor: (objectId: number | null | undefined) => string
  currentFramePoints: ClickPoint[]
  handleSnapshotRestore: (snapshot: TimelineSnapshot<ClickPoint>) => Promise<void>
  captureVideoFrameToCanvas: (video: HTMLVideoElement) => Promise<HTMLCanvasElement>
  postPredictAndDraw: (
    frameIndex: number,
    framePoints: ClickPoint[],
    baseCanvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement | null,
    opts?: { endpoint?: string; timeoutMs?: number }
  ) => Promise<DrawResult>
  /** Draw masks from cache */
  drawCachedMasks: (frameIndex: number, overlayCanvas: HTMLCanvasElement | null) => boolean
  /** Clear mask cache */
  clearMaskCache: () => void
}

export function usePredictionState({
  mainVideoRef,
  currentTime,
  currentTimeRef,
  getFrameIndexForTime,
  selectedVideoFile,
}: UsePredictionStateInput): UsePredictionStateOutput {
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [clickPoints, setClickPoints] = useState<ClickPoint[]>([])
  const [activeTrackletId, setActiveTrackletId] = useState<number>(0)
  const [sessionId, setSessionId] = useState('')
  const prevFrameIndexRef = useRef<number | null>(null)
  
  // Mask cache
  const {
    cacheMask,
    getCachedMasksForFrame,
    hasFrameCache,
    clearCache: clearMaskCache,
  } = useMaskCache()

  /**
   * Draw cached masks to overlay canvas
   */
  const drawCachedMasks = useCallback((frameIndex: number, overlayCanvas: HTMLCanvasElement | null): boolean => {
    if (!overlayCanvas) return false
    
    const cachedMasks = getCachedMasksForFrame(frameIndex)
    if (cachedMasks.length === 0) return false
    
    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return false
    
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
    
    // Draw mask for each object
    for (const entry of cachedMasks) {
      drawColorizedMask(ctx, entry.maskBitmap, entry.objectId, DEFAULT_MASK_OPACITY)
      drawMaskOutline(ctx, entry.maskBitmap, entry.objectId)
    }
    
    return true
  }, [getCachedMasksForFrame])

  const postPredictAndDraw = useCallback(async (
    frameIndex: number,
    framePoints: ClickPoint[],
    baseCanvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement | null,
    opts: { endpoint?: string; timeoutMs?: number } = {},
  ): Promise<DrawResult> => {
    const endpoint = opts.endpoint ?? buildApiUrl('/predict')
    const controller = new AbortController()
    const timeoutId = opts.timeoutMs ? window.setTimeout(() => controller.abort(), opts.timeoutMs) : undefined

    try {
      const grouped = new Map<number, ClickPoint[]>()
      framePoints.forEach(point => {
        const key = Number.isFinite(point.objectId) ? point.objectId : 0
        const list = grouped.get(key)
        if (list) {
          list.push(point)
        } else {
          grouped.set(key, [point])
        }
      })

      const objects = Array.from(grouped.entries()).map(([objectId, pointsForObject]) => {
        const latest = pointsForObject[pointsForObject.length - 1]
        return {
          objectId,
          points: pointsForObject.map(p => ({
            id: p.id,
            x: p.normX,
            y: p.normY,
            label: typeof p.label === 'number' ? p.label : 1,
          })),
          meta: {
            lastTimestamp: typeof latest?.time === 'number' ? latest.time : undefined,
            lastSource: latest?.src,
            frameIndex,
            objectId,
          },
        }
      })

      let activeSessionId = sessionId
      if (!activeSessionId) {
        activeSessionId = createSessionId(selectedVideoFile || 'session')
        setSessionId(activeSessionId)
      }

      const body = {
        sessionId: activeSessionId,
        frameIndex,
        videoPath: selectedVideoFile,
        objects,
        meta: {
          pointCount: framePoints.length,
          objectCount: objects.length,
        },
      }

      if (typeof console.groupCollapsed === 'function') {
        console.groupCollapsed(`Predict payload | session=${body.sessionId} frame=${body.frameIndex} objects=${objects.length} points=${framePoints.length}`)
        console.info('Session', body.sessionId)
        console.info('Meta', body.meta)
        console.info('Video Path', body.videoPath)
        body.objects.forEach((obj, index) => {
          console.groupCollapsed(`Object[${index}] id=${obj.objectId} points=${obj.points.length}`)
          if (typeof console.table === 'function') {
            console.table(obj.points)
          } else {
            console.info('Points', obj.points)
          }
          console.info('Meta', obj.meta)
          console.groupEnd()
        })
        console.groupEnd()
      } else {
        console.info('Predict payload', {
          sessionId: body.sessionId,
          frameIndex: body.frameIndex,
          videoPath: body.videoPath,
          objects: body.objects.map(obj => ({
            objectId: obj.objectId,
            points: obj.points,
            pointCount: obj.points.length,
            meta: obj.meta,
          })),
          meta: body.meta,
          image: '[base64 omitted]',
        })
      }

      if (!framePoints.length && overlayCanvas) {
        overlayCanvas.width = baseCanvas.width
        overlayCanvas.height = baseCanvas.height
        const clearCtx = overlayCanvas.getContext('2d')
        if (clearCtx) {
          clearCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'multipart/mixed',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`predict failed: ${res.status} ${res.statusText}`)

      if (!overlayCanvas) return { success: false, error: 'no overlay canvas' }
      overlayCanvas.width = baseCanvas.width
      overlayCanvas.height = baseCanvas.height
      const ctx = overlayCanvas.getContext('2d')
      if (!ctx) return { success: false, error: 'no 2d context' }
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

      const contentType = res.headers.get('content-type') || ''
      
      if (contentType.includes('multipart/mixed')) {
        // Multipart response: binary PNG transfer
        const body = res.body
        if (!body) throw new Error('No response body for multipart')
        
        const stream = multipartStream(contentType, body)
        const reader = stream.getReader()
        
        let metadata: { sessionId?: string; frameIndex?: number; objectCount?: number } | null = null
        let currentObjectMeta: { objectId?: number; score?: number; width?: number; height?: number } | null = null
        
        while (true) {
          const { done, value: part } = await reader.read()
          if (done) break
          
          const partContentType = part.headers.get('content-type') || ''
          
          if (partContentType.includes('application/json')) {
            const json = JSON.parse(new TextDecoder().decode(part.body))
            if ('sessionId' in json) {
              metadata = json
            } else if ('objectId' in json) {
              currentObjectMeta = json
            }
          } else if (partContentType.includes('image/png') && currentObjectMeta) {
            const objectId = typeof currentObjectMeta.objectId === 'number' ? currentObjectMeta.objectId : 0
            const responseFrameIndex = metadata?.frameIndex ?? frameIndex
            
            try {
              const maskBitmap = await decodeMaskFromBytes(part.body)
              cacheMask(responseFrameIndex, objectId, maskBitmap)
              drawColorizedMask(ctx, maskBitmap, objectId, DEFAULT_MASK_OPACITY)
              drawMaskOutline(ctx, maskBitmap, objectId)
            } catch (err) {
              console.warn('Failed to decode mask from multipart PNG', err)
            }
            
            currentObjectMeta = null
          }
        }
      } else if (contentType.includes('application/json')) {
        // JSON response (fallback)
        const json = await res.json()
        const results = Array.isArray(json?.results) ? json.results : []
        const responseFrameIndex = typeof json?.frameIndex === 'number' ? json.frameIndex : frameIndex
        
        for (const r of results) {
          const b64 = r?.mask?.data
          const objectId = typeof r?.objectId === 'number' ? r.objectId : 0
          if (!b64) continue
          try {
            // Decode using new utility
            const maskBitmap = await decodeMaskFromBase64(b64)
            
            // Save to cache
            cacheMask(responseFrameIndex, objectId, maskBitmap)
            
            // Draw mask with object-specific color
            drawColorizedMask(ctx, maskBitmap, objectId, DEFAULT_MASK_OPACITY)
            
            // Draw outline
            drawMaskOutline(ctx, maskBitmap, objectId)
          } catch (err) {
            console.warn('Failed to decode mask from JSON result', err)
            continue
          }
        }
      } else {
        // Non-JSON response (kept for compatibility)
        const blob = await res.blob()
        const imgBitmap = await createImageBitmap(blob)
        // Cache and draw as object ID 0
        cacheMask(frameIndex, 0, imgBitmap)
        drawColorizedMask(ctx, imgBitmap, 0, DEFAULT_MASK_OPACITY)
        drawMaskOutline(ctx, imgBitmap, 0)
      }

      return { success: true }
    } catch (err: any) {
      if (err?.name === 'AbortError') return { success: false, aborted: true }
      console.error(err)
      return { success: false, error: String(err) }
    } finally {
      if (typeof timeoutId === 'number') window.clearTimeout(timeoutId)
    }
  }, [selectedVideoFile, sessionId])

  const handleSnapshotRestore = useCallback(async (snapshot: TimelineSnapshot<ClickPoint>) => {
    const videoEl = mainVideoRef.current
    const overlay = overlayCanvasRef.current
    if (!videoEl) return
    try {
      const baseCanvas = await captureVideoFrameToCanvas(videoEl)
      const targetFrame = getFrameIndexForTime(currentTimeRef.current ?? currentTime)
      const framePoints = snapshot.clickPoints.filter(point => point.frameIndex === targetFrame)
      await postPredictAndDraw(targetFrame, framePoints, baseCanvas, overlay, { timeoutMs: 20000 })
    } catch (_err) {
      // ignore prediction redraw errors during history restore
    }
  }, [currentTime, currentTimeRef, getFrameIndexForTime, mainVideoRef, postPredictAndDraw])

  const trackletColorFor = useCallback((objectId: number | null | undefined) => getTrackletColor(objectId), [])

  const cycleActiveTracklet = useCallback(() => {
    setActiveTrackletId(prev => {
      const next = (Math.trunc(prev) + 1) % (MAX_TRACKLET_ID + 1)
      return next
    })
  }, [])

  const currentFramePoints = useMemo(() => {
    const frameIndex = getFrameIndexForTime(currentTime)
    return clickPoints.filter(point => point.frameIndex === frameIndex)
  }, [clickPoints, currentTime, getFrameIndexForTime])

  // Redraw masks from cache when frame changes
  useEffect(() => {
    const frameIndex = getFrameIndexForTime(currentTime)
    
    // Skip if same frame
    if (prevFrameIndexRef.current === frameIndex) return
    prevFrameIndexRef.current = frameIndex
    
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    
    // Redraw if masks exist in cache
    if (hasFrameCache(frameIndex)) {
      drawCachedMasks(frameIndex, overlay)
    } else {
      // Clear if no cache
      const ctx = overlay.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, overlay.width, overlay.height)
      }
    }
  }, [currentTime, getFrameIndexForTime, hasFrameCache, drawCachedMasks])

  return {
    clickPoints,
    setClickPoints,
    overlayCanvasRef,
    activeTrackletId,
    cycleActiveTracklet,
    trackletColorFor,
    currentFramePoints,
    handleSnapshotRestore,
    captureVideoFrameToCanvas,
    postPredictAndDraw,
    drawCachedMasks,
    clearMaskCache,
  }
}

export interface UsePredictionActionsInput {
  clickPoints: ClickPoint[]
  setClickPoints: Dispatch<SetStateAction<ClickPoint[]>>
  mainVideoRef: RefObject<HTMLVideoElement>
  overlayCanvasRef: RefObject<HTMLCanvasElement>
  currentTime: number
  currentTimeRef: MutableRefObject<number | null>
  getFrameIndexForTime: (time: number | null | undefined) => number
  activeTrackletId: number
  pushHistory: (prevInteractions?: Interaction[], prevClickPoints?: ClickPoint[]) => void
  setHistoryRedoStack: Dispatch<SetStateAction<TimelineSnapshot<ClickPoint>[]>>
  interactions: Interaction[]
  captureVideoFrameToCanvas: (video: HTMLVideoElement) => Promise<HTMLCanvasElement>
  postPredictAndDraw: (
    frameIndex: number,
    framePoints: ClickPoint[],
    baseCanvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement | null,
    opts?: { endpoint?: string; timeoutMs?: number }
  ) => Promise<DrawResult>
}

export interface UsePredictionActionsOutput {
  handleVideoClick: (info: VideoClickData) => Promise<void>
  removeClickPoint: (id: string) => Promise<void>
}

export function usePredictionActions({
  clickPoints,
  setClickPoints,
  mainVideoRef,
  overlayCanvasRef,
  currentTime,
  currentTimeRef,
  getFrameIndexForTime,
  activeTrackletId,
  pushHistory,
  setHistoryRedoStack,
  interactions,
  captureVideoFrameToCanvas,
  postPredictAndDraw,
}: UsePredictionActionsInput): UsePredictionActionsOutput {
  const handleVideoClick = useCallback(async (info: VideoClickData) => {
    const video = mainVideoRef.current
    const overlay = overlayCanvasRef.current
    if (!video) return
    try {
      const label: number = typeof info.label === 'number' ? info.label : 1
      const clickTime = typeof info.time === 'number' && Number.isFinite(info.time) ? info.time : currentTime
      const frameIndex = typeof info.frameIndex === 'number' && Number.isFinite(info.frameIndex)
        ? Math.max(0, Math.round(info.frameIndex))
        : getFrameIndexForTime(clickTime)
      const objectId = Math.max(0, Math.min(MAX_TRACKLET_ID, Math.trunc(activeTrackletId)))
      const newPoint: ClickPoint = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        x: info.localX,
        y: info.localY,
        normX: info.normX,
        normY: info.normY,
        time: clickTime,
        frameIndex,
        label,
        objectId,
      }
      const nextPoints = [...clickPoints, newPoint]
      const framePoints = nextPoints.filter(point => point.frameIndex === frameIndex)
      pushHistory(interactions, clickPoints)
      setHistoryRedoStack([])
      setClickPoints(nextPoints)

      const baseCanvas = await captureVideoFrameToCanvas(video)
      const result = await postPredictAndDraw(frameIndex, framePoints, baseCanvas, overlay, { timeoutMs: 20000 })
      if (!result.success) console.error('predict draw failed', result)
    } catch (err) {
      console.error('handleVideoClick error', err)
    }
  }, [activeTrackletId, captureVideoFrameToCanvas, clickPoints, currentTime, getFrameIndexForTime, interactions, mainVideoRef, overlayCanvasRef, postPredictAndDraw, pushHistory, setClickPoints, setHistoryRedoStack])

  const removeClickPoint = useCallback(async (id: string) => {
    const nextPoints = clickPoints.filter(p => p.id !== id)
    pushHistory(interactions, clickPoints)
    setHistoryRedoStack([])
    setClickPoints(nextPoints)
    const video = mainVideoRef.current
    const overlay = overlayCanvasRef.current
    if (!video) return
    try {
      const baseCanvas = await captureVideoFrameToCanvas(video)
      const frameIndex = getFrameIndexForTime(currentTimeRef.current ?? currentTime)
      const framePoints = nextPoints.filter(point => point.frameIndex === frameIndex)
      const result = await postPredictAndDraw(frameIndex, framePoints, baseCanvas, overlay, { timeoutMs: 20000 })
      if (!result.success) console.error('predict draw failed', result)
    } catch (err) {
      console.error('removeClickPoint error', err)
    }
  }, [captureVideoFrameToCanvas, clickPoints, currentTime, currentTimeRef, getFrameIndexForTime, interactions, mainVideoRef, overlayCanvasRef, postPredictAndDraw, pushHistory, setClickPoints, setHistoryRedoStack])

  return {
    handleVideoClick,
    removeClickPoint,
  }
}
