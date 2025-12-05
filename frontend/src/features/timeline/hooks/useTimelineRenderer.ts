import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import * as d3 from 'd3'
import { getLabelColor } from '../../../common/colors'
import type { LabelColorMap } from '../../../common/colors'
import type { DragRange } from '../../video'
import type { ContextMenuState, Interaction, TimelineHoverInfo } from '../types'

export interface UseTimelineRendererInput {
  interactions: Interaction[]
  duration: number
  labelColors: LabelColorMap
  dragRange: DragRange
  setDragRange: Dispatch<SetStateAction<DragRange>>
  openContextMenu: (next: ContextMenuState) => void
  setHoverInfo: Dispatch<SetStateAction<TimelineHoverInfo>>
  hoverTooltipTimerRef: MutableRefObject<number | null>
  currentTime: number
  currentTimeRef: MutableRefObject<number>
  seekVideo: (time: number) => void
  timelineRef: RefObject<HTMLDivElement>
  svgRef: RefObject<SVGSVGElement>
  xScaleRef: MutableRefObject<d3.ScaleLinear<number, number> | null>
  brushRef: MutableRefObject<d3.BrushBehavior<unknown> | null>
  brushGroupRef: MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>
  timeLineSelectionRef: MutableRefObject<d3.Selection<SVGLineElement, unknown, null, undefined> | null>
  scrubActiveRef: MutableRefObject<boolean>
}

export function useTimelineRenderer({
  interactions,
  duration,
  labelColors,
  dragRange,
  setDragRange,
  openContextMenu,
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
}: UseTimelineRendererInput) {
  useEffect(() => {
    if (!timelineRef.current || !svgRef.current) return
    const totalWidth = Math.max(1, timelineRef.current.clientWidth)
    const margin = { left: 10, right: 30 }
    const innerWidth = Math.max(1, totalWidth - margin.left - margin.right)
    const height = 120
    const ACTION_BAR_HEIGHT = 18
    const ACTION_BAR_Y = 18
    const ACTION_BAR_RADIUS = 8
    const svg = d3.select(svgRef.current)
    svg.attr('width', totalWidth).attr('height', height)
    svg.selectAll('*').remove()

    const x = d3
      .scaleLinear()
      .domain([0, Math.max(duration, 1)])
      .range([margin.left, margin.left + innerWidth])
    xScaleRef.current = x

    const axis = d3.axisBottom(x).ticks(8).tickFormat(d => `${d}s`)
    const axisGroup = svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height - 20})`)
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
      .extent([[margin.left, 70], [margin.left + innerWidth, 94]])
      .handleSize(12)
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
      .attr('y2', height - 6)
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

    const svgNode = svg.node()
    if (svgNode) {
      const seekFromPointer = (event: PointerEvent) => {
        if (!xScaleRef.current) return
        const [px] = d3.pointer(event, svgNode)
        const time = xScaleRef.current.invert(px)
        if (Number.isNaN(time)) return
        seekVideo(time)
      }

      svg.on('pointerdown.scrub', event => {
        const target = event.target as Element
        if (target.closest('.brush')) return
        if (target.classList && target.classList.contains('bar')) return
        const lineNode = timeLineSelectionRef.current ? timeLineSelectionRef.current.node() : null
        if (lineNode && target !== lineNode) return
        scrubActiveRef.current = true
        seekFromPointer(event as PointerEvent)
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

      const endScrub = () => {
        scrubActiveRef.current = false
      }

      svg.on('pointerup.scrub', endScrub)
      svg.on('pointerleave.scrub', endScrub)
    }

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
    duration,
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
  ])

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
}
