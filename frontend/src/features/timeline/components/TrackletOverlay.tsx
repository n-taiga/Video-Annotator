import React, { useMemo, useState } from 'react'
import type { MutableRefObject } from 'react'
import * as d3 from 'd3'
import { getTrackletColor, MAX_TRACKLET_ID } from '../../../common/mask'

export interface ClickPoint {
  id?: string
  frameIndex?: number
  time?: number
  objectId?: number
}

interface Props {
  timelineRef: React.RefObject<HTMLDivElement>
  xScaleRef: MutableRefObject<d3.ScaleLinear<number, number> | null> | null
  clickPoints?: ClickPoint[]
  fps?: number
  baseHeight?: number
  onSeek?: (time: number) => void
  onSegmentClick?: (info: { objectId: number | null; startTime: number; endTime: number; midpoint: number }) => void
  activeSegmentKeys?: string[]
  onSegmentToggle?: (segmentKey: string) => void
}

const DEFAULT_BASE_HEIGHT = 120
export default function TrackletOverlay({ timelineRef, xScaleRef, clickPoints = [], fps = 30, baseHeight = DEFAULT_BASE_HEIGHT, onSeek, onSegmentClick, activeSegmentKeys = [], onSegmentToggle }: Props) {
  const ids = useMemo(() => Array.from({ length: MAX_TRACKLET_ID + 1 }, (_, i) => i), [])

  const laneHeight = 8
  const laneGap = 8
  const lanesTopOffset = 8
  const lanesTop = baseHeight + lanesTopOffset

  const computeTime = (pt: ClickPoint) => {
    if (typeof pt.frameIndex === 'number' && Number.isFinite(pt.frameIndex) && fps > 0) {
      return (pt.frameIndex as number) / fps
    }
    if (typeof pt.time === 'number' && Number.isFinite(pt.time)) return pt.time as number
    return 0
  }

  // derive width/height from timelineRef
  const width = timelineRef.current ? Math.max(1, timelineRef.current.clientWidth) : 0
  const svgHeight = ids.length > 0 ? lanesTop + ids.length * (laneHeight + laneGap) - laneGap + 8 : baseHeight

  const xForTime = (t: number) => {
    const x = xScaleRef && xScaleRef.current ? xScaleRef.current(t) : 0
    return x
  }

  const [hoveredSegmentKey, setHoveredSegmentKey] = useState<string | null>(null)

  // Prepare point positions once so we can derive segment click areas between adjacent points on the same lane.
  const pointsWithPos = clickPoints.map((pt, idx) => {
    const t = computeTime(pt)
    const cx = xForTime(t)
    const id = typeof pt.objectId === 'number' ? pt.objectId : null
    let cy = baseHeight - 32
    if (id !== null && id >= 0 && id <= MAX_TRACKLET_ID) {
      const idxLane = id
      cy = lanesTop + idxLane * (laneHeight + laneGap) + laneHeight / 2
    }
    const fill = getTrackletColor(id)
    return { idx, t, cx, cy, id, fill, pointId: pt.id }
  })

  // Build segment click areas between adjacent points on the same lane (objectId).
  const segments = useMemo(() => {
    const map = new Map<number | null, typeof pointsWithPos>()
    for (const p of pointsWithPos) {
      const list = map.get(p.id) ?? []
      list.push(p)
      map.set(p.id, list)
    }
    const segs: Array<{ objectId: number | null; startTime: number; endTime: number; startX: number; endX: number; cy: number; key: string }> = []
    for (const [objectId, list] of map.entries()) {
      list.sort((a, b) => a.t - b.t)
      for (let i = 0; i < list.length - 1; i += 1) {
        const a = list[i]
        const b = list[i + 1]
        const startX = Math.min(a.cx, b.cx)
        const endX = Math.max(a.cx, b.cx)
        if (endX - startX <= 0.5) continue // avoid zero-width hit areas
        const startTime = Math.min(a.t, b.t)
        const endTime = Math.max(a.t, b.t)
        const startId = a.pointId ?? `idx-${a.idx}`
        const endId = b.pointId ?? `idx-${b.idx}`
        const key = `seg-${objectId ?? 'none'}-${startId}-${endId}`
        segs.push({ objectId, startTime, endTime, startX, endX, cy: a.cy, key })
      }
    }
    return segs
  }, [pointsWithPos])

  const segmentHitHeight = Math.max(laneHeight + 6, 12)

  return (
    <div className="timeline-overlay" aria-hidden>
      <svg width={width} height={svgHeight} style={{ width: '100%', height: svgHeight }}>
        <g className="tracklet-bars">
          {ids.map((id, i) => (
            <rect
              key={`bar-${id}`}
              className="tracklet-bar"
              x={0}
              y={lanesTop + i * (laneHeight + laneGap)}
              width={width}
              height={laneHeight}
              rx={3}
              ry={3}
              fill={getTrackletColor(id)}
              opacity={0.08}
              pointerEvents="none"
            />
          ))}
        </g>

        <g className="tracklet-segments">
          {segments.map((seg, i) => {
            const segKey = seg.key ?? `seg-${seg.objectId ?? 'none'}-${i}`
            const handlePointerDown = (e: React.PointerEvent) => {
              e.stopPropagation()
              e.preventDefault()
              const midpoint = Number(((seg.startTime + seg.endTime) / 2).toFixed(3))
              if (onSegmentToggle) onSegmentToggle(segKey)
              if (onSegmentClick) {
                onSegmentClick({ objectId: seg.objectId, startTime: seg.startTime, endTime: seg.endTime, midpoint })
              }
            }
            const y = seg.cy - segmentHitHeight / 2
            const widthSeg = seg.endX - seg.startX
            const isHovered = hoveredSegmentKey === segKey
            const isActive = isHovered || activeSegmentKeys.includes(segKey)
            const baseColor = getTrackletColor(typeof seg.objectId === 'number' ? seg.objectId : null)
            const lineHeight = 2
            const yLine = seg.cy - lineHeight / 2
            return (
              <g key={segKey}>
                <rect
                  className="tracklet-segment-highlight"
                  x={seg.startX}
                  y={yLine}
                  width={widthSeg}
                  height={lineHeight}
                  fill={isActive ? baseColor : 'transparent'}
                  fillOpacity={isActive ? 0.9 : 0}
                  pointerEvents="none"
                />
                <rect
                  className="tracklet-segment-hit"
                  x={seg.startX}
                  y={y}
                  width={widthSeg}
                  height={segmentHitHeight}
                  fill="transparent"
                  style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}
                  pointerEvents="auto"
                  onPointerDown={handlePointerDown}
                  onPointerEnter={() => setHoveredSegmentKey(segKey)}
                  onPointerLeave={() => setHoveredSegmentKey(prev => (prev === segKey ? null : prev))}
                />
              </g>
            )
          })}
        </g>

        <g className="tracklet-points">
          {pointsWithPos.map(pt => {
            const handlePointerDown = (e: React.PointerEvent) => {
              e.stopPropagation()
              e.preventDefault()
              if (typeof onSeek === 'function') onSeek(Number(pt.t))
            }
            return (
              <circle
                key={`pt-${pt.idx}`}
                className="point"
                r={5}
                cx={pt.cx}
                cy={pt.cy}
                fill={pt.fill}
                opacity={0.95}
                style={{ cursor: 'pointer' }}
                onPointerDown={handlePointerDown}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}
