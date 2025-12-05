import type { ComponentProps } from 'react'
import { ActionForm } from '../../project'
import type { UseLabelsFeatureResult } from '../../labels/hooks/useLabelsFeature'
import type { UseProjectFeatureResult } from '../../project/hooks/useProjectFeature'

export type ActionFormComponentProps = ComponentProps<typeof ActionForm>

export interface BuildActionFormPropsArgs {
  labels: UseLabelsFeatureResult
  project: UseProjectFeatureResult
}

export function buildActionFormProps({ labels, project }: BuildActionFormPropsArgs): ActionFormComponentProps {
  return {
    objectName: labels.state.objectName,
    setObjectName: labels.actions.setObjectName,
    objectOptions: labels.state.objectOptions,
    handleAddObject: labels.actions.handleAddObject,
    loadingObjectLabels: labels.state.loadingObjectLabels,
    savingObjectLabels: labels.state.savingObjectLabels,
    environment: project.state.environment,
    setEnvironment: project.actions.setEnvironment,
    taskLabel: project.state.taskLabel,
    setTaskLabel: project.actions.setTaskLabel,
  }
}
