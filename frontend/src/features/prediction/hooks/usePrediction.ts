import { useCallback, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import { buildApiUrl } from '../../../api'
import { createSessionId } from '../../video'
import type { VideoClickData } from '../../video'
import type { Interaction, TimelineSnapshot } from '../../timeline'
import { getTrackletColor, MAX_TRACKLET_ID } from '../../../utils/mask'
import type { ClickPoint } from '../types'

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
        headers: { 'Content-Type': 'application/json' },
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

      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = overlayCanvas.width
      maskCanvas.height = overlayCanvas.height
      const mctx = maskCanvas.getContext('2d')
      if (!mctx) return { success: false, error: 'no mask 2d context' }
      mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)

      const contentType = (res.headers.get('content-type') || '').toLowerCase()
      if (contentType.includes('application/json')) {
        const json = await res.json()
        try {
          if (typeof console.groupCollapsed === 'function') {
            console.groupCollapsed(`Predict JSON response | session=${json?.sessionId} frame=${json?.frameIndex}`)
            console.log(json)
            console.groupEnd()
          } else {
            console.log('Predict JSON response', json)
          }
        } catch (_err) {
          // ignore logging errors
        }
        const results = Array.isArray(json?.results) ? json.results : []
        for (const r of results) {
          const b64 = r?.mask?.data
          if (!b64) continue
          try {
            const binary = atob(b64)
            const len = binary.length
            const bytes = new Uint8Array(len)
            for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
            const maskBlob = new Blob([bytes], { type: 'image/png' })
            const imgBitmap = await createImageBitmap(maskBlob)
            mctx.drawImage(imgBitmap, 0, 0, maskCanvas.width, maskCanvas.height)
          } catch (err) {
            console.warn('Failed to decode mask from JSON result', err)
            continue
          }
        }
      } else {
        const blob = await res.blob()
        const imgBitmap = await createImageBitmap(blob)
        mctx.drawImage(imgBitmap, 0, 0, maskCanvas.width, maskCanvas.height)
      }

      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(maskCanvas, 0, 0)
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = 'rgba(0, 89, 255, 0.32)'
      ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height)
      ctx.globalCompositeOperation = 'source-over'

      try {
        const w = maskCanvas.width
        const h = maskCanvas.height
        const src = mctx.getImageData(0, 0, w, h)
        const srcData = src.data
        const out = mctx.createImageData(w, h)
        const outData = out.data
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4
            const a = srcData[i + 3]
            if (a > 128) {
              let isEdge = false
              if (x > 0 && srcData[i - 4 + 3] <= 128) isEdge = true
              else if (x < w - 1 && srcData[i + 4 + 3] <= 128) isEdge = true
              else if (y > 0 && srcData[i - w * 4 + 3] <= 128) isEdge = true
              else if (y < h - 1 && srcData[i + w * 4 + 3] <= 128) isEdge = true
              if (isEdge) {
                outData[i + 0] = 255
                outData[i + 1] = 255
                outData[i + 2] = 255
                outData[i + 3] = 255
              }
            }
          }
        }
        const outlineCanvas = document.createElement('canvas')
        outlineCanvas.width = w
        outlineCanvas.height = h
        const octx = outlineCanvas.getContext('2d')
        if (octx) {
          octx.putImageData(out, 0, 0)
          ctx.save()
          ctx.globalCompositeOperation = 'source-over'
          ctx.drawImage(outlineCanvas, 0, 0)
          ctx.globalCompositeOperation = 'source-in'
          ctx.fillStyle = 'rgba(255,255,255,0.95)'
          ctx.fillRect(0, 0, w, h)
          ctx.restore()
          ctx.save()
          ctx.filter = 'blur(0.5px)'
          ctx.globalCompositeOperation = 'source-over'
          ctx.drawImage(outlineCanvas, 0, 0)
          ctx.filter = 'none'
          ctx.restore()
        }
      } catch (err) {
        console.warn('Outline generation failed', err)
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
