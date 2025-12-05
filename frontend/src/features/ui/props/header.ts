import type { ComponentProps } from 'react'
import AppHeader from '../components/AppHeader'
import type { UseUiFeatureResult } from '../hooks/useUiFeature'
import type { UseProjectFeatureResult } from '../../project/hooks/useProjectFeature'
import type { UseTimelineFeatureResult } from '../../timeline/hooks/useTimelineFeature'
import type { UseTimelineModelOutput } from '../../timeline/hooks/useTimelineModel'

export type HeaderComponentProps = ComponentProps<typeof AppHeader>

export interface BuildHeaderPropsArgs<TClickPoint extends Record<string, unknown>> {
  ui: UseUiFeatureResult
  project: UseProjectFeatureResult
  timeline: UseTimelineFeatureResult<TClickPoint>
  timelineModel: UseTimelineModelOutput
  removeInteraction: (index: number) => void
}

export function buildHeaderProps<TClickPoint extends Record<string, unknown>>({ ui, project, timeline, timelineModel, removeInteraction }: BuildHeaderPropsArgs<TClickPoint>): HeaderComponentProps {
  return {
    sideOpen: ui.state.sideOpen,
    onToggleSideMenu: () => ui.actions.setSideOpen(prev => !prev),
    scenarioId: project.state.scenarioId,
    metadataOptions: project.state.metadataOptions,
    scenarioDropdownOpen: project.state.scenarioDropdownOpen,
    setScenarioDropdownOpen: project.actions.setScenarioDropdownOpen,
    onClearScenario: project.actions.handleScenarioClear,
    onSelectScenario: project.actions.handleScenarioSelect,
    scenarioSelectRef: project.refs.scenarioSelectRef,
    videoOptions: project.state.videoOptions,
    selectedVideoFile: project.state.selectedVideoFile,
    onSelectVideo: project.actions.handleSelectVideo,
    canUndo: timeline.annotations.historyStack.length > 0,
    canRedo: timeline.annotations.historyRedoStack.length > 0,
    onUndo: timeline.annotations.undo,
    onRedo: timeline.annotations.redo,
    hoverInfo: timelineModel.hoverInfo,
    hoverTooltipTimerRef: timeline.refs.hoverTooltipTimerRef,
    onRemoveInteraction: removeInteraction,
    setHoverInfo: timelineModel.setHoverInfo,
  }
}
