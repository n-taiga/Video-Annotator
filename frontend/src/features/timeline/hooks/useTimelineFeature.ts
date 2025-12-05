import { useRef } from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import type * as d3 from 'd3'
import type { LabelColorMap } from '../../../utils/colors'
import type { TimelineSnapshot, Interaction } from '../types'
import type { UseTimelineModelOutput } from './useTimelineModel'
import { useTimelineAnnotations } from './useTimelineAnnotations'
import type { UseTimelineAnnotationsOutput } from './useTimelineAnnotations'
import { useTimelineContextMenu } from './useTimelineContextMenu'
import type { UseTimelineContextMenuOutput } from './useTimelineContextMenu'
import { useTimelineRenderer } from './useTimelineRenderer'

export interface UseTimelineFeatureInput<TClickPoint extends Record<string, unknown>> {
  model: UseTimelineModelOutput
  actions: string[]
  labelColors: LabelColorMap
  duration: number
  currentTime: number
  currentTimeRef: MutableRefObject<number>
  seekVideo: (time: number) => void
  fps: number
  clickPoints: TClickPoint[]
  setClickPoints: Dispatch<SetStateAction<TClickPoint[]>>
  onSnapshotRestored?: (snapshot: TimelineSnapshot<TClickPoint>) => void | Promise<void>
}

export interface UseTimelineFeatureResult<TClickPoint extends Record<string, unknown>> {
  annotations: UseTimelineAnnotationsOutput<TClickPoint>
  contextMenu: UseTimelineContextMenuOutput
  refs: {
    timelineRef: RefObject<HTMLDivElement>
    svgRef: RefObject<SVGSVGElement>
    xScaleRef: MutableRefObject<d3.ScaleLinear<number, number> | null>
    brushRef: MutableRefObject<d3.BrushBehavior<unknown> | null>
    brushGroupRef: MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>
    timeLineSelectionRef: MutableRefObject<d3.Selection<SVGLineElement, unknown, null, undefined> | null>
    scrubActiveRef: MutableRefObject<boolean>
    hoverTooltipTimerRef: MutableRefObject<number | null>
  }
}

export function useTimelineFeature<TClickPoint extends Record<string, unknown>>({
  model,
  actions,
  labelColors,
  duration,
  currentTime,
  currentTimeRef,
  seekVideo,
  fps,
  clickPoints,
  setClickPoints,
  onSnapshotRestored,
}: UseTimelineFeatureInput<TClickPoint>): UseTimelineFeatureResult<TClickPoint> {
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const xScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null)
  const brushRef = useRef<d3.BrushBehavior<unknown> | null>(null)
  const brushGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const timeLineSelectionRef = useRef<d3.Selection<SVGLineElement, unknown, null, undefined> | null>(null)
  const scrubActiveRef = useRef(false)
  const hoverTooltipTimerRef = useRef<number | null>(null)

  const annotations = useTimelineAnnotations<TClickPoint>({
    actions,
    dragRange: model.dragRange,
    setDragRange: model.setDragRange,
    clickPoints,
    setClickPoints,
    fps,
    onSnapshotRestored,
  })

  const contextMenu = useTimelineContextMenu({
    actions,
    dragRange: model.dragRange,
    interactions: annotations.interactions,
    brushGroupRef,
    addInteraction: annotations.addInteraction,
    setSelectedAction: annotations.setSelectedAction,
  })

  useTimelineRenderer({
    interactions: annotations.interactions,
    duration,
    labelColors,
    dragRange: model.dragRange,
    setDragRange: model.setDragRange,
    openContextMenu: contextMenu.openContextMenu,
    setHoverInfo: model.setHoverInfo,
    hoverTooltipTimerRef,
    currentTime,
    currentTimeRef,
    seekVideo,
    timelineRef,
    svgRef,
    xScaleRef,
    brushRef,
    brushGroupRef,
    timeLineSelectionRef,
    scrubActiveRef,
  })

  return {
    annotations,
    contextMenu,
    refs: {
      timelineRef,
      svgRef,
      xScaleRef,
      brushRef,
      brushGroupRef,
      timeLineSelectionRef,
      scrubActiveRef,
      hoverTooltipTimerRef,
    },
  }
}
