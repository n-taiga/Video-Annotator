import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DragRange } from '../../video'
import type { TimelineHoverInfo } from '../types'

export interface UseTimelineModelOutput {
  dragRange: DragRange
  setDragRange: Dispatch<SetStateAction<DragRange>>
  hoverInfo: TimelineHoverInfo
  setHoverInfo: Dispatch<SetStateAction<TimelineHoverInfo>>
}

const DEFAULT_DRAG_RANGE: DragRange = { start: null, end: null }
const DEFAULT_HOVER_INFO: TimelineHoverInfo = {
  visible: false,
  x: 0,
  y: 0,
  label: '',
  color: '#94a3b8',
  index: null,
}

export function useTimelineModel(): UseTimelineModelOutput {
  const [dragRange, setDragRange] = useState<DragRange>(DEFAULT_DRAG_RANGE)
  const [hoverInfo, setHoverInfo] = useState<TimelineHoverInfo>(DEFAULT_HOVER_INFO)

  return {
    dragRange,
    setDragRange,
    hoverInfo,
    setHoverInfo,
  }
}
