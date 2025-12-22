import { useCallback, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Interaction, TimelineSnapshot } from '../../timeline'

export interface UseHistoryInput<TClickPoint extends Record<string, unknown>> {
  interactionsRef: MutableRefObject<Interaction[]>
  clickPointsRef: MutableRefObject<TClickPoint[]>
  clickedSegmentKeysRef: MutableRefObject<string[]>
  cloneInteractions: (list: Interaction[]) => Interaction[]
  cloneClickPoints: (list: TClickPoint[]) => TClickPoint[]
  setInteractions: Dispatch<SetStateAction<Interaction[]>>
  setClickPoints: Dispatch<SetStateAction<TClickPoint[]>>
  setClickedSegmentKeys: Dispatch<SetStateAction<string[]>>
  onSnapshotRestored?: (snapshot: TimelineSnapshot<TClickPoint>) => void | Promise<void>
}

export interface UseHistoryOutput<TClickPoint extends Record<string, unknown>> {
  historyStack: TimelineSnapshot<TClickPoint>[]
  setHistoryStack: Dispatch<SetStateAction<TimelineSnapshot<TClickPoint>[]>>
  historyRedoStack: TimelineSnapshot<TClickPoint>[]
  setHistoryRedoStack: Dispatch<SetStateAction<TimelineSnapshot<TClickPoint>[]>>
  cloneSnapshot: (snapshot: TimelineSnapshot<TClickPoint>) => TimelineSnapshot<TClickPoint>
  pushHistory: (prevInteractions?: Interaction[], prevClickPoints?: TClickPoint[], prevClickedSegmentKeys?: string[]) => void
  undo: () => void
  redo: () => void
}

export function useHistory<TClickPoint extends Record<string, unknown>>({
  interactionsRef,
  clickPointsRef,
  clickedSegmentKeysRef,
  cloneInteractions,
  cloneClickPoints,
  setInteractions,
  setClickPoints,
  setClickedSegmentKeys,
  onSnapshotRestored,
}: UseHistoryInput<TClickPoint>): UseHistoryOutput<TClickPoint> {
  const [historyStack, setHistoryStack] = useState<TimelineSnapshot<TClickPoint>[]>([])
  const [historyRedoStack, setHistoryRedoStack] = useState<TimelineSnapshot<TClickPoint>[]>([])

  const cloneSnapshot = useCallback(
    (snapshot: TimelineSnapshot<TClickPoint>): TimelineSnapshot<TClickPoint> => ({
      interactions: cloneInteractions(snapshot.interactions),
      clickPoints: cloneClickPoints(snapshot.clickPoints),
      clickedSegmentKeys: snapshot.clickedSegmentKeys ? [...snapshot.clickedSegmentKeys] : [],
    }),
    [cloneClickPoints, cloneInteractions],
  )

  const pushHistory = useCallback(
    (prevInteractions?: Interaction[], prevClickPoints?: TClickPoint[], prevClickedSegmentKeys?: string[]) => {
      const inter = prevInteractions ? cloneInteractions(prevInteractions) : cloneInteractions(interactionsRef.current)
      const clicks = prevClickPoints ? cloneClickPoints(prevClickPoints) : cloneClickPoints(clickPointsRef.current)
      const clicked = typeof prevClickedSegmentKeys !== 'undefined' ? prevClickedSegmentKeys : clickedSegmentKeysRef.current
      const snapshot: TimelineSnapshot<TClickPoint> = { interactions: inter, clickPoints: clicks, clickedSegmentKeys: [...clicked] }
      setHistoryStack(stack => {
        const last = stack.length ? stack[stack.length - 1] : null
        if (last) {
          try {
            if (JSON.stringify(last) === JSON.stringify(snapshot)) {
              return stack
            }
          } catch (_err) {
            // ignore stringify issues
          }
        }
        return [...stack, snapshot]
      })
    },
    [cloneClickPoints, cloneInteractions, clickPointsRef, interactionsRef],
  )

  const undo = useCallback(() => {
    setHistoryStack(stack => {
      if (stack.length === 0) return stack
      const nextStack = stack.slice(0, -1)
      const snapshot = stack[stack.length - 1]
      const currentSnapshot: TimelineSnapshot<TClickPoint> = {
        interactions: cloneInteractions(interactionsRef.current),
        clickPoints: cloneClickPoints(clickPointsRef.current),
        clickedSegmentKeys: [...clickedSegmentKeysRef.current],
      }
      setHistoryRedoStack(prev => [...prev, cloneSnapshot(currentSnapshot)])
      const restored = cloneSnapshot(snapshot)
      setInteractions(restored.interactions)
      setClickPoints(restored.clickPoints)
      setClickedSegmentKeys(restored.clickedSegmentKeys ?? [])
      if (onSnapshotRestored) {
        void Promise.resolve(onSnapshotRestored(restored))
      }
      return nextStack
    })
  }, [cloneClickPoints, cloneInteractions, cloneSnapshot, interactionsRef, clickPointsRef, onSnapshotRestored, setClickPoints, setInteractions])

  const redo = useCallback(() => {
    setHistoryRedoStack(stack => {
      if (stack.length === 0) return stack
      const nextRedo = stack.slice(0, -1)
      const snapshot = stack[stack.length - 1]
      const currentSnapshot: TimelineSnapshot<TClickPoint> = {
        interactions: cloneInteractions(interactionsRef.current),
        clickPoints: cloneClickPoints(clickPointsRef.current),
        clickedSegmentKeys: [...clickedSegmentKeysRef.current],
      }
      setHistoryStack(prev => [...prev, cloneSnapshot(currentSnapshot)])
      const restored = cloneSnapshot(snapshot)
      setInteractions(restored.interactions)
      setClickPoints(restored.clickPoints)
      setClickedSegmentKeys(restored.clickedSegmentKeys ?? [])
      if (onSnapshotRestored) {
        void Promise.resolve(onSnapshotRestored(restored))
      }
      return nextRedo
    })
  }, [cloneClickPoints, cloneInteractions, cloneSnapshot, interactionsRef, clickPointsRef, onSnapshotRestored, setClickPoints, setInteractions])

  return {
    historyStack,
    setHistoryStack,
    historyRedoStack,
    setHistoryRedoStack,
    cloneSnapshot,
    pushHistory,
    undo,
    redo,
  }
}
