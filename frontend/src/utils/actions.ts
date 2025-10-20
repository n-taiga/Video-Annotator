// Central place to manage default action labels and utilities
import { cloneLabelDictionary } from './labelConfig'

export const DEFAULT_ACTIONS: string[] = Object.keys(cloneLabelDictionary())

// Merge default actions with incoming actions while preserving order and removing duplicates
export function mergeActions(defaults: string[], incoming: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of defaults) {
    if (!a) continue
    if (!seen.has(a)) {
      seen.add(a)
      out.push(a)
    }
  }
  for (const a of incoming) {
    if (!a) continue
    if (!seen.has(a)) {
      seen.add(a)
      out.push(a)
    }
  }
  return out
}
