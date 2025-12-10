import { useCallback, useEffect, useMemo } from 'react'
import { buildAppLayoutProps, useUiFeature } from '../features/ui'
import type { AppLayoutProps } from '../features/ui/components/AppLayout'
import { useLabelsFeature } from '../features/labels'
import type { LabelRenameActionContext, LabelRemoveActionContext } from '../features/labels'
import { useAnnotationIO, useProjectFeature } from '../features/project'
import { useKeyboardShortcuts } from '../features/shortcuts'
import { useVideoFeature } from '../features/video'
import { useTimelineFeature, useTimelineModel } from '../features/timeline'
import type { Interaction } from '../features/timeline'
import { usePredictionState, usePredictionActions } from '../features/prediction'
import type { ClickPoint } from '../features/prediction'
import type { VideoClickData } from '../features/video'

export interface UseAppControllerResult {
  appLayoutProps: AppLayoutProps
}

const SELECTION_MENU_HIDE_DELAY = 1000

export function useAppController(): UseAppControllerResult {
  const labels = useLabelsFeature()
  const project = useProjectFeature()
  const ui = useUiFeature()
  const timelineModel = useTimelineModel()

  const video = useVideoFeature({
    selectedVideoFile: project.state.selectedVideoFile,
    dragRange: timelineModel.dragRange,
    swapRefFile: project.state.swapRefFile,
  })

  const {
    clickPoints,
    setClickPoints,
    overlayCanvasRef,
    activeTrackletId,
    cycleActiveTracklet,
    trackletColorFor,
    currentFramePoints,
    handleSnapshotRestore,
    captureVideoFrameToCanvas,
    postPredictAndDraw,
  } = usePredictionState({
    mainVideoRef: video.player.mainVideoRef,
    currentTime: video.player.currentTime,
    currentTimeRef: video.player.currentTimeRef,
    getFrameIndexForTime: video.getFrameIndexForTime,
    selectedVideoFile: project.state.selectedVideoFile ?? '',
  })

  const timeline = useTimelineFeature<ClickPoint>({
    model: timelineModel,
    actions: labels.state.actions,
    labelColors: labels.state.labelColors,
    duration: video.player.duration,
    currentTime: video.player.currentTime,
    currentTimeRef: video.player.currentTimeRef,
    seekVideo: video.player.seekVideo,
    fps: video.display.effectiveFps,
    clickPoints,
    setClickPoints,
    onSnapshotRestored: handleSnapshotRestore,
  })

  const { handleVideoClick, removeClickPoint } = usePredictionActions({
    clickPoints,
    setClickPoints,
    mainVideoRef: video.player.mainVideoRef,
    overlayCanvasRef,
    currentTime: video.player.currentTime,
    currentTimeRef: video.player.currentTimeRef,
    getFrameIndexForTime: video.getFrameIndexForTime,
    activeTrackletId,
    pushHistory: timeline.annotations.pushHistory,
    setHistoryRedoStack: timeline.annotations.setHistoryRedoStack,
    interactions: timeline.annotations.interactions,
    captureVideoFrameToCanvas,
    postPredictAndDraw,
  })

  const { saveStatus, exportJSON } = useAnnotationIO({
    scenarioId: project.state.scenarioId,
    videoId: project.state.videoId,
    selectedVideoFile: project.state.selectedVideoFile,
    taskLabel: project.state.taskLabel,
    environment: project.state.environment,
    objectName: labels.state.objectName,
    actions: labels.state.actions,
    interactions: timeline.annotations.interactions,
    metadataOptions: project.state.metadataOptions,
    userClearedScenario: project.state.userClearedScenario,
    setScenarioId: project.actions.setScenarioId,
    setVideoId: project.actions.setVideoId,
    setTaskLabel: project.actions.setTaskLabel,
    setEnvironment: project.actions.setEnvironment,
    setObjectName: labels.actions.setObjectName,
    setActions: labels.actions.setActions,
    baseActionsRef: labels.state.baseActionsRef,
    setInteractions: timeline.annotations.setInteractions,
    userSelectedScenarioRef: project.refs.userSelectedScenarioRef,
    userSelectedVideoRef: project.refs.userSelectedVideoRef,
  })

  useEffect(() => {
    timeline.annotations.setSelectedAction(prev => (prev && labels.state.actions.includes(prev) ? prev : labels.state.actions[0] ?? ''))
  }, [labels.state.actions, timeline.annotations])

  useEffect(() => {
    const blockContextMenu = (event: MouseEvent) => event.preventDefault()
    document.addEventListener('contextmenu', blockContextMenu)
    return () => document.removeEventListener('contextmenu', blockContextMenu)
  }, [])

  const activeInteractions = useMemo(() => {
    if (!Number.isFinite(video.player.currentTime)) return [] as Interaction[]
    return timeline.annotations.interactions.filter(interaction => interaction.start_time <= video.player.currentTime && video.player.currentTime <= interaction.end_time)
  }, [timeline.annotations.interactions, video.player.currentTime])

  const activeTimelineLabels = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const interaction of activeInteractions) {
      if (!seen.has(interaction.action_label)) {
        seen.add(interaction.action_label)
        list.push(interaction.action_label)
      }
    }
    return list
  }, [activeInteractions])

  const handleRenameAction = useCallback((previousName: string, rawNextName: string) => (
    labels.actions.handleRenameAction(previousName, rawNextName, {
      interactions: timeline.annotations.interactions,
      setInteractions: timeline.annotations.setInteractions,
      historyStack: timeline.annotations.historyStack,
      setHistoryStack: timeline.annotations.setHistoryStack,
      historyRedoStack: timeline.annotations.historyRedoStack,
      setHistoryRedoStack: timeline.annotations.setHistoryRedoStack,
      selectedAction: timeline.annotations.selectedAction,
      setSelectedAction: timeline.annotations.setSelectedAction,
      selectionMenuAction: timeline.contextMenu.selectionMenuAction,
      setSelectionMenuAction: timeline.contextMenu.setSelectionMenuAction,
      hoverInfo: timelineModel.hoverInfo,
      setHoverInfo: timelineModel.setHoverInfo,
      cloneSnapshot: timeline.annotations.cloneSnapshot,
    } as unknown as LabelRenameActionContext)
  ), [labels.actions, timeline.annotations, timeline.contextMenu.selectionMenuAction, timeline.contextMenu.setSelectionMenuAction, timelineModel])

  const handleRemoveAction = useCallback((actionName: string) => (
    labels.actions.handleRemoveAction(actionName, {
      setInteractions: timeline.annotations.setInteractions,
      setHistoryStack: timeline.annotations.setHistoryStack,
      setHistoryRedoStack: timeline.annotations.setHistoryRedoStack,
      closeContextMenu: timeline.contextMenu.closeContextMenu,
      setHoverInfo: timelineModel.setHoverInfo,
    } as unknown as LabelRemoveActionContext)
  ), [labels.actions, timeline.annotations.setHistoryRedoStack, timeline.annotations.setHistoryStack, timeline.annotations.setInteractions, timeline.contextMenu, timelineModel])

  const removeInteraction = useCallback((index: number) => {
    timeline.annotations.removeInteraction(index)
    if (timeline.refs.hoverTooltipTimerRef.current !== null) {
      window.clearTimeout(timeline.refs.hoverTooltipTimerRef.current)
      timeline.refs.hoverTooltipTimerRef.current = null
    }
    timelineModel.setHoverInfo(info => ({ ...info, visible: false }))
    if (timeline.contextMenu.contextMenu.open && timeline.contextMenu.contextMenu.type === 'interaction') {
      timeline.contextMenu.closeContextMenu()
    }
  }, [timeline.annotations, timeline.contextMenu, timeline.refs.hoverTooltipTimerRef, timelineModel])

  useKeyboardShortcuts({
    undo: timeline.annotations.undo,
    redo: timeline.annotations.redo,
    contextMenu: timeline.contextMenu.contextMenu,
    mainVideoRef: video.player.mainVideoRef,
    duration: video.player.duration,
    dragRange: timelineModel.dragRange,
    setDragRange: timelineModel.setDragRange,
    actions: labels.state.actions,
    setSelectionMenuAction: timeline.contextMenu.setSelectionMenuAction,
    openContextMenu: timeline.contextMenu.openContextMenu,
    currentTime: video.player.currentTime,
    svgRef: timeline.refs.svgRef,
    xScaleRef: timeline.refs.xScaleRef,
    timelineRef: timeline.refs.timelineRef,
    setSelectionDropdownOpen: timeline.contextMenu.setSelectionDropdownOpen,
    clearSelectionMenuHideTimer: timeline.contextMenu.clearSelectionMenuHideTimer,
    hoverTooltipTimerRef: timeline.refs.hoverTooltipTimerRef,
    setHoverInfo: timelineModel.setHoverInfo,
    closeContextMenu: timeline.contextMenu.closeContextMenu,
    seekVideo: video.player.seekVideo,
    addInteraction: timeline.annotations.addInteraction,
    interactions: timeline.annotations.interactions,
    removeInteraction,
    hoverInfo: timelineModel.hoverInfo,
    setContact: timeline.annotations.setContact,
    selectionMenuAction: timeline.contextMenu.selectionMenuAction,
  })

  const { repositionToTime } = timeline.selection

  const handleVideoClickWithSelection = useCallback((info: VideoClickData) => {
    const clickTime = Number.isFinite(info.time) ? info.time : video.player.currentTime
    repositionToTime(clickTime)
    return handleVideoClick(info)
  }, [handleVideoClick, repositionToTime, video.player.currentTime])

  const appLayoutProps = buildAppLayoutProps({
    ui,
    project,
    labels,
    video,
    timeline,
    timelineModel,
    overlayCanvasRef,
    currentFramePoints,
    clickPoints,
    activeTimelineLabels,
    saveStatus,
    onExportAnnotations: exportJSON,
    onVideoClick: handleVideoClickWithSelection,
    onDeletePoint: removeClickPoint,
    getPointColor: trackletColorFor,
    activeTrackletId,
    onIncrementTracklet: cycleActiveTracklet,
    removeInteraction,
    onRemoveAction: handleRemoveAction,
    onRenameAction: handleRenameAction,
    selectionMenuHideDelay: SELECTION_MENU_HIDE_DELAY,
  })

  return { appLayoutProps }
}
