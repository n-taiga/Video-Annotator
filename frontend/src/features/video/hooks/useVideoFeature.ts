import { useCallback, useMemo } from 'react'
import type { ComponentProps } from 'react'
import { buildApiUrl } from '../../../api'
import { useVideoPlayer } from './useVideoPlayer'
import type { UseVideoPlayerResult } from '../types'
import type { DragRange } from '../types'
import { DEFAULT_VIDEO_FPS } from '../types'
import PreviewPanel from '../components/PreviewPanel'
import type { DurationDisplay } from '../utils'
import { buildDurationDisplay, formatFpsValue, getFrameIndexForTime as getFrameIndexForTimeUtil } from '../utils'

export interface UseVideoFeatureInput {
  selectedVideoFile: string
  dragRange: DragRange
  swapRefFile: string | null
}

export interface VideoPreviewGroup {
  left: ComponentProps<typeof PreviewPanel>
  right: ComponentProps<typeof PreviewPanel>
}

export interface VideoDisplayState {
  startDisplay: string
  endDisplay: string
  lengthDisplay: string
  durationDisplay: DurationDisplay
  resolutionDisplay: string
  fpsDisplayPrimary: string
  fpsDisplaySecondary?: string
  effectiveFps: number
}

export interface VideoMediaState {
  videoSource: string
  getSourceForFile: (file: string) => string
  mainSrc: string
}

export interface UseVideoFeatureResult {
  player: UseVideoPlayerResult
  media: VideoMediaState
  display: VideoDisplayState
  previewPanels: VideoPreviewGroup
  getFrameIndexForTime: (time: number | null | undefined) => number
}

export function useVideoFeature({ selectedVideoFile, dragRange, swapRefFile }: UseVideoFeatureInput): UseVideoFeatureResult {
  const player = useVideoPlayer({ selectedVideoFile, dragRange })

  const videoSource = selectedVideoFile ? buildApiUrl(`/video/${encodeURIComponent(selectedVideoFile)}`) : ''
  const getSourceForFile = useCallback((file: string) => (file ? buildApiUrl(`/video/${encodeURIComponent(file)}`) : ''), [])
  const mainSrc = swapRefFile ? getSourceForFile(swapRefFile) : videoSource

  const startDisplay = dragRange.start !== null ? `${dragRange.start.toFixed(2)}s` : '–'
  const endDisplay = dragRange.end !== null ? `${dragRange.end.toFixed(2)}s` : '–'
  const lengthDisplay = dragRange.start !== null && dragRange.end !== null ? `${(dragRange.end - dragRange.start).toFixed(2)}s` : '–'

  const durationDisplay = buildDurationDisplay(Number.isFinite(player.duration) && player.duration > 0 ? player.duration : null)
  const resolutionDisplay = player.videoDetails.width !== null && player.videoDetails.height !== null
    ? `${player.videoDetails.width} × ${player.videoDetails.height}`
    : '–'
  const fpsValueText = formatFpsValue(player.videoDetails.fps)
  const fpsDisplayPrimary = fpsValueText === '–' ? '–' : `${fpsValueText} fps`
  const fpsDisplaySecondary = fpsValueText === '–'
    ? undefined
    : player.videoDetails.fpsSource === 'assumed'
      ? ` Assumed default (${DEFAULT_VIDEO_FPS} fps)`
      : undefined
  const effectiveFps = Number.isFinite(player.videoDetails.fps) && player.videoDetails.fps ? player.videoDetails.fps : DEFAULT_VIDEO_FPS

  const getFrameIndexForTime = useCallback((time: number | null | undefined) => (
    getFrameIndexForTimeUtil(time, effectiveFps)
  ), [effectiveFps])

  const previewPanels: VideoPreviewGroup = useMemo(() => ({
    left: {
      title: 'Start Preview',
      videoKey: `start-${selectedVideoFile}`,
      videoRef: player.leftVideoRef,
      src: videoSource,
      timeLabel: `Start: ${dragRange.start !== null ? `${dragRange.start.toFixed(2)}s` : '-'}`,
    },
    right: {
      title: 'End Preview',
      videoKey: `end-${selectedVideoFile}`,
      videoRef: player.rightVideoRef,
      src: videoSource,
      timeLabel: `End: ${dragRange.end !== null ? `${dragRange.end.toFixed(2)}s` : '-'}`,
    },
  }), [dragRange.end, dragRange.start, player.leftVideoRef, player.rightVideoRef, selectedVideoFile, videoSource])

  return {
    player,
    media: {
      videoSource,
      getSourceForFile,
      mainSrc,
    },
    display: {
      startDisplay,
      endDisplay,
      lengthDisplay,
      durationDisplay,
      resolutionDisplay,
      fpsDisplayPrimary,
      fpsDisplaySecondary,
      effectiveFps,
    },
    previewPanels,
    getFrameIndexForTime,
  }
}
