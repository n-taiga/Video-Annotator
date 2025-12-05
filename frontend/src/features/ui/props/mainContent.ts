import type { ComponentProps, RefObject } from 'react'
import { PreviewPanel, VideoPanel } from '../../video'
import { TimelineSection, WaveformTimeline, ActionTable } from '../../timeline'
import { LabelTimeline } from '../../labels'
import type { VideoPreviewGroup, UseVideoFeatureResult } from '../../video/hooks/useVideoFeature'
import type { UseTimelineFeatureResult } from '../../timeline/hooks/useTimelineFeature'
import type { UseLabelsFeatureResult } from '../../labels/hooks/useLabelsFeature'
import type { SaveStatus } from '../../project/types'
import type { VideoClickData } from '../../video'
import type { LabelColorMap } from '../../../common/colors'
import { getLabelColor } from '../../../common/colors'
import type { Interaction } from '../../timeline'

const FALLBACK_LABEL_COLOR = '#94A3B8'

export type VideoPanelComponentProps = ComponentProps<typeof VideoPanel>
export type TimelineSectionComponentProps = ComponentProps<typeof TimelineSection>
export type WaveformTimelineComponentProps = ComponentProps<typeof WaveformTimeline>
export type LabelTimelineComponentProps = ComponentProps<typeof LabelTimeline>
export type ActionTableComponentProps = ComponentProps<typeof ActionTable>

export interface BuildVideoPanelPropsArgs {
  selectedVideoFile?: string | null
  video: UseVideoFeatureResult
  overlayCanvasRef: RefObject<HTMLCanvasElement>
  onVideoClick?: (info: VideoClickData) => void
  currentFramePoints: Array<{ id: string; normX: number; normY: number; objectId?: number }>
  onDeletePoint?: (id: string) => void | Promise<void>
  getPointColor?: (objectId: number | null | undefined) => string
  activeTrackletId?: number
  onIncrementTracklet?: () => void
  activeTimelineLabels: string[]
  labelColors: LabelColorMap
}

export function buildVideoPanelProps({
  selectedVideoFile,
  video,
  overlayCanvasRef,
  onVideoClick,
  currentFramePoints,
  onDeletePoint,
  getPointColor,
  activeTrackletId,
  onIncrementTracklet,
  activeTimelineLabels,
  labelColors,
}: BuildVideoPanelPropsArgs): VideoPanelComponentProps {
  const activeLabels = activeTimelineLabels.length > 0 ? activeTimelineLabels : undefined
  const activeColors = activeLabels ? activeLabels.map(label => getLabelColor(labelColors, label, FALLBACK_LABEL_COLOR)) : undefined

  return {
    videoKey: `main-${selectedVideoFile ?? 'video'}`,
    videoRef: video.player.mainVideoRef,
    overlayRef: overlayCanvasRef,
    onVideoClick,
    src: video.media.mainSrc,
    fps: video.display.effectiveFps,
    currentTime: video.player.currentTime,
    duration: video.player.duration,
    volume: video.player.volume,
    muted: video.player.muted,
    onVolumeChange: video.player.setVolume,
    onToggleMute: () => video.player.setMuted(prev => !prev),
    playbackRate: video.player.playbackRate,
    onPlaybackRateChange: video.player.setPlaybackRate,
    onSeekBy: (delta: number) => video.player.seekVideo(video.player.currentTime + delta),
    activeLabels,
    activeColors,
    clickPoints: currentFramePoints.map(point => ({ id: point.id, normX: point.normX, normY: point.normY, objectId: point.objectId })),
    onDeletePoint,
    getPointColor,
    activeTrackletId,
    onIncrementTracklet,
  }
}

export interface BuildTimelineSectionPropsArgs<TClickPoint extends Record<string, unknown>> {
  video: UseVideoFeatureResult
  timeline: UseTimelineFeatureResult<TClickPoint>
  labels: UseLabelsFeatureResult
  saveStatus: SaveStatus
  onExport: () => void | Promise<void>
}

export function buildTimelineSectionProps<TClickPoint extends Record<string, unknown>>({ video, timeline, labels, saveStatus, onExport }: BuildTimelineSectionPropsArgs<TClickPoint>): TimelineSectionComponentProps {
  return {
    timelineRef: timeline.refs.timelineRef,
    svgRef: timeline.refs.svgRef,
    startDisplay: video.display.startDisplay,
    endDisplay: video.display.endDisplay,
    lengthDisplay: video.display.lengthDisplay,
    actions: labels.state.actions,
    selectedAction: timeline.annotations.selectedAction,
    onSelectedActionChange: timeline.annotations.setSelectedAction,
    contact: timeline.annotations.contact,
    onContactChange: timeline.annotations.setContact,
    onAddInteraction: () => timeline.annotations.addInteraction(),
    onExport,
    saveStatus,
  }
}

export interface BuildWaveformTimelinePropsArgs {
  audioSrc: string
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  className?: string
}

export function buildWaveformTimelineProps({ audioSrc, currentTime, duration, onSeek, className }: BuildWaveformTimelinePropsArgs): WaveformTimelineComponentProps {
  return {
    audioSrc,
    currentTime,
    durationOverride: duration,
    onSeek,
    className,
  }
}

export interface BuildLabelTimelinePropsArgs {
  duration: number
  interactions: Interaction[]
  labelColors: LabelColorMap
}

export function buildLabelTimelineProps({ duration, interactions, labelColors }: BuildLabelTimelinePropsArgs): LabelTimelineComponentProps {
  return {
    duration,
    interactions,
    labelColors,
  }
}

export interface BuildActionTablePropsArgs {
  interactions: Interaction[]
  onRemove: (index: number) => void
}

export function buildActionTableProps({ interactions, onRemove }: BuildActionTablePropsArgs): ActionTableComponentProps {
  return {
    interactions,
    onRemove,
  }
}

export interface BuildMainContentPropsArgs {
  previewPanels: VideoPreviewGroup
  videoPanel: VideoPanelComponentProps
  timelineSection: TimelineSectionComponentProps
  waveformTimeline: WaveformTimelineComponentProps
  labelTimeline: LabelTimelineComponentProps
  actionTable: ActionTableComponentProps
}

export function buildMainContentProps({ previewPanels, videoPanel, timelineSection, waveformTimeline, labelTimeline, actionTable }: BuildMainContentPropsArgs) {
  return {
    leftPreviewProps: previewPanels.left,
    rightPreviewProps: previewPanels.right,
    videoPanelProps: videoPanel,
    timelineSectionProps: timelineSection,
    waveformTimelineProps: waveformTimeline,
    labelTimelineProps: labelTimeline,
    actionTableProps: actionTable,
  }
}
