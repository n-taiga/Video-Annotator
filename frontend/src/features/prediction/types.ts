export interface ClickPoint {
	id: string
	x: number
	y: number
	normX: number
	normY: number
	time: number
	frameIndex: number
	label: number
	objectId: number
	src?: string
	meta?: unknown
	[key: string]: unknown
}
