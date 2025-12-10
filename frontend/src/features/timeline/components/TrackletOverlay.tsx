import React, { useMemo } from 'react'
import type { MutableRefObject } from 'react'
import * as d3 from 'd3'
import { getTrackletColor, MAX_TRACKLET_ID } from '../../../common/mask'

export interface ClickPoint {
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
}

const DEFAULT_BASE_HEIGHT = 120
export default function TrackletOverlay({ timelineRef, xScaleRef, clickPoints = [], fps = 30, baseHeight = DEFAULT_BASE_HEIGHT, onSeek }: Props) {
  const ids = useMemo(() => Array.from({ length: MAX_TRACKLET_ID + 1 }, (_, i) => i), [])

  const laneHeight = 8
  const laneGap = 6
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
        <g className="tracklet-points">
          {clickPoints.map((pt, idx) => {
            const t = computeTime(pt)
            const cx = xForTime(t)
            const id = typeof pt.objectId === 'number' ? pt.objectId : null
            let cy = baseHeight - 32
            if (id !== null && id >= 0 && id <= MAX_TRACKLET_ID) {
              const idxLane = id
              cy = lanesTop + idxLane * (laneHeight + laneGap) + laneHeight / 2
            }
            const fill = getTrackletColor(id)
            const handlePointerDown = (e: React.PointerEvent) => {
              e.stopPropagation()
              e.preventDefault()
              if (typeof onSeek === 'function') onSeek(Number(t))
            }
            return (
              <circle
                key={`pt-${idx}`}
                className="point"
                r={4}
                cx={cx}
                cy={cy}
                fill={fill}
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
