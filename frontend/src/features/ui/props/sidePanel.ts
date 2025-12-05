import type { ComponentProps } from 'react'
import SidePanel from '../components/SidePanel'
import type { UseUiFeatureResult } from '../hooks/useUiFeature'
import type { UseProjectFeatureResult } from '../../project/hooks/useProjectFeature'
import type { UseVideoFeatureResult } from '../../video/hooks/useVideoFeature'
import type { UseLabelsFeatureResult } from '../../labels/hooks/useLabelsFeature'
import type { UseTimelineFeatureResult } from '../../timeline/hooks/useTimelineFeature'

export type SidePanelComponentProps = ComponentProps<typeof SidePanel>

export interface BuildSidePanelPropsArgs<TClickPoint extends Record<string, unknown>> {
  ui: UseUiFeatureResult
  project: UseProjectFeatureResult
  video: UseVideoFeatureResult
  labels: UseLabelsFeatureResult
  timeline: UseTimelineFeatureResult<TClickPoint>
}

export function buildSidePanelProps<TClickPoint extends Record<string, unknown>>({ ui, project, video, labels, timeline }: BuildSidePanelPropsArgs<TClickPoint>): SidePanelComponentProps {
  return {
    activeScreen: ui.state.activeScreen,
    onSwitchScreen: ui.actions.setActiveScreen,
    videoOptions: project.state.videoOptions,
    selectedVideoFile: project.state.selectedVideoFile,
    onSelectVideo: project.actions.handleSelectVideo,
    scenarioId: project.state.scenarioId,
    referenceVideoFiles: project.state.referenceVideoFiles,
    durationPrimary: video.display.durationDisplay.primary,
    durationSecondary: video.display.durationDisplay.secondary,
    resolutionDisplay: video.display.resolutionDisplay,
    fpsDisplayPrimary: video.display.fpsDisplayPrimary,
    fpsDisplaySecondary: video.display.fpsDisplaySecondary,
    labelCount: labels.state.actions.length,
    interactionCount: timeline.annotations.interactions.length,
    showReference: project.state.showReference,
    setShowReference: project.actions.setShowReference,
    referenceVisibility: project.state.referenceVisibility,
    setReferenceVisibility: project.actions.setReferenceVisibility,
  }
}
