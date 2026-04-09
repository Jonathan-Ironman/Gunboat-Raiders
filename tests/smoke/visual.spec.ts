/**
 * Visual smoke tests for the Gunboat Raiders scene.
 *
 * These tests verify that the WebGL canvas renders a meaningful scene —
 * not blank, not uniform color, and animated over time.
 *
 * Pixel sampling strategy: Playwright's page.screenshot() returns a PNG buffer.
 * We parse the PNG in Node.js using the built-in `zlib` module to extract
 * pixel data without any external image processing dependencies.
 *
 * Test timeouts are set high because Rapier WASM + shader compilation can
 * take 10–15 seconds on first load.
 */

import { test, expect, type Page } from '@playwright/test';
import { inflateSync } from 'zlib';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Time to wait for WASM + shaders + models to load, in milliseconds. */
const SCENE_READY_TIMEOUT_MS = 20_000;

/** Minimum distinct colors required to conclude the scene is "not blank". */
const MIN_DISTINCT_COLORS = 3;

/**
 * Minimum fraction of sampled pixels that must differ between two screenshots
 * to conclude animation is progressing.
 */
const MIN_ANIMATION_CHANGE_FRACTION = 0.05;

// ---------------------------------------------------------------------------
// PNG parsing
// ---------------------------------------------------------------------------

interface PixelColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface PngImage {
  width: number;
  height: number;
  /** Raw pixel data: RGBA, row-major. */
  pixels: Uint8Array;
}

/**
 * Minimal PNG decoder — supports 8-bit RGBA and RGB PNGs (the formats
 * Playwright always produces). Does NOT support all PNG variants, but is
 * sufficient for Playwright screenshot output.
 */
function decodePng(buf: Buffer): PngImage {
  // Validate PNG magic
  const PNG_MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_MAGIC[i]) throw new Error('Not a PNG file');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === 'IDAT') {
      idatChunks.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length; // length(4) + type(4) + data(length) + crc(4)
  }

  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  }

  // colorType: 2 = RGB, 6 = RGBA
  const channels = colorType === 6 ? 4 : 3;
  const hasAlpha = colorType === 6;

  const compressed = Buffer.concat(idatChunks);
  const raw = inflateSync(compressed);

  // PNG rows are prefixed with a filter byte
  const pixels = new Uint8Array(width * height * 4);
  const stride = width * channels; // bytes per row in raw data (excl. filter byte)

  // Reconstruct filtered rows
  const reconRow = new Uint8Array(stride);
  const prevRow = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw.readUInt8(rowStart);
    const rowData = raw.subarray(rowStart + 1, rowStart + 1 + stride);

    // Apply PNG filter
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? (reconRow[x - channels] ?? 0) : 0; // left
      const b = prevRow[x] ?? 0; // above
      const c = x >= channels ? (prevRow[x - channels] ?? 0) : 0; // upper-left
      const raw_x = rowData[x] ?? 0;
      let val: number;
      switch (filter) {
        case 0: // None
          val = raw_x;
          break;
        case 1: // Sub
          val = raw_x + a;
          break;
        case 2: // Up
          val = raw_x + b;
          break;
        case 3: // Average
          val = raw_x + Math.floor((a + b) / 2);
          break;
        case 4: {
          // Paeth
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          val = raw_x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          val = raw_x;
      }
      reconRow[x] = val & 0xff;
    }
    prevRow.set(reconRow);

    // Write into RGBA output
    for (let x = 0; x < width; x++) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      pixels[dst] = reconRow[src] ?? 0;
      pixels[dst + 1] = reconRow[src + 1] ?? 0;
      pixels[dst + 2] = reconRow[src + 2] ?? 0;
      pixels[dst + 3] = hasAlpha ? (reconRow[src + 3] ?? 255) : 255;
    }
  }

  return { width, height, pixels };
}

/** Extract a single pixel from a decoded PNG. */
function getPixel(img: PngImage, x: number, y: number): PixelColor {
  const idx = (Math.floor(y) * img.width + Math.floor(x)) * 4;
  return {
    r: img.pixels[idx] ?? 0,
    g: img.pixels[idx + 1] ?? 0,
    b: img.pixels[idx + 2] ?? 0,
    a: img.pixels[idx + 3] ?? 0,
  };
}

/** Sample a grid of pixels from a decoded PNG image. */
function sampleGrid(img: PngImage, cols: number, rows: number): PixelColor[] {
  const pixels: PixelColor[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = img.width * (0.05 + 0.9 * (col / Math.max(cols - 1, 1)));
      const y = img.height * (0.05 + 0.9 * (row / Math.max(rows - 1, 1)));
      pixels.push(getPixel(img, x, y));
    }
  }
  return pixels;
}

/** Count unique (r,g,b) combinations in a pixel array. */
function countDistinctColors(pixels: PixelColor[]): number {
  const seen = new Set<string>();
  for (const p of pixels) {
    seen.add(`${p.r},${p.g},${p.b}`);
  }
  return seen.size;
}

/** Compare two pixel arrays and return the fraction that changed meaningfully. */
function changedFraction(before: PixelColor[], after: PixelColor[]): number {
  if (before.length === 0 || before.length !== after.length) return 0;
  let changed = 0;
  for (let i = 0; i < before.length; i++) {
    const a = before[i];
    const b = after[i];
    if (!a || !b) continue;
    // Require a meaningful delta to avoid noise triggering false positives
    const dr = Math.abs(a.r - b.r);
    const dg = Math.abs(a.g - b.g);
    const db = Math.abs(a.b - b.b);
    if (dr + dg + db > 6) changed++;
  }
  return changed / before.length;
}

// ---------------------------------------------------------------------------
// Scene loading
// ---------------------------------------------------------------------------

/**
 * Navigate to the app and wait until the Three.js canvas is visible and the
 * scene has had enough time to initialize (WASM, shaders, models).
 */
async function loadScene(page: Page): Promise<void> {
  await page.goto('/');

  // Wait for canvas to appear in the DOM
  await page.waitForSelector('canvas', { timeout: SCENE_READY_TIMEOUT_MS });

  // Wait for network to settle (models / WASM fetch)
  await page.waitForLoadState('networkidle', { timeout: SCENE_READY_TIMEOUT_MS });

  // Give the render loop time to produce at least a few frames
  await page.waitForTimeout(2_000);
}

/** Take a screenshot of just the canvas element and decode it as PNG. */
async function screenshotCanvas(page: Page): Promise<PngImage> {
  const canvas = page.locator('canvas');
  const buf = await canvas.screenshot();
  return decodePng(buf);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Visual rendering', () => {
  test('canvas element exists and has non-zero dimensions', async ({ page }) => {
    await loadScene(page);

    const dimensions = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      return {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      };
    });

    expect(dimensions, 'Canvas element should exist in DOM').not.toBeNull();
    expect(dimensions!.width, 'Canvas width should be > 0').toBeGreaterThan(0);
    expect(dimensions!.height, 'Canvas height should be > 0').toBeGreaterThan(0);
  });

  test('scene is not blank — multiple distinct colors rendered', async ({ page }) => {
    await loadScene(page);

    const img = await screenshotCanvas(page);
    const pixels = sampleGrid(img, 5, 5);
    const distinctColors = countDistinctColors(pixels);

    expect(
      distinctColors,
      `Scene should render at least ${MIN_DISTINCT_COLORS} distinct colors but got ${distinctColors}. ` +
        `Screenshot size: ${img.width}x${img.height}. ` +
        `Sampled pixels: ${JSON.stringify(pixels.slice(0, 5))}`,
    ).toBeGreaterThanOrEqual(MIN_DISTINCT_COLORS);
  });

  test('scene is not uniformly white or black', async ({ page }) => {
    await loadScene(page);

    const img = await screenshotCanvas(page);
    const pixels = sampleGrid(img, 4, 4);

    const allWhite = pixels.every((p) => p.r > 240 && p.g > 240 && p.b > 240);
    const allBlack = pixels.every((p) => p.r < 15 && p.g < 15 && p.b < 15);

    expect(allWhite, 'Scene should not be uniformly white').toBe(false);
    expect(allBlack, 'Scene should not be uniformly black').toBe(false);
  });

  test('scene fills viewport — ocean visible in lower half', async ({ page }) => {
    await loadScene(page);

    const img = await screenshotCanvas(page);
    const { width, height } = img;

    // The lower half of the viewport should be ocean (blue/teal tones, not white).
    // The upper half may be sky (which can appear near-white/pale) — we do not
    // assert colors there. We only assert that the lower-half edge pixels are
    // rendered (alpha = 255) and are not blank white.
    const lowerEdgePoints = [
      // Bottom corners
      { x: Math.floor(width * 0.03), y: Math.floor(height * 0.97) },
      { x: Math.floor(width * 0.97), y: Math.floor(height * 0.97) },
      // Bottom edge midpoint
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.97) },
      // Side midpoints at lower half
      { x: Math.floor(width * 0.03), y: Math.floor(height * 0.75) },
      { x: Math.floor(width * 0.97), y: Math.floor(height * 0.75) },
    ];

    const lowerPixels = lowerEdgePoints.map((pt) => getPixel(img, pt.x, pt.y));

    // All lower-half edge pixels must be fully rendered (opaque)
    const unrenderedCount = lowerPixels.filter((p) => p.a < 200).length;
    expect(
      unrenderedCount,
      `${unrenderedCount} lower-edge pixels are transparent (unrendered). ` +
        `Lower-edge pixels: ${JSON.stringify(lowerPixels)}`,
    ).toBe(0);

    // None of the lower edge pixels should be pure white (unrendered blank area).
    // The sky is pale but the ocean is distinctly colored.
    const blankLowerCount = lowerPixels.filter((p) => p.r > 248 && p.g > 248 && p.b > 248).length;

    expect(
      blankLowerCount,
      `${blankLowerCount} lower-edge pixels appear blank (near white). ` +
        `Lower-edge pixels: ${JSON.stringify(lowerPixels)}`,
    ).toBe(0);
  });

  test('waves animate — scene changes between frames', async ({ page }) => {
    await loadScene(page);

    const imgBefore = await screenshotCanvas(page);
    const pixelsBefore = sampleGrid(imgBefore, 4, 4);

    // Wait 2 seconds for wave animation to advance
    await page.waitForTimeout(2_000);

    const imgAfter = await screenshotCanvas(page);
    const pixelsAfter = sampleGrid(imgAfter, 4, 4);

    const fraction = changedFraction(pixelsBefore, pixelsAfter);

    expect(
      fraction,
      `Only ${(fraction * 100).toFixed(1)}% of pixels changed after 2 seconds. ` +
        `Expected at least ${(MIN_ANIMATION_CHANGE_FRACTION * 100).toFixed(0)}% to change, ` +
        `indicating wave animation is running.`,
    ).toBeGreaterThanOrEqual(MIN_ANIMATION_CHANGE_FRACTION);
  });

  test('no JavaScript errors in console', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      errors.push(`[pageerror] ${err.message}`);
    });

    await loadScene(page);

    expect(errors, `JavaScript errors detected:\n${errors.join('\n')}`).toHaveLength(0);
  });

  test('center of viewport has rendered content', async ({ page }) => {
    await loadScene(page);

    const img = await screenshotCanvas(page);
    const centerPixel = getPixel(img, img.width / 2, img.height / 2);

    const isWhite = centerPixel.r > 248 && centerPixel.g > 248 && centerPixel.b > 248;
    expect(isWhite, `Center pixel is blank white: ${JSON.stringify(centerPixel)}`).toBe(false);

    // Center should have color (not completely desaturated gray noise)
    const maxChannel = Math.max(centerPixel.r, centerPixel.g, centerPixel.b);
    expect(
      maxChannel,
      `Center pixel appears completely black: ${JSON.stringify(centerPixel)}`,
    ).toBeGreaterThan(10);
  });
});
