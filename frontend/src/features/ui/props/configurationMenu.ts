import type { ComponentProps } from 'react'
import ConfigurationFloatingMenu from '../components/ConfigurationFloatingMenu'
import type { UseUiFeatureResult } from '../hooks/useUiFeature'
import type { UseLabelsFeatureResult } from '../../labels/hooks/useLabelsFeature'

export type ConfigurationMenuComponentProps = ComponentProps<typeof ConfigurationFloatingMenu>

export interface BuildConfigurationMenuPropsArgs {
  ui: UseUiFeatureResult
  labels: UseLabelsFeatureResult
  onRemoveAction: (actionName: string) => Promise<void> | void
  onRenameAction: (previousName: string, nextName: string) => Promise<boolean> | boolean
}

export function buildConfigurationMenuProps({ ui, labels, onRemoveAction, onRenameAction }: BuildConfigurationMenuPropsArgs): ConfigurationMenuComponentProps {
  return {
    visible: ui.state.activeScreen === 'configuration',
    configMenuRef: labels.ui.configMenuRef,
    onWheel: labels.ui.handleConfigWheel,
    onClose: () => ui.actions.setActiveScreen('annotation'),
    configurationPanelProps: {
      actions: labels.state.actions,
      labelColors: labels.state.labelColors,
      onRemoveAction,
      onChangeColor: labels.actions.handleChangeActionColor,
      onAddAction: labels.actions.handleAddAction,
      onRenameAction,
      loading: labels.state.loadingActionLabels,
      saving: labels.state.savingActionLabels,
      error: labels.state.actionLabelError,
      onRetry: labels.actions.reloadActionLabels,
      objectOptions: labels.state.objectOptions,
      onRemoveObject: labels.actions.handleRemoveObject,
      onChangeObjectColor: labels.actions.handleChangeObjectColor,
      onAddObject: labels.actions.handleAddObject,
      onRenameObject: labels.actions.handleRenameObject,
      loadingObjectLabels: labels.state.loadingObjectLabels,
      savingObjectLabels: labels.state.savingObjectLabels,
      objectLabelError: labels.state.objectLabelError,
      onRetryObject: labels.actions.loadObjectLabels,
    },
  }
}
