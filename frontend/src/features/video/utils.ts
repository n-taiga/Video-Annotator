import { DEFAULT_VIDEO_FPS } from './types'

export type DurationDisplay = {
  primary: string
  secondary?: string
}

export function buildDurationDisplay(seconds: number | null): DurationDisplay {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return { primary: '–' }
  }
  if (seconds < 60) {
    return { primary: `${seconds.toFixed(2)} s` }
  }
  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  const primary =
    hours > 0
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${minutes}:${secs.toString().padStart(2, '0')}`
  const secondary = `${seconds.toFixed(2)} s`
  return { primary, secondary }
}

export function formatFpsValue(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return '–'
  }
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2)
}

export function createSessionId(seed: string): string {
  const sanitized = seed.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${sanitized || 'session'}-${timestamp}-${random}`
}

export function getFrameIndexForTime(time: number | null | undefined, fpsValue: number | null | undefined): number {
  const fps = Number.isFinite(fpsValue) && fpsValue ? fpsValue : DEFAULT_VIDEO_FPS
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0) return 0
  return Math.max(0, Math.round(time * fps))
}
