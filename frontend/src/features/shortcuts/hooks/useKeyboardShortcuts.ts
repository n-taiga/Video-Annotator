import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import type * as d3 from 'd3'
import type { ContextMenuState, Interaction, TimelineHoverInfo } from '../../timeline'
import type { DragRange } from '../../video'

interface UseKeyboardShortcutsInput {
  undo: () => void
  redo: () => void
  contextMenu: ContextMenuState
  mainVideoRef: RefObject<HTMLVideoElement>
  duration: number
  dragRange: DragRange
  setDragRange: Dispatch<SetStateAction<DragRange>>
  actions: string[]
  setSelectionMenuAction: Dispatch<SetStateAction<string>>
  openContextMenu: (state: ContextMenuState) => void
  currentTime: number
  svgRef: RefObject<SVGSVGElement>
  xScaleRef: MutableRefObject<d3.ScaleLinear<number, number> | null>
  timelineRef: RefObject<HTMLDivElement>
  setSelectionDropdownOpen: Dispatch<SetStateAction<boolean>>
  clearSelectionMenuHideTimer: () => void
  hoverTooltipTimerRef: MutableRefObject<number | null>
  setHoverInfo: Dispatch<SetStateAction<TimelineHoverInfo>>
  closeContextMenu: () => void
  seekVideo: (time: number) => void
  addInteraction: (labelOverride?: string, rangeOverride?: { start: number; end: number }) => void
  interactions: Interaction[]
  removeInteraction: (index: number) => void
  hoverInfo: TimelineHoverInfo
  setContact: Dispatch<SetStateAction<boolean>>
  selectionMenuAction: string
}

export function useKeyboardShortcuts({
  undo,
  redo,
  contextMenu,
  mainVideoRef,
  duration,
  dragRange,
  setDragRange,
  actions,
  setSelectionMenuAction,
  openContextMenu,
  currentTime,
  svgRef,
  xScaleRef,
  timelineRef,
  setSelectionDropdownOpen,
  clearSelectionMenuHideTimer,
  hoverTooltipTimerRef,
  setHoverInfo,
  closeContextMenu,
  seekVideo,
  addInteraction,
  interactions,
  removeInteraction,
  hoverInfo,
  setContact,
  selectionMenuAction,
}: UseKeyboardShortcutsInput) {
  // Optional: Keyboard shortcuts for undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrlOrMeta = e.ctrlKey || e.metaKey
      if (!ctrlOrMeta) return
      if (e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault()
          redo()
        } else {
          e.preventDefault()
          undo()
        }
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Global playback/seek shortcuts: Space toggles play/pause, ArrowLeft/ArrowRight seek ±1s.
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      // Ignore when modifier keys used (allow Ctrl/Cmd combos for other shortcuts)
      if (e.ctrlKey || e.metaKey) return
      // Ignore when focus is in an input, textarea, select or contenteditable
      // — but if the selection context menu is open, allow handling so
      // shortcuts like 'W' / 'S' still work even though the <select> has focus.
      const active = document.activeElement as HTMLElement | null
      if (active) {
        const tag = active.tagName
        const editable = active.getAttribute && (active.getAttribute('contenteditable') === 'true' || active.isContentEditable)
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) {
          if (!(contextMenu.open && contextMenu.type === 'selection')) return
        }
      }

      const v = mainVideoRef.current
      if (!v) return

      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        if (v.paused) {
          v.play().catch(() => { })
        } else {
          v.pause()
        }
      } else if (e.key && e.key.toLowerCase() === 'a') {
        // Set selection start to current time. If no selection exists,
        // create a default-length selection starting at currentTime.
        e.preventDefault()
        const DEFAULT_SELECTION_LEN = 1.0 // seconds
        const maxDuration = Number.isFinite(duration) && duration > 0 ? duration : v.duration
        const clampTime = (t: number) => (Number.isFinite(maxDuration) ? Math.max(0, Math.min(maxDuration, t)) : t)
        const t = clampTime(currentTime || 0)
        const start = Number(t.toFixed(3))
        // If no selection exists, create it and open the selection menu just
        // like the 'S' key does so the menu receives focus immediately.
        if (dragRange.start === null && dragRange.end === null) {
          let rawEnd = clampTime(start + DEFAULT_SELECTION_LEN)
          let end = Number(rawEnd.toFixed(3))
          if (end <= start) {
            end = Number(Math.min((Number.isFinite(maxDuration) ? maxDuration : start + 0.001), start + 0.001).toFixed(3))
          }
          setDragRange({ start, end })

          // Compute menu position (prefer SVG scale, else timeline bbox)
          let menuX = window.innerWidth / 2
          let menuY = 100
          try {
            const s = svgRef.current
            if (s && xScaleRef.current && typeof start === 'number' && typeof end === 'number') {
              const rect = s.getBoundingClientRect()
              const centerTime = (start + end) / 2
              const cx = xScaleRef.current(centerTime)
              menuX = rect.left + cx
              menuY = Math.max(rect.top - 12, 12)
            } else if (timelineRef.current) {
              const rect = timelineRef.current.getBoundingClientRect()
              menuX = rect.left + rect.width / 2
              menuY = Math.max(rect.top - 12, 12)
            }
          } catch (_e) {
            // ignore and use defaults
          }

          setSelectionMenuAction(prev => (actions.includes(prev) ? prev : actions[0] ?? ''))
          openContextMenu({ open: true, type: 'selection', x: menuX, y: menuY })
        } else {
          setDragRange(prev => {
            const prevEnd = prev.end
            // If both ends exist and start is after end, swap so start <= end
            if (prevEnd !== null && start > prevEnd) {
              return { start: prevEnd, end: start }
            }
            if (prev.start === start && prev.end === prevEnd) return prev
            return { start, end: prevEnd }
          })
        }
      } else if (e.key && e.key.toLowerCase() === 'd') {
        // Set selection end to current time. If no selection exists,
        // create a default-length selection ending at currentTime.
        e.preventDefault()
        const DEFAULT_SELECTION_LEN = 1.0 // seconds
        const maxDuration = Number.isFinite(duration) && duration > 0 ? duration : v.duration
        const clampTime = (t: number) => (Number.isFinite(maxDuration) ? Math.max(0, Math.min(maxDuration, t)) : t)
        const t = clampTime(currentTime || 0)
        const end = Number(t.toFixed(3))
        // If no selection exists, create it and open the selection menu like 'S'
        if (dragRange.start === null && dragRange.end === null) {
          let rawStart = clampTime(end - DEFAULT_SELECTION_LEN)
          let start = Number(rawStart.toFixed(3))
          if (end <= start) start = Number(Math.max(0, end - 0.001).toFixed(3))
          setDragRange({ start, end })

          let menuX = window.innerWidth / 2
          let menuY = 100
          try {
            const s = svgRef.current
            if (s && xScaleRef.current && typeof start === 'number' && typeof end === 'number') {
              const rect = s.getBoundingClientRect()
              const centerTime = (start + end) / 2
              const cx = xScaleRef.current(centerTime)
              menuX = rect.left + cx
              menuY = Math.max(rect.top - 12, 12)
            } else if (timelineRef.current) {
              const rect = timelineRef.current.getBoundingClientRect()
              menuX = rect.left + rect.width / 2
              menuY = Math.max(rect.top - 12, 12)
            }
          } catch (_e) {
            // ignore and use defaults
          }

          setSelectionMenuAction(prev => (actions.includes(prev) ? prev : actions[0] ?? ''))
          openContextMenu({ open: true, type: 'selection', x: menuX, y: menuY })
        } else {
          setDragRange(prev => {
            const prevStart = prev.start
            // If both ends exist and start is after end, swap so start <= end
            if (prevStart !== null && prevStart > end) {
              return { start: end, end: prevStart }
            }
            if (prevStart === prev.start && prev.end === end) return prev
            return { start: prevStart, end }
          })
        }
      } else if (e.key && e.key.toLowerCase() === 's') {
        // Open selection label console. If no selection exists, create a
        // default-length selection centered on currentTime, then open the
        // selection context menu positioned above the timeline selection.
        e.preventDefault()
        const DEFAULT_SELECTION_LEN = 1.0
        const maxDuration = Number.isFinite(duration) && duration > 0 ? duration : v.duration
        const clampTime = (t: number) => (Number.isFinite(maxDuration) ? Math.max(0, Math.min(maxDuration, t)) : t)
        const t = clampTime(currentTime || 0)

        let start = dragRange.start
        let end = dragRange.end
        if (start === null || end === null) {
          // create centered selection of DEFAULT_SELECTION_LEN
          const half = DEFAULT_SELECTION_LEN / 2
          const rawStart = clampTime(t - half)
          const rawEnd = clampTime(t + half)
          start = Number(rawStart.toFixed(3))
          end = Number(rawEnd.toFixed(3))
          // ensure non-zero length
          if (end <= start) {
            end = Number(Math.min((Number.isFinite(maxDuration) ? maxDuration : start + 0.001), start + 0.001).toFixed(3))
          }
          setDragRange({ start, end })
        }

        // Compute menu position. Prefer SVG x-scale if available, else fallback
        // to timeline element bounding box.
        let menuX = window.innerWidth / 2
        let menuY = 100
        try {
          const s = svgRef.current
          if (s && xScaleRef.current && typeof start === 'number' && typeof end === 'number') {
            const rect = s.getBoundingClientRect()
            const centerTime = (start + end) / 2
            const cx = xScaleRef.current(centerTime)
            menuX = rect.left + cx
            menuY = Math.max(rect.top - 12, 12)
          } else if (timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect()
            menuX = rect.left + rect.width / 2
            menuY = Math.max(rect.top - 12, 12)
          }
        } catch (_e) {
          // ignore and use defaults
        }

        setSelectionMenuAction(prev => (actions.includes(prev) ? prev : actions[0] ?? ''))
        openContextMenu({ open: true, type: 'selection', x: menuX, y: menuY })
      } else if (e.key && e.key.toLowerCase() === 'w') {
        // Toggle contact (on/off)
        e.preventDefault()
        setContact(c => !c)
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && contextMenu.open && contextMenu.type === 'selection') {
        // When the selection menu is open, allow ArrowUp / ArrowDown to
        // change the currently-highlighted label in the selection menu.
        e.preventDefault()
        const cur = actions.indexOf(selectionMenuAction)
        if (e.key === 'ArrowUp') {
          // move to previous if possible
          const prevIdx = cur > 0 ? cur - 1 : 0
          if (actions[prevIdx] && actions[prevIdx] !== selectionMenuAction) setSelectionMenuAction(actions[prevIdx])
        } else {
          // ArrowDown: move to next if possible
          const nextIdx = cur === -1 ? 0 : Math.min(actions.length - 1, cur + 1)
          if (actions[nextIdx] && actions[nextIdx] !== selectionMenuAction) setSelectionMenuAction(actions[nextIdx])
        }
      } else if (e.key === 'Enter') {
        // Global Enter: always try to Add Action (unless focus is in a
        // text input/textarea/select — focus guard above prevents that).
        // If the selection context menu is open we let the local menu
        // handler handle Enter to avoid duplicate additions.
        if (contextMenu.open && contextMenu.type === 'selection') {
          // do nothing here; local menu listener will handle Enter
        } else {
          e.preventDefault()
          const DEFAULT_SELECTION_LEN = 1.0
          const maxDuration = Number.isFinite(duration) && duration > 0 ? duration : (v ? v.duration : NaN)
          const clampTime = (t: number) => (Number.isFinite(maxDuration) ? Math.max(0, Math.min(maxDuration, t)) : t)
          const t = clampTime(currentTime || 0)
          if (dragRange.start !== null && dragRange.end !== null) {
            // existing selection — add directly
            addInteraction()
          } else {
            // create centered default selection and add immediately
            const half = DEFAULT_SELECTION_LEN / 2
            let rawStart = clampTime(t - half)
            let rawEnd = clampTime(t + half)
            let start = Number(rawStart.toFixed(3))
            let end = Number(rawEnd.toFixed(3))
            if (end <= start) {
              end = Number(Math.min((Number.isFinite(maxDuration) ? maxDuration : start + 0.001), start + 0.001).toFixed(3))
            }
            addInteraction(undefined, { start, end })
          }
          closeContextMenu()
        }
      } else if (e.key === 'Backspace') {
        // Backspace: prefer deleting the hovered/selected interaction.
        // Priority:
        // 1) hover tooltip (hoverInfo.visible && hoverInfo.index)
        // 2) interaction context menu target (if open)
        // 3) interaction overlapping currentTime
        e.preventDefault()
        if (hoverInfo.visible && typeof hoverInfo.index === 'number' && hoverInfo.index >= 0) {
          removeInteraction(hoverInfo.index)
        } else if (contextMenu.open && contextMenu.type === 'interaction') {
          // contextMenu.targetIndex is the index to delete
          removeInteraction(contextMenu.targetIndex)
        } else {
          const t = Number(currentTime || 0)
          const idx = interactions.findIndex(it => it.start_time <= t && t <= it.end_time)
          if (idx !== -1) removeInteraction(idx)
        }
      } else if (e.key && e.key.toLowerCase() === 'q') {
        // Q: cancel current selection and close selection menu
        e.preventDefault()
        // clear selection range
        setDragRange({ start: null, end: null })
        // close any open selection/context menu
        clearSelectionMenuHideTimer()
        setSelectionDropdownOpen(false)
        // clear hover tooltip/timers and hide tooltip
        if (hoverTooltipTimerRef.current !== null) {
          window.clearTimeout(hoverTooltipTimerRef.current)
          hoverTooltipTimerRef.current = null
        }
        setHoverInfo(h => ({ ...h, visible: false }))
        closeContextMenu()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        seekVideo((currentTime || 0) - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        seekVideo((currentTime || 0) + 1)
      }
    }
    // Register in capture phase so we can prevent default browser behavior
    // (like page scrolling on ArrowUp/ArrowDown) before it occurs.
    window.addEventListener('keydown', onGlobalKey, true)
    return () => window.removeEventListener('keydown', onGlobalKey, true)
  }, [actions, clearSelectionMenuHideTimer, currentTime, duration, dragRange, selectionMenuAction])
}
