import { useEffect, useRef } from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import * as d3 from 'd3'
import { getTrackletColor, MAX_TRACKLET_ID } from '../../../common/mask'
import { getLabelColor } from '../../../common/colors'
import type { LabelColorMap } from '../../../common/colors'
import type { DragRange } from '../../video'
import type { ContextMenuState, Interaction, SelectionEndpoint, TimelineHoverInfo } from '../types'

export interface UseTimelineRendererInput {
  interactions: Interaction[]
  duration: number
  labelColors: LabelColorMap
  dragRange: DragRange
  setDragRange: Dispatch<SetStateAction<DragRange>>
  openContextMenu: (next: ContextMenuState) => void
  clearSelectionMenuHideTimer: () => void
  setHoverInfo: Dispatch<SetStateAction<TimelineHoverInfo>>
  hoverTooltipTimerRef: MutableRefObject<number | null>
  currentTime: number
  currentTimeRef: MutableRefObject<number>
  seekVideo: (time: number) => void
  fps: number
  timelineRef: RefObject<HTMLDivElement>
  svgRef: RefObject<SVGSVGElement>
  xScaleRef: MutableRefObject<d3.ScaleLinear<number, number> | null>
  brushRef: MutableRefObject<d3.BrushBehavior<unknown> | null>
  brushGroupRef: MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>
  timeLineSelectionRef: MutableRefObject<d3.Selection<SVGLineElement, unknown, null, undefined> | null>
  scrubActiveRef: MutableRefObject<boolean>
  clickPoints?: Array<Record<string, unknown>>
  selectionMenuRef: RefObject<HTMLDivElement>
  selectionMenuHideTimerRef: MutableRefObject<number | null>
  selectionMenuHideDelay: number
  closeContextMenu: () => void
  onSelectionEndpointClick?: (params: { side: SelectionEndpoint; time: number }) => number | undefined
}

export function useTimelineRenderer({
  interactions,
  duration,
  labelColors,
  dragRange,
  setDragRange,
  openContextMenu,
  clearSelectionMenuHideTimer,
  setHoverInfo,
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
  clickPoints = [],
  fps,
  selectionMenuRef,
  selectionMenuHideTimerRef,
  selectionMenuHideDelay,
  closeContextMenu,
  onSelectionEndpointClick,
}: UseTimelineRendererInput) {
  const dragRangeRef = useRef<DragRange>(dragRange)
  const snapToFrame = (time: number) => {
    if (!Number.isFinite(fps) || fps <= 0) return Number(time.toFixed(3))
    const frameNumber = Math.round(time * fps)
    const snapped = frameNumber / fps
    return Number.isFinite(snapped) ? Number(snapped.toFixed(3)) : Number(time.toFixed(3))
  }
  const handlePointerStateRef = useRef({
    pointerId: null as number | null,
    handle: null as 'left' | 'right' | null,
    startX: 0,
    startY: 0,
    dragged: false,
  })
  useEffect(() => {
    if (!timelineRef.current || !svgRef.current) return
    const computedStyle = window.getComputedStyle(timelineRef.current)
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0
    const totalWidth = Math.max(1, timelineRef.current.clientWidth - paddingLeft - paddingRight)
    const margin = { left: 0, right: 0 }
    const innerWidth = Math.max(1, totalWidth - margin.left - margin.right)
    const BASE_HEIGHT = 120
    const ACTION_BAR_HEIGHT = 18
    const ACTION_BAR_Y = 18
    const ACTION_BAR_RADIUS = 8
    // prepare point data early so we can size the svg to include lanes if needed
    const pointData = (clickPoints || []).map(p => p || {})
    const getObjectId = (pt: Record<string, unknown>) => (typeof pt.objectId === 'number' ? (pt.objectId as number) : null)
    // create a fixed list of tracklet ids to always render bars for
    const ids = Array.from({ length: MAX_TRACKLET_ID + 1 }, (_, i) => i)

    // lane layout
    const laneHeight = 8
    const laneGap = 3
    const lanesTopOffset = 0 // reduced offset so lanes sit closer below the base area
    const lanesTop = BASE_HEIGHT + lanesTopOffset
    // compute svg height so the last lane is fully visible (no trailing gap)
    // keep minimal extra bottom padding to avoid clipping of the last lane
    const height = ids.length > 0 ? lanesTop + ids.length * (laneHeight + laneGap) - laneGap + 8 : BASE_HEIGHT

    const svg = d3.select(svgRef.current)
    const svgNode = svg.node()
    svg.attr('width', totalWidth).attr('height', height)
    svg.selectAll('*').remove()

    const x = d3
      .scaleLinear()
      .domain([0, Math.max(duration, 1)])
      .range([margin.left, margin.left + innerWidth])
    xScaleRef.current = x

    const axis = d3.axisBottom(x).ticks(8).tickFormat(d => `${d}s`)
    // keep axis fixed within the base area so added lanes grow below it
    const axisGroup = svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${BASE_HEIGHT - 20})`)
      .call(axis as any)
    axisGroup.style('pointer-events', 'none')
    axisGroup.selectAll('text').style('user-select', 'none')

    svg
      .selectAll('.bar')
      .data(interactions)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d: Interaction) => x(d.start_time))
      .attr('y', ACTION_BAR_Y)
      .attr('width', (d: Interaction) => Math.max(2, x(d.end_time) - x(d.start_time)))
      .attr('height', ACTION_BAR_HEIGHT)
      .attr('rx', ACTION_BAR_RADIUS)
      .attr('ry', ACTION_BAR_RADIUS)
      .attr('fill', (d: Interaction) => getLabelColor(labelColors, d.action_label, '#2563eb'))
      .attr('opacity', 0.8)
      .on('click', (_, d: Interaction) => {
        const start = Number(d.start_time.toFixed(3))
        const end = Number(d.end_time.toFixed(3))
        setDragRange(prev => {
          if (prev.start === start && prev.end === end) return prev
          return { start, end }
        })
      })
      .on('contextmenu', (event: MouseEvent, d: Interaction) => {
        event.preventDefault()
        event.stopPropagation()
        const index = interactions.indexOf(d)
        if (index === -1) return
        openContextMenu({ open: true, x: event.clientX, y: event.clientY, type: 'interaction', targetIndex: index })
      })
      .on('pointerenter', (event: PointerEvent, d: Interaction) => {
        if (hoverTooltipTimerRef.current !== null) {
          window.clearTimeout(hoverTooltipTimerRef.current)
          hoverTooltipTimerRef.current = null
        }
        const index = interactions.indexOf(d)
        const rect = (event.target as Element).getBoundingClientRect()
        setHoverInfo(() => ({
          visible: true,
          x: rect.left + rect.width / 2,
          y: rect.top - 8,
          label: d.action_label,
          color: getLabelColor(labelColors, d.action_label, '#94a3b8'),
          index,
        }))
      })
      .on('pointerleave', () => {
        if (hoverTooltipTimerRef.current !== null) {
          window.clearTimeout(hoverTooltipTimerRef.current)
        }
        hoverTooltipTimerRef.current = window.setTimeout(() => {
          setHoverInfo(h => ({ ...h, visible: false }))
          hoverTooltipTimerRef.current = null
        }, 150)
      })

    const brush = d3
      .brushX()
      // keep the brush in the base area
      .extent([[margin.left, 70], [margin.left + innerWidth, 94]])
      .handleSize(7)
      .on('brush end', event => {
        if (!event.selection) {
          setDragRange(prev => {
            if (prev.start === null && prev.end === null) return prev
            return { start: null, end: null }
          })
          return
        }
        const [sx, ex] = event.selection as [number, number]
        const start = Number(x.invert(sx).toFixed(3))
        const end = Number(x.invert(ex).toFixed(3))
        if (end - start <= 0) {
          return
        }
        setDragRange(prev => {
          if (prev.start === start && prev.end === end) return prev
          return { start, end }
        })
      })

    brushRef.current = brush
    const brushGroup = svg.append('g').attr('class', 'brush').call(brush)
    brushGroup
      .select('.selection')
      .attr('fill', '#4ade80')
      .attr('fill-opacity', 0.25)
      .attr('stroke', 'none')
      .attr('rx', 4)
      .attr('ry', 4)
    const overlay = brushGroup
      .select<SVGRectElement>('.overlay')
      .attr('fill', 'rgba(255, 255, 255, 0.12)')
      .attr('fill-opacity', 0.7)
      .attr('cursor', 'crosshair')
    overlay
      .on('pointerenter.overlay', () => overlay.attr('fill-opacity', 0.18))
      .on('pointerleave.overlay', () => overlay.attr('fill-opacity', 0.12))
    brushGroup
      .selectAll('.handle')
      .attr('fill', '#22c55e')
      .attr('stroke', '#0f172a')
      .attr('rx', 3)
      .attr('ry', 3)
      .on('pointerdown.handle-click', event => {
        const target = event.currentTarget as Element
        const classList = target.getAttribute('class') ?? ''
        const isLeftHandle = classList.includes('handle--w')
        const isRightHandle = classList.includes('handle--e')
        handlePointerStateRef.current = {
          pointerId: event.pointerId,
          handle: isLeftHandle ? 'left' : isRightHandle ? 'right' : null,
          startX: event.clientX,
          startY: event.clientY,
          dragged: false,
        }
      })
    brushGroupRef.current = brushGroup

    const hintY = (80 + 94) / 2
    const hint = svg
      .append('text')
      .attr('class', 'brush-hint')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', hintY)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(148, 163, 184, 0.9)')
      .attr('font-size', 12)
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .text('Drag to select')

    brush.on('end.hint', event => {
      if (event.selection && !hint.empty()) {
        hint.transition().duration(300).style('opacity', 0).on('end', () => hint.remove())
      }
    })

    const timeLineX = x(0)
    const timeLine = svg
      .append('line')
      .attr('y1', 6)
      // limit timeline vertical extent to the base area so lanes are below
      .attr('y2', BASE_HEIGHT - 6)
      .attr('x1', timeLineX)
      .attr('x2', timeLineX)
      .attr('stroke', '#f97316')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
      .attr('pointer-events', 'all')
      .style('cursor', 'ew-resize')
    timeLineSelectionRef.current = timeLine

    const domain = x.domain()
    const clampedInitial = Math.max(domain[0], Math.min(domain[1], currentTimeRef.current))
    if (Number.isFinite(clampedInitial)) {
      const initX = x(clampedInitial)
      timeLine.attr('x1', initX).attr('x2', initX)
    }

    if (svgNode) {
      const seekFromPointer = (event: PointerEvent) => {
        if (!xScaleRef.current) return
        const [px] = d3.pointer(event, svgNode)
        const time = xScaleRef.current.invert(px)
        if (Number.isNaN(time)) return
        seekVideo(snapToFrame(time))
      }

      svg.on('pointerdown.scrub', event => {
        const target = event.target as Element
        if (target.closest('.brush')) return
        if (target.classList && target.classList.contains('bar')) return
        const lineNode = timeLineSelectionRef.current ? timeLineSelectionRef.current.node() : null
        if (lineNode && target !== lineNode) return
        scrubActiveRef.current = true
        seekFromPointer(event as PointerEvent)
        // ensure we continue to receive pointer events even if the pointer
        // leaves the svg (prevents scrub from losing the pointer)
        try {
          if ((svgNode as any).setPointerCapture && typeof event.pointerId === 'number') {
            ;(svgNode as any).setPointerCapture(event.pointerId)
          }
        } catch (_err) {
          // some browsers may throw if capture is not available; ignore
        }
      })

      svg.on('pointermove.scrub', event => {
        if (!scrubActiveRef.current) return
        const pointerEvent = event as PointerEvent
        if (pointerEvent.buttons === 0) {
          scrubActiveRef.current = false
          return
        }
        seekFromPointer(pointerEvent)
      })

      const endScrub = (event?: PointerEvent) => {
        scrubActiveRef.current = false
        try {
          if (event && (svgNode as any).releasePointerCapture && typeof event.pointerId === 'number') {
            ;(svgNode as any).releasePointerCapture(event.pointerId)
          }
        } catch (_err) {
          // ignore
        }
      }

      svg.on('pointerup.scrub', (event: PointerEvent) => endScrub(event))
      svg.on('pointerleave.scrub', (event: PointerEvent) => endScrub(event))
    }

    // Click-point and lane rendering moved to overlay component (TrackletOverlay)

    return () => {
      xScaleRef.current = null
      brushRef.current = null
      brushGroupRef.current = null
      timeLineSelectionRef.current = null
      scrubActiveRef.current = false
      svg.on('.scrub', null)
    }
  }, [
    brushGroupRef,
    brushRef,
    currentTimeRef,
    hoverTooltipTimerRef,
    interactions,
    labelColors,
    openContextMenu,
    scrubActiveRef,
    seekVideo,
    setDragRange,
    setHoverInfo,
    svgRef,
    timelineRef,
    timeLineSelectionRef,
    xScaleRef,
    fps,
    clickPoints,
  ])

  useEffect(() => {
    dragRangeRef.current = dragRange
  }, [dragRange])

  useEffect(() => {
    if (!brushRef.current || !brushGroupRef.current || !xScaleRef.current) return
    if (dragRange.start === null || dragRange.end === null || dragRange.start === dragRange.end) {
      brushGroupRef.current.call(brushRef.current.move as any, null)
      return
    }
    const startX = xScaleRef.current(dragRange.start)
    const endX = xScaleRef.current(dragRange.end)
    brushGroupRef.current.call(brushRef.current.move as any, [startX, endX])
  }, [brushGroupRef, brushRef, dragRange, xScaleRef])

  useEffect(() => {
    if (!timeLineSelectionRef.current || !xScaleRef.current) return
    const x = xScaleRef.current
    const domain = x.domain()
    const clamped = Math.max(domain[0], Math.min(domain[1], currentTime))
    const cx = x(clamped)
    timeLineSelectionRef.current.attr('x1', cx).attr('x2', cx)
  }, [currentTime, timeLineSelectionRef, xScaleRef])

  useEffect(() => {
    if (!brushGroupRef.current) return
    if (dragRange.start === null || dragRange.end === null) return
    const selectionNode = brushGroupRef.current.select<SVGRectElement>('.selection')
    if (selectionNode.empty()) return
    const node = selectionNode.node()
    if (!node) return

    const handlePointerEnter = () => {
      if (dragRange.start === null || dragRange.end === null) return
      clearSelectionMenuHideTimer()
      const rect = node.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = Math.max(rect.top - 12, 12)
      openContextMenu({ open: true, type: 'selection', x, y })
    }

    const handlePointerLeave = (event: PointerEvent) => {
      if (selectionMenuRef.current && event.relatedTarget) {
        try {
          const targetNode = event.relatedTarget as Node
          if (selectionMenuRef.current.contains(targetNode)) {
            return
          }
        } catch (_err) {
          // ignore contains errors
        }
      }
      clearSelectionMenuHideTimer()
      if (selectionMenuHideDelay <= 0) {
        closeContextMenu()
        return
      }
      selectionMenuHideTimerRef.current = window.setTimeout(() => {
        closeContextMenu()
        selectionMenuHideTimerRef.current = null
      }, selectionMenuHideDelay)
    }

    selectionNode.on('pointerenter.selection-hover', () => {
      handlePointerEnter()
    })
    selectionNode.on('pointerleave.selection-hover', (event: PointerEvent) => {
      handlePointerLeave(event)
    })

    return () => {
      selectionNode.on('pointerenter.selection-hover', null)
      selectionNode.on('pointerleave.selection-hover', null)
    }
  }, [brushGroupRef, clearSelectionMenuHideTimer, dragRange, openContextMenu, closeContextMenu, selectionMenuRef, selectionMenuHideTimerRef, selectionMenuHideDelay])

  useEffect(() => {
    const movementThreshold = 4

    const onPointerMove = (event: PointerEvent) => {
      const pointerState = handlePointerStateRef.current
      if (pointerState.pointerId !== event.pointerId) return
      if (pointerState.dragged) return
      const dx = event.clientX - pointerState.startX
      const dy = event.clientY - pointerState.startY
      if (Math.hypot(dx, dy) > movementThreshold) {
        pointerState.dragged = true
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      const pointerState = handlePointerStateRef.current
      if (pointerState.pointerId !== event.pointerId) return
      const handle = pointerState.handle
      const dragged = pointerState.dragged
      pointerState.pointerId = null
      pointerState.handle = null
      pointerState.dragged = false
      if (dragged || !handle) return
      // Previously: clicking a handle would seek the playhead to that endpoint.
      // Requested: disable this auto-seek on click (keep drag behavior intact).
      // No action on simple clicks now; only dragging moves the range.
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [seekVideo, fps, onSelectionEndpointClick])
}
