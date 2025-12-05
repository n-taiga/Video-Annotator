import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import type { UseVideoPlayerInput, UseVideoPlayerResult, VideoDetails, FpsSource } from '../types'
import { DEFAULT_VIDEO_FPS } from '../types'

export function useVideoPlayer({ selectedVideoFile, dragRange }: UseVideoPlayerInput): UseVideoPlayerResult {
  const mainVideoRef = useRef<HTMLVideoElement | null>(null)
  const leftVideoRef = useRef<HTMLVideoElement | null>(null)
  const rightVideoRef = useRef<HTMLVideoElement | null>(null)
  const referenceVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const currentTimeRef = useRef(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [videoDetails, setVideoDetails] = useState<VideoDetails>({ width: null, height: null, fps: null, fpsSource: 'assumed' })
  const [pipTop, setPipTop] = useState<number>(100)
  const [pipRight, setPipRight] = useState<number>(12)
  const pipMountedRef = useRef(false)
  const pipDragRef = useRef<{ active: boolean; startX: number; startY: number; startTop: number; startRight: number }>({ active: false, startX: 0, startY: 0, startTop: 0, startRight: 0 })
  const PIP_WIDTH = 320
  const PIP_HEIGHT = 180

  useEffect(() => {
    const v = mainVideoRef.current
    if (!v) return
    v.volume = Math.max(0, Math.min(1, volume))
    v.muted = muted
  }, [volume, muted, selectedVideoFile])

  useEffect(() => {
    const refs: Array<HTMLVideoElement | null> = [mainVideoRef.current, leftVideoRef.current, rightVideoRef.current]
    Object.values(referenceVideoRefs.current || {}).forEach(r => refs.push(r))
    refs.forEach(video => {
      if (!video) return
      try {
        video.playbackRate = playbackRate
      } catch (_e) {
        // ignore if not ready or unsupported
      }
    })
  }, [playbackRate, selectedVideoFile])

  useEffect(() => {
    if (!selectedVideoFile) {
      return
    }
    setCurrentTime(0)
    setDuration(0)
    const refs = [mainVideoRef.current, leftVideoRef.current, rightVideoRef.current]
    refs.forEach(video => {
      if (!video) return
      video.pause()
      video.currentTime = 0
      video.load()
    })
  }, [selectedVideoFile])

  useEffect(() => {
    currentTimeRef.current = currentTime
  }, [currentTime])

  useEffect(() => {
    if (!selectedVideoFile) return
    const v = mainVideoRef.current
    if (!v) return

    const refreshVideoMeta = () => {
      setVideoDetails(prev => {
        const width = v.videoWidth || null
        const height = v.videoHeight || null
        const fallbackFps = prev.fps != null ? prev.fps : DEFAULT_VIDEO_FPS
        const normalizedFps = Number.isFinite(fallbackFps) ? Math.round(fallbackFps * 100) / 100 : null
        const fpsSource: FpsSource = 'assumed'
        if (prev.width === width && prev.height === height && prev.fps === normalizedFps && prev.fpsSource === fpsSource) {
          return prev
        }
        return {
          width,
          height,
          fps: normalizedFps,
          fpsSource
        }
      })
    }

    const onLoaded = () => {
      setDuration(v.duration)
      refreshVideoMeta()
    }
    const onTime = () => {
      setCurrentTime(v.currentTime)
      refreshVideoMeta()
    }
    const onPlay = () => {
      refreshVideoMeta()
    }
    const onMainPlayForRef = () => {
      Object.values(referenceVideoRefs.current || {}).forEach(rv => {
        if (!rv) return
        try { rv.currentTime = v.currentTime } catch (_e) { }
        rv.play().catch(() => { })
      })
    }
    const onMainPauseForRef = () => {
      Object.values(referenceVideoRefs.current || {}).forEach(rv => {
        if (!rv) return
        try { rv.pause() } catch (_e) { }
      })
    }

    v.addEventListener('loadedmetadata', onLoaded)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('play', onPlay)
    v.addEventListener('play', onMainPlayForRef)
    v.addEventListener('pause', onMainPauseForRef)
    refreshVideoMeta()

    return () => {
      v.removeEventListener('loadedmetadata', onLoaded)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('play', onMainPlayForRef)
      v.removeEventListener('pause', onMainPauseForRef)
    }
  }, [selectedVideoFile])

  const onPipPointerMove = useCallback((ev: PointerEvent) => {
    if (!pipDragRef.current.active) return
    const deltaX = ev.clientX - pipDragRef.current.startX
    const deltaY = ev.clientY - pipDragRef.current.startY
    let newTop = pipDragRef.current.startTop + deltaY
    let newRight = pipDragRef.current.startRight - deltaX
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    newTop = Math.max(margin, Math.min(vh - PIP_HEIGHT - margin, newTop))
    newRight = Math.max(margin, Math.min(vw - PIP_WIDTH - margin, newRight))
    setPipTop(newTop)
    setPipRight(newRight)
  }, [])

  const endPipDrag = useCallback(() => {
    if (!pipDragRef.current.active) return
    pipDragRef.current.active = false
    window.removeEventListener('pointermove', onPipPointerMove)
    window.removeEventListener('pointerup', endPipDrag)
  }, [onPipPointerMove])

  const startPipDrag = useCallback((ev: React.PointerEvent) => {
    if (ev.button !== 0) return
    try {
      const tgt = ev.target as HTMLElement | null
      if (tgt && typeof tgt.closest === 'function') {
        const isInteractive = tgt.closest('button, a, input, textarea, select, [role="button"]') as HTMLElement | null
        if (isInteractive && ev.currentTarget && (ev.currentTarget as HTMLElement).contains(isInteractive)) return
      }
    } catch (_e) {
      // ignore and continue
    }
    ev.currentTarget.setPointerCapture?.(ev.nativeEvent.pointerId)
    pipDragRef.current.active = true
    pipDragRef.current.startX = ev.nativeEvent.clientX
    pipDragRef.current.startY = ev.nativeEvent.clientY
    pipDragRef.current.startTop = pipTop
    pipDragRef.current.startRight = pipRight
    window.addEventListener('pointermove', onPipPointerMove)
    window.addEventListener('pointerup', endPipDrag)
  }, [onPipPointerMove, pipTop, pipRight, endPipDrag])

  useEffect(() => {
    if (!pipMountedRef.current) {
      pipMountedRef.current = true
      try {
        const root = document.documentElement
        const val = window.getComputedStyle(root).getPropertyValue('--header-height') || ''
        const pxMatch = val.match(/(-?\d+(?:\.\d+)?)px/)
        const headerPx = pxMatch ? Number(pxMatch[1]) : null
        if (headerPx != null && Number.isFinite(headerPx)) {
          setPipTop(headerPx + 100)
        }
      } catch (_e) {
        // ignore and keep default
      }
    }
    return () => {
      window.removeEventListener('pointermove', onPipPointerMove)
      window.removeEventListener('pointerup', endPipDrag)
    }
  }, [onPipPointerMove, endPipDrag])

  useEffect(() => {
    const lv = leftVideoRef.current
    const rv = rightVideoRef.current
    if (lv && dragRange.start !== null) {
      lv.currentTime = dragRange.start
    }
    if (rv && dragRange.end !== null) {
      rv.currentTime = dragRange.end
    }
  }, [dragRange])

  const seekVideo = useCallback((time: number) => {
    const video = mainVideoRef.current
    if (!video) return
    const maxDuration = Number.isFinite(duration) && duration > 0 ? duration : video.duration
    if (!Number.isFinite(maxDuration) || maxDuration <= 0) return
    const clamped = Math.max(0, Math.min(maxDuration, time))
    if (Number.isNaN(clamped)) return
    video.currentTime = clamped
    setCurrentTime(clamped)
    try {
      Object.values(referenceVideoRefs.current || {}).forEach(ref => {
        if (!ref) return
        try {
          if (typeof ref.currentTime === 'number') ref.currentTime = clamped
        } catch (_e) {
          // ignore
        }
      })
    } catch (_err) {
      // ignore
    }
  }, [duration])

  return {
    mainVideoRef,
    leftVideoRef,
    rightVideoRef,
    referenceVideoRefs,
    duration,
    currentTime,
    currentTimeRef,
    videoDetails,
    volume,
    muted,
    playbackRate,
    setVolume,
    setMuted,
    setPlaybackRate,
    seekVideo,
    pipTop,
    pipRight,
    pipWidth: PIP_WIDTH,
    pipHeight: PIP_HEIGHT,
    startPipDrag,
  }
}
