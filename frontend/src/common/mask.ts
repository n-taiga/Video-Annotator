const TRACKLET_COLORS = ['#FFCC00', '#3B82F6', '#10B981', '#F97316', '#EC4899'] as const

export function getTrackletColor(objectId: number | null | undefined): string {
  if (!Number.isFinite(objectId as number)) return TRACKLET_COLORS[0]
  const index = Math.abs(Math.trunc(objectId as number)) % TRACKLET_COLORS.length
  return TRACKLET_COLORS[index]
}

export const MAX_TRACKLET_ID = TRACKLET_COLORS.length - 1

/**
 * Convert HEX or rgba color to rgba format with applied opacity
 */
function parseColorToRgba(color: string, opacity: number): string {
  // Handle rgba format
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/)
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${opacity})`
  }
  
  // Handle HEX format
  const hexMatch = color.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    }
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }
  
  // Fallback
  return `rgba(0, 89, 255, ${opacity})`
}

/**
 * Get semi-transparent color for mask
 * @param objectId Object ID
 * @param opacity Opacity (0.0 ~ 1.0)
 * @returns Color string in rgba format
 */
export function getMaskColor(objectId: number | null | undefined, opacity: number = 0.4): string {
  const baseColor = getTrackletColor(objectId)
  return parseColorToRgba(baseColor, opacity)
}

/**
 * Decode Base64-encoded PNG image to ImageBitmap
 * @param b64 Base64-encoded image data
 * @returns Decoded ImageBitmap
 */
export async function decodeMaskFromBase64(b64: string): Promise<ImageBitmap> {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const maskBlob = new Blob([bytes], { type: 'image/png' })
  return createImageBitmap(maskBlob)
}

/**
 * Decode PNG bytes to ImageBitmap (for multipart binary transfer)
 * @param pngBytes PNG binary data as Uint8Array or Blob
 * @returns Decoded ImageBitmap
 */
export async function decodeMaskFromBytes(pngBytes: Uint8Array | Blob): Promise<ImageBitmap> {
  if (pngBytes instanceof Blob) {
    return createImageBitmap(pngBytes)
  }
  // Create a copy of the buffer to ensure it's a standard ArrayBuffer
  const buffer = new ArrayBuffer(pngBytes.byteLength)
  new Uint8Array(buffer).set(pngBytes)
  const blob = new Blob([buffer], { type: 'image/png' })
  return createImageBitmap(blob)
}

/**
 * Draw mask to canvas with colorization
 * @param ctx Target CanvasRenderingContext2D
 * @param maskBitmap Decoded mask image
 * @param objectId Object ID (for color selection)
 * @param opacity Opacity
 */
export function drawColorizedMask(
  ctx: CanvasRenderingContext2D,
  maskBitmap: ImageBitmap,
  objectId: number | null | undefined,
  opacity: number = 0.4
): void {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  
  // Draw mask to temporary canvas
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = width
  tempCanvas.height = height
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) return
  
  // Draw mask
  tempCtx.drawImage(maskBitmap, 0, 0, width, height)
  
  // Apply color to mask region
  tempCtx.globalCompositeOperation = 'source-in'
  tempCtx.fillStyle = getMaskColor(objectId, opacity)
  tempCtx.fillRect(0, 0, width, height)
  
  // Composite to original canvas
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(tempCanvas, 0, 0)
}

/**
 * Draw mask outline (contour)
 * @param ctx Target CanvasRenderingContext2D
 * @param maskBitmap Decoded mask image
 * @param objectId Object ID (for color selection, uses opacity 1.0 for outline)
 */
export function drawMaskOutline(
  ctx: CanvasRenderingContext2D,
  maskBitmap: ImageBitmap,
  objectId: number | null | undefined
): void {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  
  // Get mask as ImageData
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = width
  tempCanvas.height = height
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) return
  
  tempCtx.drawImage(maskBitmap, 0, 0, width, height)
  const src = tempCtx.getImageData(0, 0, width, height)
  const srcData = src.data
  
  // Create ImageData for outline
  const out = tempCtx.createImageData(width, height)
  const outData = out.data
  
  // Edge detection
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = srcData[i + 3]
      if (a > 128) {
        let isEdge = false
        if (x > 0 && srcData[i - 4 + 3] <= 128) isEdge = true
        else if (x < width - 1 && srcData[i + 4 + 3] <= 128) isEdge = true
        else if (y > 0 && srcData[i - width * 4 + 3] <= 128) isEdge = true
        else if (y < height - 1 && srcData[i + width * 4 + 3] <= 128) isEdge = true
        if (isEdge) {
          outData[i + 0] = 255
          outData[i + 1] = 255
          outData[i + 2] = 255
          outData[i + 3] = 255
        }
      }
    }
  }
  
  // Draw outline
  const outlineCanvas = document.createElement('canvas')
  outlineCanvas.width = width
  outlineCanvas.height = height
  const outCtx = outlineCanvas.getContext('2d')
  if (!outCtx) return
  
  outCtx.putImageData(out, 0, 0)
  
  // Apply color based on objectId (opacity 1.0 for solid outline)
  outCtx.globalCompositeOperation = 'source-in'
  outCtx.fillStyle = getMaskColor(objectId, 1.0)
  outCtx.fillRect(0, 0, width, height)
  
  // Draw to original canvas (with slight blur effect)
  ctx.save()
  ctx.filter = 'blur(0.5px)'
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(outlineCanvas, 0, 0)
  ctx.filter = 'none'
  ctx.restore()
}
