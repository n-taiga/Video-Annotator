export interface LabelDefinition {
  name: string
  color: string
}

export const DEFAULT_LABEL_DEFINITIONS: LabelDefinition[] = [
  { name: 'Drink', color: '#f97316' },
  { name: 'Pour', color: '#22d3ee' },
  { name: 'Stir', color: '#a855f7' },
  { name: 'Spill', color: '#fb7185' },
  { name: 'Pick up', color: '#22c55e' },
  { name: 'Put down', color: '#facc15' },
  { name: 'Carry', color: '#38bdf8' },
  { name: 'Look at', color: '#f471b5' },
  { name: 'Point at', color: '#94a3b8' },
  { name: 'Approach', color: '#f973d5' },
  { name: 'Move away', color: '#0ea5e9' },
  { name: 'None', color: '#64748b' }
]

export function definitionsToColorMap(definitions: LabelDefinition[] = DEFAULT_LABEL_DEFINITIONS): Record<string, string> {
  return definitions.reduce<Record<string, string>>((acc, { name, color }) => {
    const trimmedName = name.trim()
    if (!trimmedName) return acc
    acc[trimmedName] = color
    return acc
  }, {})
}
