import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { DEFAULT_VIDEO_FPS } from '../../video'
import type { DragRange } from '../../video'
import type { Interaction, TimelineSnapshot } from '../types'
import { useHistory } from '../../history'

export interface UseTimelineAnnotationsInput<TClickPoint extends Record<string, unknown>> {
  actions: string[]
  dragRange: DragRange
  setDragRange: Dispatch<SetStateAction<DragRange>>
  clickPoints: TClickPoint[]
  setClickPoints: Dispatch<SetStateAction<TClickPoint[]>>
  fps?: number
  initialContact?: boolean
  onSnapshotRestored?: (snapshot: TimelineSnapshot<TClickPoint>) => void | Promise<void>
}

export interface UseTimelineAnnotationsOutput<TClickPoint extends Record<string, unknown>> {
  interactions: Interaction[]
  setInteractions: Dispatch<SetStateAction<Interaction[]>>
  selectedAction: string
  setSelectedAction: Dispatch<SetStateAction<string>>
  contact: boolean
  setContact: Dispatch<SetStateAction<boolean>>
  historyStack: TimelineSnapshot<TClickPoint>[]
  setHistoryStack: Dispatch<SetStateAction<TimelineSnapshot<TClickPoint>[]>>
  historyRedoStack: TimelineSnapshot<TClickPoint>[]
  setHistoryRedoStack: Dispatch<SetStateAction<TimelineSnapshot<TClickPoint>[]>>
  addInteraction: (labelOverride?: string, rangeOverride?: { start: number; end: number }) => void
  removeInteraction: (index: number) => void
  updateInteractionLabel: (index: number, label: string) => void
  pushHistory: (prevInteractions?: Interaction[], prevClickPoints?: TClickPoint[]) => void
  undo: () => void
  redo: () => void
  cloneSnapshot: (snapshot: TimelineSnapshot<TClickPoint>) => TimelineSnapshot<TClickPoint>
}

export function useTimelineAnnotations<TClickPoint extends Record<string, unknown>>({
  actions,
  dragRange,
  setDragRange,
  clickPoints,
  setClickPoints,
  fps,
  initialContact = false,
  onSnapshotRestored,
}: UseTimelineAnnotationsInput<TClickPoint>): UseTimelineAnnotationsOutput<TClickPoint> {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [selectedAction, setSelectedAction] = useState(actions[0] ?? '')
  const [contact, setContact] = useState(initialContact)
  const interactionsRef = useRef(interactions)
  const clickPointsRef = useRef(clickPoints)

  useEffect(() => {
    interactionsRef.current = interactions
  }, [interactions])

  useEffect(() => {
    clickPointsRef.current = clickPoints
  }, [clickPoints])

  useEffect(() => {
    setSelectedAction(prev => (prev && actions.includes(prev) ? prev : actions[0] ?? ''))
  }, [actions])

  const fpsValue = Number.isFinite(fps) && fps ? fps : DEFAULT_VIDEO_FPS

  const cloneInteractions = useCallback((list: Interaction[]) => list.map(it => ({ ...it })), [])

  const cloneClickPoints = useCallback(
    (list: TClickPoint[]) => list.map(point => ({ ...(point as Record<string, unknown>) }) as TClickPoint),
    [],
  )

  const history = useHistory<TClickPoint>({
    interactionsRef,
    clickPointsRef,
    cloneInteractions,
    cloneClickPoints,
    setInteractions,
    setClickPoints,
    onSnapshotRestored,
  })

  const { historyStack, setHistoryStack, historyRedoStack, setHistoryRedoStack, cloneSnapshot, pushHistory, undo, redo } = history

  const addInteraction = useCallback(
    (labelOverride?: string, rangeOverride?: { start: number; end: number }) => {
      const range = rangeOverride ?? dragRange
      if (range.start === null || range.end === null) return
      const actionLabel = labelOverride ?? selectedAction
      if (!actionLabel) return
      const start = Number(range.start.toFixed(3))
      const end = Number(range.end.toFixed(3))
      const inter: Interaction = {
        start_time: start,
        end_time: end,
        start_frame: Math.round(start * fpsValue),
        end_frame: Math.round(end * fpsValue),
        action_label: actionLabel,
        contact,
      }
      setInteractions(prev => {
        const next = [...prev, inter]
        pushHistory(prev, clickPointsRef.current)
        setHistoryRedoStack([])
        return next
      })
      setDragRange({ start: null, end: null })
    },
    [contact, dragRange, fpsValue, pushHistory, selectedAction, setDragRange, setHistoryRedoStack],
  )

  const removeInteraction = useCallback(
    (index: number) => {
      setInteractions(prev => {
        if (index < 0 || index >= prev.length) return prev
        const next = prev.filter((_, i) => i !== index)
        pushHistory(prev, clickPointsRef.current)
        setHistoryRedoStack([])
        return next
      })
    },
    [pushHistory, setHistoryRedoStack],
  )

  const updateInteractionLabel = useCallback(
    (index: number, label: string) => {
      if (!label) return
      setInteractions(prev => {
        if (index < 0 || index >= prev.length) return prev
        const next = prev.map((it, i) => (i === index ? { ...it, action_label: label } : it))
        pushHistory(prev, clickPointsRef.current)
        setHistoryRedoStack([])
        return next
      })
    },
    [pushHistory, setHistoryRedoStack],
  )

  return {
    interactions,
    setInteractions,
    selectedAction,
    setSelectedAction,
    contact,
    setContact,
    historyStack,
    setHistoryStack,
    historyRedoStack,
    setHistoryRedoStack,
    addInteraction,
    removeInteraction,
    updateInteractionLabel,
    pushHistory,
    undo,
    redo,
    cloneSnapshot,
  }
}
