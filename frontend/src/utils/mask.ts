const TRACKLET_COLORS = ['rgba(255,204,0,0.98)', '#3B82F6', '#10B981', '#F97316', '#EC4899'] as const

export function getTrackletColor(objectId: number | null | undefined): string {
  if (!Number.isFinite(objectId as number)) return TRACKLET_COLORS[0]
  const index = Math.abs(Math.trunc(objectId as number)) % TRACKLET_COLORS.length
  return TRACKLET_COLORS[index]
}

export const MAX_TRACKLET_ID = TRACKLET_COLORS.length - 1
