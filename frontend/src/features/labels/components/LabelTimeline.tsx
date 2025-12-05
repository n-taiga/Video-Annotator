import React, { useMemo } from 'react'
import { getLabelColor, LabelColorMap } from '../../../utils/colors'

interface LabelTimelineProps {
  duration: number
  interactions: Array<{
    start_time: number
    end_time: number
    action_label: string
  }>
  labelColors: LabelColorMap
}


type Segment = {
  id: string
  label: string
  left: number
  width: number
  color: string
  start: number
  end: number
}

export default function LabelTimeline({ duration, interactions, labelColors }: LabelTimelineProps) {
  const segments = useMemo<Segment[]>(()=>{
    if(!duration || duration <= 0) return []
    return [...interactions]
      .sort((a,b)=> a.start_time - b.start_time)
      .map((it, index)=>{
        const clampedStart = Math.max(0, Math.min(duration, it.start_time))
        const clampedEnd = Math.max(clampedStart, Math.min(duration, it.end_time))
        const span = clampedEnd - clampedStart
        if(span <= 0) return null
        const left = (clampedStart / duration) * 100
        const rawWidth = (span / duration) * 100
        const width = Math.max(rawWidth, 1)
        const color = getLabelColor(labelColors, it.action_label, '#94a3b8')
        return {
          id: `${it.start_time}-${it.end_time}-${index}`,
          label: it.action_label,
          left,
          width,
          color,
          start: clampedStart,
          end: clampedEnd
        }
      })
      .filter((segment): segment is Segment => Boolean(segment))
  }, [interactions, duration, labelColors])

  const laneAssignments = useMemo(()=>{
    const rows: Segment[][] = []
    const positioned: Array<Segment & { lane: number }> = []
    segments.forEach(segment => {
      let laneIndex = rows.findIndex(lane => segment.start >= lane[lane.length - 1].end - 1e-6)
      if(laneIndex === -1){
        laneIndex = rows.length
        rows.push([])
      }
      rows[laneIndex].push(segment)
      positioned.push({...segment, lane: laneIndex})
    })
    return {
      count: rows.length,
      segments: positioned
    }
  }, [segments])

  const laneHeight = 26
  const laneGap = 4
  const trackHeight = laneAssignments.count > 0
    ? laneAssignments.count * laneHeight + Math.max(0, laneAssignments.count - 1) * laneGap
    : laneHeight
  const trackClassName = laneAssignments.count > 1
    ? 'label-timeline-track stacked'
    : 'label-timeline-track'

  return (
    <div className="label-timeline">
      <div className="label-timeline-header">
        <span>Label Timeline</span>
        <span>{duration ? `${duration.toFixed(2)}s` : 'No duration'}</span>
      </div>
      <div className={trackClassName} style={{height: trackHeight}}>
        {duration && duration > 0 && laneAssignments.count > 0 ? (
          laneAssignments.segments.map(segment => {
            const safeLeft = Math.min(segment.left, 100)
            const safeRight = Math.min(segment.left + segment.width, 100)
            const safeWidth = Math.max(0, safeRight - safeLeft)
            return (
              <div
                key={segment.id}
                className="label-segment"
                style={{
                  left: `${safeLeft}%`,
                  width: `${safeWidth}%`,
                  backgroundColor: segment.color,
                  top: segment.lane * (laneHeight + laneGap),
                  height: laneHeight
                }}
                title={segment.label}
              >
                <span>{segment.label}</span>
              </div>
            )
          })
        ) : (
          <div className="label-timeline-empty">Add interactions to see label changes over time.</div>
        )}
      </div>
    </div>
  )
}
