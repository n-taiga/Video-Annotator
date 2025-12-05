import { useCallback, useRef } from 'react'

export interface MaskCacheEntry {
  frameIndex: number
  objectId: number
  maskBitmap: ImageBitmap
  timestamp: number
}

type CacheKey = `${number}-${number}`

function createCacheKey(frameIndex: number, objectId: number): CacheKey {
  return `${frameIndex}-${objectId}`
}

export interface UseMaskCacheOutput {
  /** Save mask to cache */
  cacheMask: (frameIndex: number, objectId: number, maskBitmap: ImageBitmap) => void
  /** Get mask from cache */
  getCachedMask: (frameIndex: number, objectId: number) => MaskCacheEntry | undefined
  /** Get all masks for a specific frame */
  getCachedMasksForFrame: (frameIndex: number) => MaskCacheEntry[]
  /** Check if cache exists for a specific frame */
  hasFrameCache: (frameIndex: number) => boolean
  /** Clear all cache */
  clearCache: () => void
  /** Clear cache for a specific frame */
  clearFrameCache: (frameIndex: number) => void
}

const DEFAULT_MAX_ENTRIES = 100

/**
 * Hook to manage mask cache
 * Caches masks per frame × objectId combination
 */
export function useMaskCache(maxEntries: number = DEFAULT_MAX_ENTRIES): UseMaskCacheOutput {
  const cacheRef = useRef<Map<CacheKey, MaskCacheEntry>>(new Map())
  const frameIndexMapRef = useRef<Map<number, Set<CacheKey>>>(new Map())

  /**
   * Evict old entries using LRU policy
   */
  const evictOldEntries = useCallback(() => {
    const cache = cacheRef.current
    if (cache.size <= maxEntries) return

    // Sort by timestamp and remove oldest entries
    const entries = Array.from(cache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

    const toRemove = entries.slice(0, cache.size - maxEntries)
    for (const [key, entry] of toRemove) {
      cache.delete(key)
      // Also remove from frameIndexMap
      const frameKeys = frameIndexMapRef.current.get(entry.frameIndex)
      if (frameKeys) {
        frameKeys.delete(key)
        if (frameKeys.size === 0) {
          frameIndexMapRef.current.delete(entry.frameIndex)
        }
      }
      // Release ImageBitmap
      entry.maskBitmap.close()
    }
  }, [maxEntries])

  /**
   * Save mask to cache
   */
  const cacheMask = useCallback((frameIndex: number, objectId: number, maskBitmap: ImageBitmap) => {
    const key = createCacheKey(frameIndex, objectId)
    const cache = cacheRef.current
    
    // Release old ImageBitmap if entry exists
    const existing = cache.get(key)
    if (existing) {
      existing.maskBitmap.close()
    }

    const entry: MaskCacheEntry = {
      frameIndex,
      objectId,
      maskBitmap,
      timestamp: Date.now(),
    }
    cache.set(key, entry)

    // Update frameIndexMap
    let frameKeys = frameIndexMapRef.current.get(frameIndex)
    if (!frameKeys) {
      frameKeys = new Set()
      frameIndexMapRef.current.set(frameIndex, frameKeys)
    }
    frameKeys.add(key)

    // Apply LRU eviction
    evictOldEntries()
  }, [evictOldEntries])

  /**
   * Get mask from cache
   */
  const getCachedMask = useCallback((frameIndex: number, objectId: number): MaskCacheEntry | undefined => {
    const key = createCacheKey(frameIndex, objectId)
    const entry = cacheRef.current.get(key)
    if (entry) {
      // Update timestamp for LRU
      entry.timestamp = Date.now()
    }
    return entry
  }, [])

  /**
   * Get all masks for a specific frame
   */
  const getCachedMasksForFrame = useCallback((frameIndex: number): MaskCacheEntry[] => {
    const frameKeys = frameIndexMapRef.current.get(frameIndex)
    if (!frameKeys) return []

    const cache = cacheRef.current
    const now = Date.now()
    const entries: MaskCacheEntry[] = []
    
    for (const key of frameKeys) {
      const entry = cache.get(key)
      if (entry) {
        // Update timestamp for LRU
        entry.timestamp = now
        entries.push(entry)
      }
    }
    
    // Sort by objectId
    entries.sort((a, b) => a.objectId - b.objectId)
    return entries
  }, [])

  /**
   * Check if cache exists for a specific frame
   */
  const hasFrameCache = useCallback((frameIndex: number): boolean => {
    const frameKeys = frameIndexMapRef.current.get(frameIndex)
    return frameKeys !== undefined && frameKeys.size > 0
  }, [])

  /**
   * Clear all cache
   */
  const clearCache = useCallback(() => {
    const cache = cacheRef.current
    // Release all ImageBitmaps
    for (const entry of cache.values()) {
      entry.maskBitmap.close()
    }
    cache.clear()
    frameIndexMapRef.current.clear()
  }, [])

  /**
   * Clear cache for a specific frame
   */
  const clearFrameCache = useCallback((frameIndex: number) => {
    const frameKeys = frameIndexMapRef.current.get(frameIndex)
    if (!frameKeys) return

    const cache = cacheRef.current
    for (const key of frameKeys) {
      const entry = cache.get(key)
      if (entry) {
        entry.maskBitmap.close()
        cache.delete(key)
      }
    }
    frameIndexMapRef.current.delete(frameIndex)
  }, [])

  return {
    cacheMask,
    getCachedMask,
    getCachedMasksForFrame,
    hasFrameCache,
    clearCache,
    clearFrameCache,
  }
}
