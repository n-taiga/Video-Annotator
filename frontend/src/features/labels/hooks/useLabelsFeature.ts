import { useCallback, useRef } from 'react'
import type React from 'react'
import type { ActionLabelDictionary } from '../../../api'
import type { LabelColorMap } from '../../../utils/colors'
import { useLabels } from './useLabels'
import type { LabelRenameActionContext, LabelRemoveActionContext } from './useLabels'

export interface LabelsFeatureState {
  actions: string[]
  baseActionsRef: React.MutableRefObject<string[]>
  labelColors: LabelColorMap
  loadingActionLabels: boolean
  savingActionLabels: boolean
  actionLabelError: string | null
  objectOptions: string[]
  loadingObjectLabels: boolean
  savingObjectLabels: boolean
  objectLabelError: string | null
  objectName: string
}

export interface LabelsFeatureActions {
  setActions: React.Dispatch<React.SetStateAction<string[]>>
  setObjectName: React.Dispatch<React.SetStateAction<string>>
  reloadActionLabels: () => void
  loadActionLabels: () => Promise<ActionLabelDictionary>
  loadObjectLabels: () => Promise<Record<string, string>>
  handleChangeActionColor: (actionName: string, colorValue: string) => Promise<void>
  handleAddAction: () => Promise<string | null>
  handleRenameAction: (previousName: string, nextName: string, context: LabelRenameActionContext) => Promise<boolean>
  handleRemoveAction: (actionName: string, context: LabelRemoveActionContext) => Promise<void>
  handleChangeObjectColor: (objectName: string, colorValue: string) => Promise<void>
  handleAddObject: (rawName?: string) => Promise<string | null>
  handleRenameObject: (previousName: string, nextName: string) => Promise<boolean>
  handleRemoveObject: (name: string) => Promise<void>
}

export interface LabelsFeatureUi {
  configMenuRef: React.RefObject<HTMLDivElement>
  handleConfigWheel: (event: React.WheelEvent<HTMLDivElement>) => void
}

export interface UseLabelsFeatureResult {
  state: LabelsFeatureState
  actions: LabelsFeatureActions
  ui: LabelsFeatureUi
}

export function useLabelsFeature(): UseLabelsFeatureResult {
  const labels = useLabels()
  const configMenuRef = useRef<HTMLDivElement | null>(null)

  const handleConfigWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const node = configMenuRef.current
    if (!node) return
    const deltaY = event.deltaY
    const deltaX = event.deltaX
    if (deltaY === 0 && deltaX === 0) return

    event.preventDefault()
    event.stopPropagation()

    const maxScrollTop = node.scrollHeight - node.clientHeight
    if (maxScrollTop > 0) {
      node.scrollTop = Math.min(Math.max(node.scrollTop + deltaY, 0), maxScrollTop)
    }
  }, [])

  return {
    state: {
      actions: labels.actions,
      baseActionsRef: labels.baseActionsRef,
      labelColors: labels.labelColors,
      loadingActionLabels: labels.loadingActionLabels,
      savingActionLabels: labels.savingActionLabels,
      actionLabelError: labels.actionLabelError,
      objectOptions: labels.objectOptions,
      loadingObjectLabels: labels.loadingObjectLabels,
      savingObjectLabels: labels.savingObjectLabels,
      objectLabelError: labels.objectLabelError,
      objectName: labels.objectName,
    },
    actions: {
      setActions: labels.setActions,
      setObjectName: labels.setObjectName,
      reloadActionLabels: labels.reloadActionLabels,
      loadActionLabels: labels.loadActionLabels,
      loadObjectLabels: labels.loadObjectLabels,
      handleChangeActionColor: labels.handleChangeActionColor,
      handleAddAction: labels.handleAddAction,
      handleRenameAction: labels.handleRenameAction,
      handleRemoveAction: labels.handleRemoveAction,
      handleChangeObjectColor: labels.handleChangeObjectColor,
      handleAddObject: labels.handleAddObject,
      handleRenameObject: labels.handleRenameObject,
      handleRemoveObject: labels.handleRemoveObject,
    },
    ui: {
      configMenuRef,
      handleConfigWheel,
    },
  }
}
