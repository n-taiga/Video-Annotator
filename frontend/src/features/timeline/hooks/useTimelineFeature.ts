import { useCallback, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import type * as d3 from 'd3'
import type { LabelColorMap } from '../../../common/colors'
import type { TimelineSnapshot, Interaction } from '../types'
import type { UseTimelineModelOutput } from './useTimelineModel'
import { useTimelineAnnotations } from './useTimelineAnnotations'
import type { UseTimelineAnnotationsOutput } from './useTimelineAnnotations'
import { useTimelineContextMenu } from './useTimelineContextMenu'
import type { UseTimelineContextMenuOutput } from './useTimelineContextMenu'
import { useTimelineRenderer } from './useTimelineRenderer'
import { DEFAULT_VIDEO_FPS } from '../../video'
import type { SelectionEndpoint, SelectionEndpointClickEvent } from '../types'

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
  onSelectionEndpointClick?: (event: SelectionEndpointClickEvent<TClickPoint>) => number | undefined
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
  selection: {
    repositionToTime: (time: number) => void
    hasClickPointsAtEndpoint: (side: SelectionEndpoint) => boolean
    endpointClickEvent: SelectionEndpointClickEvent<TClickPoint> | null
  }
}

const DEFAULT_SELECTION_LENGTH = 1.0
const HIDE_DELAY_ON_SELECTION_LEAVE = 120

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
  onSelectionEndpointClick,
}: UseTimelineFeatureInput<TClickPoint>): UseTimelineFeatureResult<TClickPoint> {
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const xScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null)
  const brushRef = useRef<d3.BrushBehavior<unknown> | null>(null)
  const brushGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const timeLineSelectionRef = useRef<d3.Selection<SVGLineElement, unknown, null, undefined> | null>(null)
  const scrubActiveRef = useRef(false)
  const hoverTooltipTimerRef = useRef<number | null>(null)

  const { dragRange, setDragRange, setHoverInfo } = model

  const annotations = useTimelineAnnotations<TClickPoint>({
    actions,
    dragRange,
    setDragRange,
    clickPoints,
    setClickPoints,
    fps,
    onSnapshotRestored,
  })

  const contextMenu = useTimelineContextMenu({
    actions,
    dragRange,
    interactions: annotations.interactions,
    brushGroupRef,
    addInteraction: annotations.addInteraction,
    setSelectedAction: annotations.setSelectedAction,
  })

  const fpsValue = Number.isFinite(fps) && fps > 0 ? fps : DEFAULT_VIDEO_FPS
  const clickPointsByFrame = useMemo(() => {
    const map = new Map<number, TClickPoint[]>()
    for (const point of clickPoints) {
      const frameIndexValue = typeof point.frameIndex === 'number' && Number.isFinite(point.frameIndex)
        ? Math.trunc(point.frameIndex)
        : (() => {
            const timeValue = typeof (point as Record<string, unknown>).time === 'number' && Number.isFinite((point as Record<string, unknown>).time)
              ? (point as Record<string, unknown>).time as number
              : 0
            return Math.round(timeValue * fpsValue)
          })()
      const list = map.get(frameIndexValue) ?? []
      list.push(point)
      map.set(frameIndexValue, list)
    }
    return map
  }, [clickPoints, fpsValue])

  const [endpointClickEvent, setEndpointClickEvent] = useState<SelectionEndpointClickEvent<TClickPoint> | null>(null)

  const hasClickPointsAtEndpoint = useCallback(
    (side: SelectionEndpoint) => {
      const time = side === 'start' ? dragRange.start : dragRange.end
      if (time === null) return false
      const frameIndex = Math.round(time * fpsValue)
      return (clickPointsByFrame.get(frameIndex)?.length ?? 0) > 0
    },
    [clickPointsByFrame, dragRange.end, dragRange.start, fpsValue],
  )

  const handleSelectionHandleClick = useCallback(
    ({ side, time }: { side: SelectionEndpoint; time: number }) => {
      const frameIndex = Math.round(time * fpsValue)
      const points = clickPointsByFrame.get(frameIndex) ?? []
      const event: SelectionEndpointClickEvent<TClickPoint> = {
        side,
        time,
        frameIndex,
        clickPoints: points,
        hasClickPoints: points.length > 0,
      }
      setEndpointClickEvent(event)
      if (onSelectionEndpointClick) {
        onSelectionEndpointClick(event)
      }
      if (points.length === 0) {
        return undefined
      }
      const [firstPoint] = points
      const pointFrameIndex = typeof firstPoint.frameIndex === 'number' && Number.isFinite(firstPoint.frameIndex)
        ? Math.max(0, Math.round(firstPoint.frameIndex))
        : undefined
      if (typeof pointFrameIndex === 'number' && fpsValue > 0) {
        return Number((pointFrameIndex / fpsValue).toFixed(3))
      }
      const fallbackTime = typeof firstPoint.time === 'number' && Number.isFinite(firstPoint.time)
        ? firstPoint.time
        : undefined
      return typeof fallbackTime === 'number' && Number.isFinite(fallbackTime) ? Number(fallbackTime.toFixed(3)) : undefined
    },
    [clickPointsByFrame, fpsValue, onSelectionEndpointClick],
  )

  useTimelineRenderer({
    interactions: annotations.interactions,
    duration,
    labelColors,
    dragRange,
    setDragRange,
    openContextMenu: contextMenu.openContextMenu,
    clearSelectionMenuHideTimer: contextMenu.clearSelectionMenuHideTimer,
    setHoverInfo,
    hoverTooltipTimerRef,
    currentTime,
    currentTimeRef,
    seekVideo,
    fps,
    timelineRef,
    svgRef,
    xScaleRef,
    brushRef,
    brushGroupRef,
    timeLineSelectionRef,
    scrubActiveRef,
    selectionMenuRef: contextMenu.selectionMenuRef,
    selectionMenuHideTimerRef: contextMenu.selectionMenuHideTimerRef,
    selectionMenuHideDelay: HIDE_DELAY_ON_SELECTION_LEAVE,
    closeContextMenu: contextMenu.closeContextMenu,
    onSelectionEndpointClick: handleSelectionHandleClick,
    clickPoints,
  })

  const clampAndFormatTime = useCallback((value: number) => {
    const maxDuration = Number.isFinite(duration) && duration > 0 ? duration : value
    const clamped = Number.isFinite(maxDuration) ? Math.max(0, Math.min(maxDuration, value)) : Math.max(0, value)
    return Number.isFinite(clamped) ? Number(clamped.toFixed(3)) : 0
  }, [duration])

  const repositionDragRangeToTime = useCallback((time: number) => {
    const clampedTime = clampAndFormatTime(time)
    setDragRange(prev => {
      const { start, end } = prev
      const createCenteredRange = (target: number) => {
        const half = DEFAULT_SELECTION_LENGTH / 2
        let newStart = clampAndFormatTime(target - half)
        let newEnd = clampAndFormatTime(target + half)
        if (newEnd <= newStart) {
          newStart = clampAndFormatTime(target - DEFAULT_SELECTION_LENGTH)
          newEnd = clampAndFormatTime(newStart + DEFAULT_SELECTION_LENGTH)
        }
        if (newEnd <= newStart) {
          newEnd = clampAndFormatTime(newStart + 0.001)
        }
        return { start: newStart, end: newEnd }
      }
      if (start === null || end === null || end <= start) {
        return createCenteredRange(clampedTime)
      }
      const midpoint = (start + end) / 2
      if (clampedTime > midpoint) {
        const proposedEnd = Math.max(start, clampedTime)
        if (proposedEnd === end) return prev
        return { start, end: proposedEnd }
      }
      const proposedStart = Math.min(end, clampedTime)
      if (proposedStart === start) return prev
      return { start: proposedStart, end }
    })
  }, [clampAndFormatTime, setDragRange])

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
    selection: {
      repositionToTime: repositionDragRangeToTime,
      hasClickPointsAtEndpoint,
      endpointClickEvent,
    },
  }
}
