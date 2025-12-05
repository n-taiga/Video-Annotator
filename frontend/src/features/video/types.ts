import type React from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'

export const DEFAULT_VIDEO_FPS = 30

export type FpsSource = 'detected' | 'assumed'

export type DragRange = {
	start: number | null
	end: number | null
}

export type VideoDetails = {
	width: number | null
	height: number | null
	fps: number | null
	fpsSource: FpsSource
}

export interface UseVideoPlayerInput {
	selectedVideoFile: string
	dragRange: DragRange
}

export interface UseVideoPlayerResult {
	mainVideoRef: RefObject<HTMLVideoElement>
	leftVideoRef: RefObject<HTMLVideoElement>
	rightVideoRef: RefObject<HTMLVideoElement>
	referenceVideoRefs: MutableRefObject<Record<string, HTMLVideoElement | null>>
	duration: number
	currentTime: number
	currentTimeRef: MutableRefObject<number>
	videoDetails: VideoDetails
	volume: number
	muted: boolean
	playbackRate: number
	setVolume: Dispatch<SetStateAction<number>>
	setMuted: Dispatch<SetStateAction<boolean>>
	setPlaybackRate: Dispatch<SetStateAction<number>>
	seekVideo: (time: number) => void
	pipTop: number
	pipRight: number
	pipWidth: number
	pipHeight: number
	startPipDrag: (event: React.PointerEvent) => void
}
