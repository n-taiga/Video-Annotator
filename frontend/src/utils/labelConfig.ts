export type LabelColorDictionary = Record<string, string>

export const FALLBACK_ACTION_LABELS: LabelColorDictionary = {
  'Drink': '#F97316',
  'Pour': '#22D3EE',
  'Stir': '#A855F7',
  'Spill': '#FB7185',
  'Pick up': '#22C55E',
  'Put down': '#FACC15',
  'Carry': '#38BDF8',
  'Look at': '#F471B5',
  'Point at': '#94A3B8',
  'Approach': '#F973D5',
  'Move away': '#0EA5E9',
  'None': '#64748B'
}

export function cloneLabelDictionary(source: LabelColorDictionary = FALLBACK_ACTION_LABELS): LabelColorDictionary {
  const result: LabelColorDictionary = {}
  for (const [rawKey, rawValue] of Object.entries(source)) {
    if (typeof rawKey !== 'string' || typeof rawValue !== 'string') continue
    const name = rawKey.trim()
    if (!name) continue
    let color = rawValue.trim()
    if (!color) continue
    if (color.startsWith('#')) {
      const body = color.slice(1).toUpperCase()
      if (/^[0-9A-F]{3}$|^[0-9A-F]{6}$/.test(body)) {
        color = `#${body}`
      }
    }
    result[name] = color
  }
  return result
}
