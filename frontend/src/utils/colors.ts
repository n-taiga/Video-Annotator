import { definitionsToColorMap } from './labelConfig'

export const PALETTE = ['#f97316','#22d3ee','#a855f7','#f973d5','#22c55e','#facc15','#fb7185','#38bdf8','#94a3b8','#f471b5']

export type LabelColorMap = Record<string, string>

export const DEFAULT_LABEL_COLOR_MAP: LabelColorMap = definitionsToColorMap()

function generateHarmonicColor(seed: number) {
  const hue = (seed * 137.508 + 45) % 360
  return `hsl(${hue}, 65%, 55%)`
}

export function ensureLabelColors(labels: string[], existing: LabelColorMap = {}, palette: string[] = PALETTE): LabelColorMap {
  const uniqueLabels = Array.from(new Set(labels.filter(label => typeof label === 'string' && label.trim().length > 0)))
  const filtered: LabelColorMap = {}
  const usedColors = new Set<string>()
  const pending: { label: string; preferred?: string }[] = []

  uniqueLabels.forEach(label => {
    const prevColor = existing[label]
    if (prevColor) {
      filtered[label] = prevColor
      usedColors.add(prevColor)
      return
    }
    const defaultColor = DEFAULT_LABEL_COLOR_MAP[label]
    if (defaultColor && !usedColors.has(defaultColor)) {
      filtered[label] = defaultColor
      usedColors.add(defaultColor)
    } else {
      pending.push({ label, preferred: defaultColor })
    }
  })

  let paletteIndex = 0
  let extraIndex = 0
  pending.forEach(item => {
    const { label, preferred } = item
    let color: string | undefined = preferred && !usedColors.has(preferred) ? preferred : undefined
    if (!color) {
      while (paletteIndex < palette.length) {
        const candidate = palette[paletteIndex]
        paletteIndex += 1
        if (!usedColors.has(candidate)) {
          color = candidate
          break
        }
      }
    }
    if (!color) {
      let attempt = 0
      while (attempt < 6) {
        const candidate = generateHarmonicColor(extraIndex + attempt)
        if (!usedColors.has(candidate)) {
          color = candidate
          extraIndex += attempt + 1
          break
        }
        attempt += 1
      }
      if (!color) {
        color = palette[(paletteIndex + extraIndex) % palette.length] ?? '#94a3b8'
        extraIndex += 1
      }
    }
    filtered[label] = color
    usedColors.add(color)
  })

  if (Object.keys(existing).length === Object.keys(filtered).length) {
    let identical = true
    for (const label of Object.keys(filtered)) {
      if (existing[label] !== filtered[label]) {
        identical = false
        break
      }
    }
    if (identical) return existing
  }

  return filtered
}

export function getLabelColor(colorMap: LabelColorMap, label: string, fallback = '#94a3b8'): string {
  if (label && colorMap[label]) return colorMap[label]
  return fallback
}
