import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import type * as d3 from 'd3'
import type { DragRange } from '../../video'
import type { ContextMenuState, Interaction } from '../types'

export interface UseTimelineContextMenuInput {
  actions: string[]
  dragRange: DragRange
  interactions: Interaction[]
  brushGroupRef: MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>
  addInteraction: (labelOverride?: string, rangeOverride?: { start: number; end: number }) => void
  setSelectedAction: (value: string) => void
}

export interface UseTimelineContextMenuOutput {
  contextMenu: ContextMenuState
  openContextMenu: (next: ContextMenuState) => void
  closeContextMenu: () => void
  selectionMenuAction: string
  setSelectionMenuAction: Dispatch<SetStateAction<string>>
  selectionDropdownOpen: boolean
  setSelectionDropdownOpen: Dispatch<SetStateAction<boolean>>
  interactionMenuRef: RefObject<HTMLDivElement>
  selectionMenuRef: RefObject<HTMLDivElement>
  selectionMenuHideTimerRef: MutableRefObject<number | null>
  clearSelectionMenuHideTimer: () => void
}

export function useTimelineContextMenu({
  actions,
  dragRange,
  interactions,
  brushGroupRef,
  addInteraction,
  setSelectedAction,
}: UseTimelineContextMenuInput): UseTimelineContextMenuOutput {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false })
  const [selectionMenuAction, setSelectionMenuAction] = useState(actions[0] ?? '')
  const [selectionDropdownOpen, setSelectionDropdownOpen] = useState(false)
  const interactionMenuRef = useRef<HTMLDivElement | null>(null)
  const selectionMenuRef = useRef<HTMLDivElement | null>(null)
  const selectionMenuHideTimerRef = useRef<number | null>(null)

  const clearSelectionMenuHideTimer = useCallback(() => {
    if (selectionMenuHideTimerRef.current !== null) {
      window.clearTimeout(selectionMenuHideTimerRef.current)
      selectionMenuHideTimerRef.current = null
    }
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu({ open: false })
  }, [])

  const openContextMenu = useCallback((next: ContextMenuState) => {
    setContextMenu(next)
  }, [])

  useEffect(() => {
    setSelectionMenuAction(prev => (prev && actions.includes(prev) ? prev : actions[0] ?? ''))
  }, [actions])

  useEffect(() => {
    if (!contextMenu.open) return
    const handleClick = () => closeContextMenu()
    const handleEscape = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeContextMenu()
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleEscape)
      setSelectionDropdownOpen(false)
    }
  }, [closeContextMenu, contextMenu.open])

  useEffect(() => {
    if (!contextMenu.open) return
    if (contextMenu.type !== 'selection') return
    const node = selectionMenuRef.current
    if (!node) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') {
        ev.preventDefault()
        if (selectionMenuAction) {
          setSelectedAction(selectionMenuAction)
          addInteraction(selectionMenuAction)
          closeContextMenu()
        }
      }
    }
    node.addEventListener('keydown', onKey)
    return () => node.removeEventListener('keydown', onKey)
  }, [addInteraction, closeContextMenu, contextMenu, selectionMenuAction, setSelectedAction])

  useEffect(() => {
    if (!contextMenu.open) return
    if (contextMenu.type !== 'selection') return
    if (!brushGroupRef.current) return
    const selectionNode = brushGroupRef.current.select<SVGRectElement>('.selection')
    if (selectionNode.empty()) return
    const node = selectionNode.node()
    if (!node) return
    const rect = node.getBoundingClientRect()
    const newX = rect.left + rect.width / 2
    const newY = Math.max(rect.top - 12, 12)
    if (Math.abs(contextMenu.x - newX) > 0.5 || Math.abs(contextMenu.y - newY) > 0.5) {
      setContextMenu({ open: true, type: 'selection', x: newX, y: newY })
    }
  }, [brushGroupRef, contextMenu, dragRange])

  useEffect(() => {
    if (!contextMenu.open) return
    if (contextMenu.type !== 'interaction') return
    if (contextMenu.targetIndex >= interactions.length) {
      closeContextMenu()
    }
  }, [closeContextMenu, contextMenu, interactions.length])

  useEffect(() => {
    if (!contextMenu.open) return
    if (contextMenu.type !== 'selection') return
    if (dragRange.start === null || dragRange.end === null) {
      closeContextMenu()
    }
  }, [closeContextMenu, contextMenu, dragRange])

  useEffect(() => {
    if (!contextMenu.open) return
    const menuEl = contextMenu.type === 'interaction' ? interactionMenuRef.current : selectionMenuRef.current
    if (!menuEl) return
    const spacing = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    menuEl.style.visibility = 'hidden'
    menuEl.style.display = 'block'
    menuEl.style.top = '0px'
    menuEl.style.left = '0px'
    const rect = menuEl.getBoundingClientRect()
    let top = contextMenu.y
    let left = contextMenu.x
    if (top + rect.height + spacing > vh) top = Math.max(spacing, vh - rect.height - spacing)
    if (left + rect.width + spacing > vw) left = Math.max(spacing, vw - rect.width - spacing)
    if (top < spacing) top = spacing
    if (left < spacing) left = spacing
    menuEl.style.top = `${Math.round(top)}px`
    menuEl.style.left = `${Math.round(left)}px`
    menuEl.style.visibility = ''
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu.open) return
    if (contextMenu.type !== 'selection') return
    const node = selectionMenuRef.current
    if (!node) return
    const t = window.setTimeout(() => {
      try {
        const anyNode = node as unknown as { focus: (opts?: { preventScroll?: boolean }) => void }
        if (typeof anyNode.focus === 'function') {
          try {
            anyNode.focus({ preventScroll: true })
          } catch (_err) {
            anyNode.focus()
          }
        }
      } catch (_e) {
        // ignore focus errors
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [contextMenu])

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    selectionMenuAction,
    setSelectionMenuAction,
    selectionDropdownOpen,
    setSelectionDropdownOpen,
    interactionMenuRef,
    selectionMenuRef,
    selectionMenuHideTimerRef,
    clearSelectionMenuHideTimer,
  }
}
