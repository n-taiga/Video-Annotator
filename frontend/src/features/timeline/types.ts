import type { DragRange } from '../video'

export type ContextMenuState =
	| { open: false }
	| { open: true; x: number; y: number; type: 'interaction'; targetIndex: number }
	| { open: true; x: number; y: number; type: 'selection' }

export interface Interaction {
	start_time: number
	end_time: number
	start_frame: number
	end_frame: number
	action_label: string
	contact: boolean
}

export interface TimelineHoverInfo {
	visible: boolean
	x: number
	y: number
	label: string
	color: string
	index: number | null
}

export interface TimelineSelectionMenuState {
	selectionMenuAction: string
	dragRange: DragRange
}

export interface TimelineSnapshot<TClickPoint extends Record<string, unknown>> {
	interactions: Interaction[]
	clickPoints: TClickPoint[]
}
