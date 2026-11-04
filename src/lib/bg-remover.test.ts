import { describe, it, expect } from 'vitest'
import { computeForegroundMask } from './bg-remover'

function createSyntheticImage(
  width: number,
  height: number,
  pixelFn: (x: number, y: number) => [number, number, number, number]
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const [r, g, b, a] = pixelFn(x, y)
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = a
    }
  }
  return { width, height, data, colorSpace: 'srgb' } as ImageData
}

describe('computeForegroundMask', () => {
  it('removes a solid studio backdrop while preserving the foreground subject', () => {
    const w = 60
    const h = 60
    // White studio background (248, 248, 250) with a vibrant crimson subject square in [18..42, 18..42]
    const img = createSyntheticImage(w, h, (x, y) => {
      if (x >= 18 && x <= 42 && y >= 18 && y <= 42) {
        return [210, 35, 55, 255]
      }
      return [248, 248, 250, 255]
    })

    const { alphaMask, clusters } = computeForegroundMask(img)
    expect(clusters.length).toBeGreaterThan(0)

    // Corners and borders should be completely transparent (0)
    expect(alphaMask[0]).toBe(0)
    expect(alphaMask[w - 1]).toBe(0)
    expect(alphaMask[(h - 1) * w]).toBe(0)
    expect(alphaMask[5 * w + 5]).toBe(0)

    // Center of the crimson subject should be completely opaque (255)
    expect(alphaMask[30 * w + 30]).toBe(255)
    expect(alphaMask[25 * w + 25]).toBe(255)
    expect(alphaMask[35 * w + 35]).toBe(255)
  })

  it('handles smooth lighting gradients on the background and clears interior background pockets', () => {
    const w = 64
    const h = 64
    // Soft blue-gray backdrop with a vertical brightness gradient + hollow golden ring in the middle
    const img = createSyntheticImage(w, h, (x, y) => {
      const dist = Math.hypot(x - 32, y - 32)
      if (dist >= 10 && dist <= 20) {
        // Golden ring subject
        return [235, 175, 20, 255]
      }
      // Smooth backdrop gradient from top to bottom
      const shade = Math.round(220 - (y / h) * 20)
      return [shade, shade + 5, shade + 12, 255]
    })

    const { alphaMask } = computeForegroundMask(img)

    // Outer background is removed
    expect(alphaMask[2 * w + 2]).toBe(0)
    expect(alphaMask[60 * w + 60]).toBe(0)

    // Interior hole of the ring (32, 32) matches the backdrop and is cleared
    expect(alphaMask[32 * w + 32]).toBe(0)

    // Ring body (at radius 15, e.g. x=32, y=17) is preserved
    expect(alphaMask[17 * w + 32]).toBe(255)
    expect(alphaMask[47 * w + 32]).toBe(255)
  })
})

