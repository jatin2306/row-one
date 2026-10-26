/**
 * Turns a Google Sheets effectiveFormat into CSS for the on-screen cell.
 * Missing pieces are left unset so the sheet’s own style is what shows.
 */

function channel(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(Math.min(1, Math.max(0, number)) * 255)
}

export function cssColor(color) {
  if (!color || typeof color !== 'object') return ''
  const alpha = color.alpha == null ? 1 : Number(color.alpha)
  if (!Number.isFinite(alpha) || alpha <= 0) return ''
  const red = channel(color.red)
  const green = channel(color.green)
  const blue = channel(color.blue)
  if (alpha >= 1) return `rgb(${red}, ${green}, ${blue})`
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function styleFromFormat(format) {
  if (!format || typeof format !== 'object') return null
  const style = {}
  const background = cssColor(format.backgroundColor)
  if (background) style.backgroundColor = background
  const text = format.textFormat || {}
  const foreground = cssColor(text.foregroundColor)
  if (foreground) style.color = foreground
  if (text.bold) style.fontWeight = 700
  if (text.italic) style.fontStyle = 'italic'
  const decorations = []
  if (text.underline) decorations.push('underline')
  if (text.strikethrough) decorations.push('line-through')
  if (decorations.length > 0) style.textDecoration = decorations.join(' ')
  if (Number(text.fontSize) > 0) style.fontSize = `${text.fontSize}px`
  if (typeof text.fontFamily === 'string' && text.fontFamily) style.fontFamily = text.fontFamily
  const horizontal = { LEFT: 'left', CENTER: 'center', RIGHT: 'right' }[format.horizontalAlignment]
  if (horizontal) style.textAlign = horizontal
  if (format.wrapStrategy === 'WRAP') style.whiteSpace = 'normal'
  return Object.keys(style).length > 0 ? style : null
}
