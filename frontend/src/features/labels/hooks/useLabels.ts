import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ActionLabelDictionary } from '../../../api'
import { fetchActionLabels, updateActionLabels, fetchObjectLabels, updateObjectLabels } from '../../../api'
import { mergeActions } from '../../../common/actions'
import type { LabelColorMap } from '../../../common/colors'
import { ensureLabelColors } from '../../../common/colors'
import { cloneLabelDictionary } from '../../../common/labelConfig'

export interface LabelInteractionLike {
  action_label: string
  [key: string]: any
}

export interface LabelHistorySnapshotLike<TInteraction extends LabelInteractionLike = LabelInteractionLike> {
  interactions: TInteraction[]
  [key: string]: any
}

export interface LabelHoverInfoLike {
  label: string
  color?: string
  [key: string]: any
}

export interface LabelRenameActionContext<
  TInteraction extends LabelInteractionLike = LabelInteractionLike,
  THistorySnapshot extends LabelHistorySnapshotLike<TInteraction> = LabelHistorySnapshotLike<TInteraction>,
  THoverInfo extends LabelHoverInfoLike = LabelHoverInfoLike
> {
  interactions: TInteraction[]
  setInteractions: Dispatch<SetStateAction<TInteraction[]>>
  historyStack: THistorySnapshot[]
  setHistoryStack: Dispatch<SetStateAction<THistorySnapshot[]>>
  historyRedoStack: THistorySnapshot[]
  setHistoryRedoStack: Dispatch<SetStateAction<THistorySnapshot[]>>
  selectedAction: string
  setSelectedAction: Dispatch<SetStateAction<string>>
  selectionMenuAction: string
  setSelectionMenuAction: Dispatch<SetStateAction<string>>
  hoverInfo: THoverInfo
  setHoverInfo: Dispatch<SetStateAction<THoverInfo>>
  cloneSnapshot: (snapshot: THistorySnapshot) => THistorySnapshot
}

export interface LabelRemoveActionContext<
  TInteraction extends LabelInteractionLike = LabelInteractionLike,
  THistorySnapshot extends LabelHistorySnapshotLike<TInteraction> = LabelHistorySnapshotLike<TInteraction>,
  THoverInfo extends LabelHoverInfoLike = LabelHoverInfoLike
> {
  setInteractions: Dispatch<SetStateAction<TInteraction[]>>
  setHistoryStack: Dispatch<SetStateAction<THistorySnapshot[]>>
  setHistoryRedoStack: Dispatch<SetStateAction<THistorySnapshot[]>>
  closeContextMenu: () => void
  setHoverInfo: Dispatch<SetStateAction<THoverInfo>>
}

export interface UseLabelsResult {
  actions: string[]
  setActions: React.Dispatch<React.SetStateAction<string[]>>
  baseActionsRef: React.MutableRefObject<string[]>
  labelColors: LabelColorMap
  setLabelColors: React.Dispatch<React.SetStateAction<LabelColorMap>>
  loadingActionLabels: boolean
  savingActionLabels: boolean
  actionLabelError: string | null
  setActionLabelError: React.Dispatch<React.SetStateAction<string | null>>
  objectOptions: string[]
  loadingObjectLabels: boolean
  savingObjectLabels: boolean
  objectLabelError: string | null
  objectName: string
  setObjectName: React.Dispatch<React.SetStateAction<string>>
  loadActionLabels: () => Promise<ActionLabelDictionary>
  loadObjectLabels: () => Promise<Record<string, string>>
  reloadActionLabels: () => void
  handleChangeActionColor: (actionName: string, colorValue: string) => Promise<void>
  handleAddAction: () => Promise<string | null>
  handleChangeObjectColor: (objectName: string, colorValue: string) => Promise<void>
  handleAddObject: (rawName?: string) => Promise<string | null>
  handleRenameObject: (previousName: string, nextName: string) => Promise<boolean>
  handleRemoveObject: (name: string) => Promise<void>
  persistActionLabels: (next: ActionLabelDictionary, options?: { silent?: boolean }) => Promise<ActionLabelDictionary>
  handleRenameAction: (previousName: string, nextName: string, context: LabelRenameActionContext) => Promise<boolean>
  handleRemoveAction: (actionName: string, context: LabelRemoveActionContext) => Promise<void>
}

export function useLabels(): UseLabelsResult {
  const initialLabelDictionary = useMemo(() => cloneLabelDictionary(), [])
  const initialActionList = useMemo(() => Object.keys(initialLabelDictionary), [initialLabelDictionary])
  const baseActionsRef = useRef<string[]>(initialActionList)
  const [actions, setActions] = useState<string[]>(initialActionList)
  const [labelColors, setLabelColors] = useState<LabelColorMap>(() => ensureLabelColors(initialActionList, initialLabelDictionary))
  const [loadingActionLabels, setLoadingActionLabels] = useState(true)
  const [savingActionLabels, setSavingActionLabels] = useState(false)
  const [actionLabelError, setActionLabelError] = useState<string | null>(null)
  const [objectOptions, setObjectOptions] = useState<string[]>([])
  const [loadingObjectLabels, setLoadingObjectLabels] = useState(true)
  const [savingObjectLabels, setSavingObjectLabels] = useState(false)
  const [objectLabelError, setObjectLabelError] = useState<string | null>(null)
  const [objectName, setObjectName] = useState('cup')

  useEffect(() => {
    setLabelColors(prev => ensureLabelColors(actions, prev))
  }, [actions])

  const normalizeHexColor = useCallback((value: string): string => {
    const trimmed = value.trim()
    if (!trimmed) return '#94A3B8'
    const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      const expanded = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      return `#${expanded.toUpperCase()}`
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return `#${hex.toUpperCase()}`
    }
    return '#94A3B8'
  }, [])

  const applyActionLabelDictionary = useCallback((dictionary: ActionLabelDictionary) => {
    let sanitized = cloneLabelDictionary(dictionary)
    if (Object.keys(sanitized).length === 0) {
      sanitized = cloneLabelDictionary(initialLabelDictionary)
    }
    const actionList = Object.keys(sanitized)
    baseActionsRef.current = actionList
    setActions(actionList)
    setLabelColors(() => ensureLabelColors(actionList, sanitized))
    return { sanitized, actionList }
  }, [initialLabelDictionary])

  const loadActionLabels = useCallback(async () => {
    setLoadingActionLabels(true)
    try {
      const remote = await fetchActionLabels()
      const { sanitized } = applyActionLabelDictionary(remote)
      setActionLabelError(null)
      return sanitized
    } catch (err) {
      console.error('Failed to load action labels', err)
      const message = err instanceof Error ? err.message : 'Failed to load action labels.'
      setActionLabelError(message)
      throw err
    } finally {
      setLoadingActionLabels(false)
    }
  }, [applyActionLabelDictionary])

  const loadObjectLabels = useCallback(async () => {
    setLoadingObjectLabels(true)
    try {
      const remote = await fetchObjectLabels()
      const opts = Object.keys(remote)
      setObjectOptions(opts)
      setObjectName(prev => (opts.includes(prev) ? prev : opts[0] ?? prev))
      setObjectLabelError(null)
      return remote
    } catch (err) {
      console.error('Failed to load object labels', err)
      const message = err instanceof Error ? err.message : 'Failed to load object labels.'
      setObjectLabelError(message)
      throw err
    } finally {
      setLoadingObjectLabels(false)
    }
  }, [])

  useEffect(() => {
    void loadActionLabels().catch(() => undefined)
  }, [loadActionLabels])

  useEffect(() => {
    void loadObjectLabels().catch(() => undefined)
  }, [loadObjectLabels])

  const persistActionLabels = useCallback(async (next: ActionLabelDictionary, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent)
    if (!silent) setSavingActionLabels(true)
    try {
      const updated = await updateActionLabels(next)
      const { sanitized } = applyActionLabelDictionary(updated)
      setActionLabelError(null)
      return sanitized
    } catch (err) {
      console.error('Failed to update action labels', err)
      const message = err instanceof Error ? err.message : 'Failed to update action labels.'
      setActionLabelError(message)
      throw err
    } finally {
      if (!silent) setSavingActionLabels(false)
    }
  }, [applyActionLabelDictionary])

  const reloadActionLabels = useCallback(() => {
    void loadActionLabels().catch(() => undefined)
  }, [loadActionLabels])

  const handleChangeActionColor = useCallback(async (actionName: string, colorValue: string) => {
    const trimmed = actionName.trim()
    if (!trimmed) return
    if (loadingActionLabels || savingActionLabels) return
    const normalized = normalizeHexColor(colorValue)
    const orderedLabels = baseActionsRef.current.length > 0 ? baseActionsRef.current : actions
    const optimisticMap: ActionLabelDictionary = { ...labelColors, [trimmed]: normalized }
    setLabelColors(prev => ensureLabelColors(orderedLabels, optimisticMap))
    const nextDictionary: ActionLabelDictionary = {}
    orderedLabels.forEach(label => {
      const existing = optimisticMap[label] ?? '#94A3B8'
      nextDictionary[label] = existing
    })
    try {
      await persistActionLabels(nextDictionary, { silent: true })
    } catch (err) {
      console.error('Failed to change action label color', err)
      void loadActionLabels().catch(() => undefined)
    }
  }, [actions, labelColors, loadActionLabels, loadingActionLabels, normalizeHexColor, persistActionLabels, savingActionLabels])

  const handleChangeObjectColor = useCallback(async (objectNameParam: string, colorValue: string) => {
    const trimmed = objectNameParam.trim()
    if (!trimmed) return
    if (loadingObjectLabels || savingObjectLabels) return
    const normalized = normalizeHexColor(colorValue)
    const nextDictionary: ActionLabelDictionary = {}
    objectOptions.forEach(o => {
      nextDictionary[o] = '#94A3B8'
    })
    nextDictionary[trimmed] = normalized
    try {
      setSavingObjectLabels(true)
      await updateObjectLabels(nextDictionary)
      setObjectLabelError(null)
    } catch (err) {
      console.error('Failed to change object label color', err)
      setObjectLabelError(err instanceof Error ? err.message : 'Failed to change object label color')
      void loadObjectLabels().catch(() => undefined)
    } finally {
      setSavingObjectLabels(false)
    }
  }, [loadingObjectLabels, objectOptions, normalizeHexColor, savingObjectLabels, loadObjectLabels])

  const handleAddAction = useCallback(async (): Promise<string | null> => {
    if (loadingActionLabels || savingActionLabels) return null
    const baseName = 'None'
    const ordered = baseActionsRef.current.length > 0 ? [...baseActionsRef.current] : [...actions]
    let candidate = baseName
    let suffix = 2
    while (ordered.includes(candidate)) {
      candidate = `${baseName} ${suffix}`
      suffix += 1
    }

    const prevActionsList = [...actions]
    const prevLabelMap = { ...labelColors }
    const prevBaseActions = [...ordered]

    const nextOrder = [...ordered, candidate]
    const nextColors = { ...labelColors, [candidate]: '#FFFFFF' }

    baseActionsRef.current = nextOrder
    setActions(nextOrder)
    setLabelColors(ensureLabelColors(nextOrder, nextColors))
    setActionLabelError(null)

    const nextDictionary: ActionLabelDictionary = {}
    nextOrder.forEach(label => {
      if (label === candidate) {
        nextDictionary[label] = '#FFFFFF'
      } else {
        const color = labelColors[label] ?? '#94A3B8'
        nextDictionary[label] = color
      }
    })

    try {
      await persistActionLabels(nextDictionary)
      return candidate
    } catch (err) {
      console.error('Failed to add action label', err)
      baseActionsRef.current = prevBaseActions
      setActions(prevActionsList)
      setLabelColors(ensureLabelColors(prevBaseActions, prevLabelMap))
      setActionLabelError(err instanceof Error ? err.message : 'Failed to add action label.')
      return null
    }
  }, [actions, labelColors, loadingActionLabels, persistActionLabels, savingActionLabels])

  const handleAddObject = useCallback(async (rawName?: string): Promise<string | null> => {
    if (loadingObjectLabels || savingObjectLabels) return null
    const baseName = 'Object'
    const ordered = [...objectOptions]
    let candidate: string
    const provided = typeof rawName === 'string' ? rawName.trim() : ''
    if (provided) {
      if (ordered.includes(provided)) {
        return provided
      }
      candidate = provided
    } else {
      candidate = baseName
      let suffix = 2
      while (ordered.includes(candidate)) {
        candidate = `${baseName} ${suffix}`
        suffix += 1
      }
    }

    const prev = [...objectOptions]
    const nextOrder = [...ordered, candidate]
    setObjectOptions(nextOrder)
    try {
      setSavingObjectLabels(true)
      const nextDictionary: ActionLabelDictionary = {}
      nextOrder.forEach(label => {
        nextDictionary[label] = '#94A3B8'
      })
      await updateObjectLabels(nextDictionary)
      setObjectLabelError(null)
      setObjectName(candidate)
      return candidate
    } catch (err) {
      console.error('Failed to add object label', err)
      setObjectOptions(prev)
      setObjectLabelError(err instanceof Error ? err.message : 'Failed to add object label')
      return null
    } finally {
      setSavingObjectLabels(false)
    }
  }, [loadingObjectLabels, objectOptions, savingObjectLabels])

  const handleRenameObject = useCallback(async (previousName: string, rawNextName: string): Promise<boolean> => {
    if (loadingObjectLabels || savingObjectLabels) return false
    const trimmed = rawNextName.trim()
    const current = previousName.trim()
    if (!current) return false
    if (!trimmed) return false
    if (trimmed === current) return true
    if (!objectOptions.includes(current)) return false
    if (objectOptions.includes(trimmed)) return false

    const prev = [...objectOptions]
    const nextOrder = prev.map(o => (o === current ? trimmed : o))
    setObjectOptions(nextOrder)
    try {
      const nextDictionary: ActionLabelDictionary = {}
      nextOrder.forEach(label => { nextDictionary[label] = '#94A3B8' })
      await updateObjectLabels(nextDictionary)
      setObjectLabelError(null)
      if (objectName === current) setObjectName(trimmed)
      return true
    } catch (err) {
      console.error('Failed to rename object label', err)
      setObjectOptions(prev)
      setObjectLabelError(err instanceof Error ? err.message : 'Failed to rename object label')
      return false
    }
  }, [loadingObjectLabels, objectName, objectOptions, savingObjectLabels])

  const handleRemoveObject = useCallback(async (name: string) => {
    if (loadingObjectLabels || savingObjectLabels) return
    if (!objectOptions.includes(name)) return
    if (objectOptions.length <= 1) {
      setObjectLabelError('At least one object label must remain.')
      return
    }
    const prev = [...objectOptions]
    const next = prev.filter(o => o !== name)
    try {
      const nextDictionary: ActionLabelDictionary = {}
      next.forEach(label => { nextDictionary[label] = '#94A3B8' })
      await updateObjectLabels(nextDictionary)
      setObjectOptions(next)
      setObjectLabelError(null)
      if (objectName === name) setObjectName(next[0] ?? '')
    } catch (err) {
      console.error('Failed to remove object label', err)
      setObjectLabelError(err instanceof Error ? err.message : 'Failed to remove object label')
    }
  }, [loadingObjectLabels, objectName, objectOptions, savingObjectLabels])

  const handleRenameAction = useCallback(async (previousName: string, rawNextName: string, context: LabelRenameActionContext): Promise<boolean> => {
    if (loadingActionLabels || savingActionLabels) return false
    const trimmed = rawNextName.trim()
    const current = previousName.trim()
    if (!current) return false
    if (!trimmed) {
      setActionLabelError('Label name cannot be empty.')
      return false
    }
    if (trimmed === current) {
      return true
    }

    const ordered = baseActionsRef.current.length > 0 ? [...baseActionsRef.current] : [...actions]
    if (!ordered.includes(current)) {
      setActionLabelError('Original label could not be found.')
      return false
    }
    if (ordered.includes(trimmed)) {
      setActionLabelError('A label with that name already exists.')
      return false
    }

    const prevBaseActions = [...ordered]
    const prevActionsList = [...actions]
    const prevLabelMap = { ...labelColors }
    const prevInteractions = context.interactions.map(item => ({ ...item }))
    const prevHistoryStack = context.historyStack.map(s => context.cloneSnapshot(s))
    const prevHistoryRedoStack = context.historyRedoStack.map(s => context.cloneSnapshot(s))
    const prevSelected = context.selectedAction
    const prevSelectionMenu = context.selectionMenuAction
    const prevHover = context.hoverInfo

    const nextOrder = ordered.map(label => (label === current ? trimmed : label))
    const renamedColor = labelColors[current] ?? '#94A3B8'
    const nextDictionary: ActionLabelDictionary = {}
    nextOrder.forEach(label => {
      if (label === trimmed) {
        nextDictionary[label] = renamedColor
      } else {
        const color = labelColors[label] ?? '#94A3B8'
        nextDictionary[label] = color
      }
    })

    baseActionsRef.current = nextOrder
    setActions(nextOrder)
    setLabelColors(prev => {
      const next = { ...prev }
      const stored = next[current]
      delete next[current]
      next[trimmed] = stored ?? renamedColor
      return ensureLabelColors(nextOrder, next)
    })
    context.setInteractions(prev => prev.map(item => (item.action_label === current ? { ...item, action_label: trimmed } : item)))
    context.setHistoryStack(prev => prev.map(snapshot => ({ ...snapshot, interactions: snapshot.interactions.map(item => (item.action_label === current ? { ...item, action_label: trimmed } : item)) })))
    context.setHistoryRedoStack(prev => prev.map(snapshot => ({ ...snapshot, interactions: snapshot.interactions.map(item => (item.action_label === current ? { ...item, action_label: trimmed } : item)) })))
    context.setSelectedAction(prev => (prev === current ? trimmed : prev))
    context.setSelectionMenuAction(prev => (prev === current ? trimmed : prev))
    context.setHoverInfo(prev => {
      if (prev && typeof prev === 'object' && (prev as any).label === current) {
        return { ...(prev as any), label: trimmed, color: renamedColor }
      }
      return prev
    })
    setActionLabelError(null)

    try {
      await persistActionLabels(nextDictionary)
      return true
    } catch (err) {
      console.error('Failed to rename action label', err)
      baseActionsRef.current = prevBaseActions
      setActions(prevActionsList)
      setLabelColors(ensureLabelColors(prevBaseActions, prevLabelMap))
      context.setInteractions(prevInteractions)
      context.setHistoryStack(prevHistoryStack)
      context.setHistoryRedoStack(prevHistoryRedoStack)
      context.setSelectedAction(prevSelected)
      context.setSelectionMenuAction(prevSelectionMenu)
      context.setHoverInfo(prevHover)
      setActionLabelError(err instanceof Error ? err.message : 'Failed to rename action label.')
      return false
    }
  }, [actions, labelColors, loadingActionLabels, persistActionLabels, savingActionLabels])

  const handleRemoveAction = useCallback(async (actionName: string, context: LabelRemoveActionContext): Promise<void> => {
    const trimmed = actionName.trim()
    if (!trimmed) return
    if (loadingActionLabels || savingActionLabels) return
    if (!actions.includes(trimmed)) return
    if (actions.length <= 1) {
      setActionLabelError('At least one action label must remain.')
      return
    }
    const nextDictionary: ActionLabelDictionary = {}
    actions.forEach(label => {
      if (label === trimmed) return
      const color = labelColors[label]
      if (typeof color === 'string' && color.trim()) {
        nextDictionary[label] = color
      }
    })
    try {
      await persistActionLabels(nextDictionary)
      context.setInteractions(prev => prev.filter(interaction => interaction.action_label !== trimmed))
      context.setHistoryStack([])
      context.setHistoryRedoStack([])
      context.closeContextMenu()
      context.setHoverInfo(prev => {
        if (prev && typeof prev === 'object' && (prev as any).visible && (prev as any).label === trimmed) {
          return { ...(prev as any), visible: false }
        }
        return prev
      })
      setActionLabelError(null)
    } catch (err) {
      console.error('Failed to remove action label', err)
    }
  }, [actions, labelColors, loadingActionLabels, persistActionLabels, savingActionLabels])

  return {
    actions,
    setActions,
    baseActionsRef,
    labelColors,
    setLabelColors,
    loadingActionLabels,
    savingActionLabels,
    actionLabelError,
    setActionLabelError,
    objectOptions,
    loadingObjectLabels,
    savingObjectLabels,
    objectLabelError,
    objectName,
    setObjectName,
    loadActionLabels,
    loadObjectLabels,
    reloadActionLabels,
    handleChangeActionColor,
    handleAddAction,
    handleChangeObjectColor,
    handleAddObject,
    handleRenameObject,
    handleRemoveObject,
    persistActionLabels,
    handleRenameAction,
    handleRemoveAction,
  }
}
