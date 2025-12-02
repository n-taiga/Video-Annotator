import React from 'react'

export interface VideoClickData {
  time: number
  localX: number
  localY: number
  normX: number
  normY: number
  videoX?: number
  videoY?: number
  frameIndex?: number
  label: number
}

export function mapClientToVideo(clientX: number, clientY: number, video: HTMLVideoElement) {
  const rect = video.getBoundingClientRect()
  const vidW = video.videoWidth || 0
  const vidH = video.videoHeight || 0

  // compute displayed (rendered) video size inside rect accounting for letterboxing
  let displayedW = rect.width
  let displayedH = rect.height
  let offsetX = 0
  let offsetY = 0
  if (vidW > 0 && vidH > 0) {
    const scale = Math.min(rect.width / vidW, rect.height / vidH)
    displayedW = vidW * scale
    displayedH = vidH * scale
    offsetX = (rect.width - displayedW) / 2
    offsetY = (rect.height - displayedH) / 2
  }

  const localXRaw = clientX - rect.left - offsetX
  const localYRaw = clientY - rect.top - offsetY
  const localX = Math.max(0, Math.min(displayedW, localXRaw))
  const localY = Math.max(0, Math.min(displayedH, localYRaw))

  const normX = displayedW ? localX / displayedW : (rect.width ? (clientX - rect.left) / rect.width : 0)
  const normY = displayedH ? localY / displayedH : (rect.height ? (clientY - rect.top) / rect.height : 0)

  const videoX = vidW ? Math.round(normX * vidW) : undefined
  const videoY = vidH ? Math.round(normY * vidH) : undefined

  const time = video.currentTime || 0

  return { time, localX, localY, normX, normY, videoX, videoY } as VideoClickData
}

interface InteractiveLayerProps {
  videoRef: React.RefObject<HTMLVideoElement>
  onVideoClick?: (data: VideoClickData) => void
  /** If true, clicking while playing will auto-pause and then capture coords (default false) */
  autoPause?: boolean
  /** Optional frames-per-second to compute frame index = round(time * fps) */
  fps?: number
  className?: string
  style?: React.CSSProperties
}

export default function InteractiveLayer({ videoRef, onVideoClick, autoPause = false, fps, className, style }: InteractiveLayerProps) {
  return (
    <div
      role="button"
      aria-label="interactive-layer"
      className={className}
      onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
        const v = videoRef.current
        if (!v) return

        try {
          const button = typeof e.button === 'number' ? e.button : 0
          if (button !== 0 && button !== 2) {
            // Ignore middle or auxiliary buttons entirely
            return
          }
          // Prevent default actions such as context menus when capturing clicks for annotations
          if (button === 2) {
            e.preventDefault()
          }
          const label = button === 2 ? 0 : 1
          if (!v.paused) {
            if (autoPause) {
              // pause first, then compute coords in next tick to ensure currentTime stable
              try {
                v.pause()
              } catch (_err) {
                // ignore
              }
              // compute after frame to let UI update
              requestAnimationFrame(() => {
                const base = mapClientToVideo(e.clientX, e.clientY, v)
                const frameIndex = (typeof fps === 'number' && Number.isFinite(fps)) ? Math.round(base.time * fps) : undefined
                const data = { ...base, frameIndex, label }
                if (typeof onVideoClick === 'function') onVideoClick(data)
              })
              return
            }
            // otherwise ignore clicks while playing
            return
          }

          const base = mapClientToVideo(e.clientX, e.clientY, v)
          const frameIndex = (typeof fps === 'number' && Number.isFinite(fps)) ? Math.round(base.time * fps) : undefined
          const data = { ...base, frameIndex, label }
          if (typeof onVideoClick === 'function') onVideoClick(data)
        } catch (_e) {
          // ignore mapping errors
        }
      }}
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair', background: 'transparent', ...(style || {}) }}
    />
  )
}
