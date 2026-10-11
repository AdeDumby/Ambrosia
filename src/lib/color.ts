function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function isLight(hex: string): boolean {
  return luminance(hex) > 0.179
}

export function readableOn(hex: string): string {
  return isLight(hex) ? '#1a1a1a' : '#f2eef8'
}

function hexToHsl(hex: string): [number, number, number] {
  const [red, green, blue] = [1, 3, 5].map(
    (start) => parseInt(hex.slice(start, start + 2), 16) / 255
  )
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  const delta = max - min
  if (delta === 0) return [0, 0, lightness]

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue: number
  if (max === red) hue = ((green - blue) / delta) % 6
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4
  return [(hue * 60 + 360) % 360, saturation, lightness]
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const offset = lightness - chroma / 2
  const [red, green, blue] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x]
  return (
    '#' +
    [red, green, blue]
      .map((value) =>
        Math.round((value + offset) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  )
}

const FLIP_SATURATION = 0.6

export function flipLightness(hex: string): string {
  const [hue, saturation, lightness] = hexToHsl(hex)
  return hslToHex(hue, saturation * FLIP_SATURATION, 1 - lightness)
}

export function parseHex(text: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim())
  if (!match) return null
  const digits = match[1].toLowerCase()
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits
  return `#${full}`
}

export function isFullHex(text: string): boolean {
  return /^#?[0-9a-f]{6}$/i.test(text.trim())
}
