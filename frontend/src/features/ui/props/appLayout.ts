import type { RefObject } from 'react'
import type { AppLayoutProps } from '../components/AppLayout'
import { composeAppLayoutProps } from '../layout/composeAppLayout'
import type { UseUiFeatureResult } from '../hooks/useUiFeature'
import type { UseProjectFeatureResult } from '../../project/hooks/useProjectFeature'
import type { UseLabelsFeatureResult } from '../../labels/hooks/useLabelsFeature'
import type { UseVideoFeatureResult } from '../../video/hooks/useVideoFeature'
import type { UseTimelineFeatureResult } from '../../timeline/hooks/useTimelineFeature'
import type { UseTimelineModelOutput } from '../../timeline/hooks/useTimelineModel'
import type { SaveStatus } from '../../project/types'
import type { VideoClickData } from '../../video'
import type { ClickPoint } from '../../prediction'
import { buildVideoPanelProps, buildTimelineSectionProps, buildWaveformTimelineProps, buildLabelTimelineProps, buildActionTableProps, buildMainContentProps } from './mainContent'
import { buildHeaderProps } from './header'
import { buildSideMenuProps } from './sideMenu'
import { buildSidePanelProps } from './sidePanel'
import { buildReferenceOverlayProps } from './referenceOverlay'
import { buildConfigurationMenuProps } from './configurationMenu'
import { buildActionFormProps } from './actionForm'
import { buildTimelineContextMenuProps } from './timelineContextMenu'
import { buildSaveControlsProps } from './saveControls'

export interface BuildAppLayoutPropsArgs<TClickPoint extends Record<string, unknown>> {
  ui: UseUiFeatureResult
  project: UseProjectFeatureResult
  labels: UseLabelsFeatureResult
  video: UseVideoFeatureResult
  timeline: UseTimelineFeatureResult<TClickPoint>
  timelineModel: UseTimelineModelOutput
  overlayCanvasRef: RefObject<HTMLCanvasElement>
  currentFramePoints: Array<Pick<ClickPoint, 'id' | 'normX' | 'normY' | 'objectId'>>
  activeTimelineLabels: string[]
  saveStatus: SaveStatus
  onExportAnnotations: () => void | Promise<void>
  onVideoClick?: (info: VideoClickData) => void
  onDeletePoint?: (id: string) => void | Promise<void>
  getPointColor?: (objectId: number | null | undefined) => string
  activeTrackletId?: number
  onIncrementTracklet?: () => void
  removeInteraction: (index: number) => void
  onRemoveAction: (actionName: string) => Promise<void> | void
  onRenameAction: (previousName: string, nextName: string) => Promise<boolean> | boolean
  selectionMenuHideDelay: number
}

export function buildAppLayoutProps<TClickPoint extends Record<string, unknown>>({
  ui,
  project,
  labels,
  video,
  timeline,
  timelineModel,
  overlayCanvasRef,
  currentFramePoints,
  activeTimelineLabels,
  saveStatus,
  onExportAnnotations,
  onVideoClick,
  onDeletePoint,
  getPointColor,
  activeTrackletId,
  onIncrementTracklet,
  removeInteraction,
  onRemoveAction,
  onRenameAction,
  selectionMenuHideDelay,
}: BuildAppLayoutPropsArgs<TClickPoint>): AppLayoutProps {
  const videoPanelProps = buildVideoPanelProps({
    selectedVideoFile: project.state.selectedVideoFile,
    video,
    overlayCanvasRef,
    onVideoClick,
    currentFramePoints,
    onDeletePoint,
    getPointColor,
    activeTrackletId,
    onIncrementTracklet,
    activeTimelineLabels,
    labelColors: labels.state.labelColors,
  })

  const timelineSectionProps = buildTimelineSectionProps({
    video,
    timeline,
    labels,
    saveStatus,
    onExport: onExportAnnotations,
  })

  const waveformTimelineProps = buildWaveformTimelineProps({
    audioSrc: video.media.videoSource,
    currentTime: video.player.currentTime,
    duration: video.player.duration,
    onSeek: video.player.seekVideo,
    className: 'waveform-panel',
  })

  const labelTimelineProps = buildLabelTimelineProps({
    duration: video.player.duration,
    interactions: timeline.annotations.interactions,
    labelColors: labels.state.labelColors,
  })

  const actionTableProps = buildActionTableProps({
    interactions: timeline.annotations.interactions,
    onRemove: removeInteraction,
  })

  const mainContentProps = buildMainContentProps({
    previewPanels: video.previewPanels,
    videoPanel: videoPanelProps,
    timelineSection: timelineSectionProps,
    waveformTimeline: waveformTimelineProps,
    labelTimeline: labelTimelineProps,
    actionTable: actionTableProps,
  })

  const headerProps = buildHeaderProps({ ui, project, timeline, timelineModel, removeInteraction })
  const sideMenuProps = buildSideMenuProps({ ui })
  const sidePanelProps = buildSidePanelProps({ ui, project, video, labels, timeline })
  const referenceOverlayProps = buildReferenceOverlayProps({ project, video })
  const configurationMenuProps = buildConfigurationMenuProps({ ui, labels, onRemoveAction, onRenameAction })
  const actionFormProps = buildActionFormProps({ labels, project })
  const timelineContextMenuProps = buildTimelineContextMenuProps({ actions: labels.state.actions, timeline, selectionMenuHideDelay })
  const saveControlsProps = buildSaveControlsProps({ saveStatus, onSave: onExportAnnotations })

  return composeAppLayoutProps({
    header: headerProps,
    sideMenu: {
      menu: sideMenuProps,
      panel: sidePanelProps,
    },
    referenceOverlay: referenceOverlayProps,
    configurationMenu: configurationMenuProps,
    actionForm: actionFormProps,
    mainContent: mainContentProps,
    timelineContextMenu: timelineContextMenuProps,
    saveControls: saveControlsProps,
  })
}
