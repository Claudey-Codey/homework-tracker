import type { Quad } from "./detect";

/// Turning a photo of a page into a flat, clean scan: straighten it (a
/// perspective warp from the four corners to a rectangle), then clean it up
/// with one of the filters Apple Notes offers.

export type ScanFilter = "color" | "grayscale" | "blackAndWhite" | "photo";

export const filterNames: Record<ScanFilter, string> = {
  color: "Color",
  grayscale: "Grayscale",
  blackAndWhite: "Black & White",
  photo: "Photo",
};

/// Scans come out no bigger than this on their long side: sharp when printed
/// on A4 and small enough that a few pages stay a few megabytes.
const maxSide = 2200;

/// The page's size once straightened. Its width is the longer of its top and
/// bottom edges in the photo; its height comes from its real proportions
/// (see `aspectRatio`), so a page photographed at an angle isn't squashed.
export function straightenedSize(
  quad: Quad,
  photoWidth: number,
  photoHeight: number,
): { width: number; height: number } {
  const [tl, tr, br, bl] = quad;
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  let width = Math.max(dist(tl, tr), dist(bl, br));
  let height = Math.max(dist(tl, bl), dist(tr, br));
  const ratio = aspectRatio(quad, photoWidth / 2, photoHeight / 2);
  if (ratio) height = width / ratio;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  return { width, height };
}

/// The page's real width ÷ height, worked out from how its corners are
/// foreshortened in the photo. The camera's focal length is estimated from the
/// corners too, assuming the lens centre is the middle of the photo (Zhang and
/// He, "Whiteboard scanning and image enhancement", 2007). Null when the
/// corners don't give a believable answer; the edge lengths are used then.
export function aspectRatio(quad: Quad, cx: number, cy: number): number | null {
  const [tl, tr, br, bl] = quad;
  type V = [number, number, number];
  const m1: V = [tl.x, tl.y, 1];
  const m2: V = [tr.x, tr.y, 1];
  const m3: V = [bl.x, bl.y, 1];
  const m4: V = [br.x, br.y, 1];
  const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  const k2 = dot(cross(m1, m4), m3) / dot(cross(m2, m4), m3);
  const k3 = dot(cross(m1, m4), m2) / dot(cross(m3, m4), m2);
  if (!Number.isFinite(k2) || !Number.isFinite(k3)) return null;
  const n2: V = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 - 1];
  const n3: V = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 - 1];

  let ratio: number;
  if (Math.abs(k2 - 1) < 0.02 && Math.abs(k3 - 1) < 0.02) {
    // Seen almost head-on: no foreshortening to correct.
    ratio = Math.hypot(n2[0], n2[1]) / Math.hypot(n3[0], n3[1]);
  } else {
    const f2 =
      -(
        n2[0] * n3[0] -
        (n2[0] * n3[2] + n2[2] * n3[0]) * cx +
        n2[2] * n3[2] * cx * cx +
        (n2[1] * n3[1] - (n2[1] * n3[2] + n2[2] * n3[1]) * cy + n2[2] * n3[2] * cy * cy)
      ) /
      (n2[2] * n3[2]);
    if (!(f2 > 0)) return null;
    const f = Math.sqrt(f2);
    // A phone's lens is somewhere between ultra-wide and a modest zoom.
    const size = Math.max(cx, cy) * 2;
    if (f < size * 0.3 || f > size * 5) return null;
    const unproject = (n: V) => Math.hypot((n[0] - cx * n[2]) / f, (n[1] - cy * n[2]) / f, n[2]);
    ratio = unproject(n2) / unproject(n3);
  }
  return Number.isFinite(ratio) && ratio > 0.2 && ratio < 5 ? ratio : null;
}

/// The page cut out of `source` along `quad` and stretched flat to
/// `width` × `height`, sampling between pixels so edges stay smooth.
export function straighten(source: ImageData, quad: Quad, width: number, height: number): ImageData {
  const h = homography(width, height, quad);
  const out = new ImageData(width, height);
  const src = source.data;
  const dst = out.data;
  const sw = source.width;
  const sh = source.height;

  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      const d = h[6]! * u + h[7]! * v + 1;
      const x = Math.min(sw - 1.001, Math.max(0, (h[0]! * u + h[1]! * v + h[2]!) / d));
      const y = Math.min(sh - 1.001, Math.max(0, (h[3]! * u + h[4]! * v + h[5]!) / d));
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const p00 = (y0 * sw + x0) * 4;
      const p10 = p00 + 4;
      const p01 = p00 + sw * 4;
      const p11 = p01 + 4;
      const o = (v * width + u) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[p00 + c]! + (src[p10 + c]! - src[p00 + c]!) * fx;
        const bottom = src[p01 + c]! + (src[p11 + c]! - src[p01 + c]!) * fx;
        dst[o + c] = top + (bottom - top) * fy;
      }
      dst[o + 3] = 255;
    }
  }
  return out;
}

/// The 3×3 projective transform taking a point (u, v) of the flat
/// `width` × `height` page to where it sits in the photo.
function homography(width: number, height: number, quad: Quad): number[] {
  const from = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  const a: number[][] = [];
  const b: number[] = [];
  quad.forEach((p, i) => {
    const [u, v] = from[i]!;
    a.push([u!, v!, 1, 0, 0, 0, -u! * p.x, -v! * p.x]);
    b.push(p.x);
    a.push([0, 0, 0, u!, v!, 1, -u! * p.y, -v! * p.y]);
    b.push(p.y);
  });
  return solve(a, b);
}

/// Gaussian elimination with partial pivoting.
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const p = m[col]![col]! || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]! / p;
      for (let c = col; c <= n; c++) m[r]![c]! -= f * m[col]![c]!;
    }
  }
  return m.map((row, i) => row[n]! / (row[i]! || 1e-12));
}

/// Applies `filter` in place.
///
/// Color, Grayscale and Black & White first even out the lighting: the
/// paper's brightness is estimated across the page (the brightest pixels in
/// each small patch, smoothed) and every pixel is divided by it, so shadows
/// and a lamp's falloff disappear and the paper comes out white while ink
/// keeps its colour. Photo leaves the picture as it was taken.
export function applyFilter(image: ImageData, filter: ScanFilter) {
  if (filter === "photo") return;
  const { width: w, height: h, data } = image;
  const paper = paperBrightness(image);
  const cell = paper.cell;

  for (let y = 0; y < h; y++) {
    const gy = Math.min(paper.rows - 1.001, Math.max(0, y / cell - 0.5));
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = Math.min(paper.cols - 1.001, Math.max(0, x / cell - 0.5));
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const at = (r: number, c: number) => paper.grid[r * paper.cols + c]!;
      const top = at(y0, x0) + (at(y0, x0 + 1) - at(y0, x0)) * fx;
      const bottom = at(y0 + 1, x0) + (at(y0 + 1, x0 + 1) - at(y0 + 1, x0)) * fx;
      const scale = 250 / Math.max(40, top + (bottom - top) * fy);

      const p = (y * w + x) * 4;
      let r = Math.min(255, data[p]! * scale);
      let g = Math.min(255, data[p + 1]! * scale);
      let b = Math.min(255, data[p + 2]! * scale);

      if (filter === "color") {
        // Deepen ink and lift colours a little, like a scanner's auto setting.
        r = inkCurve(r);
        g = inkCurve(g);
        b = inkCurve(b);
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = clamp(l + (r - l) * 1.25);
        g = clamp(l + (g - l) * 1.25);
        b = clamp(l + (b - l) * 1.25);
      } else {
        const l = inkCurve(0.299 * r + 0.587 * g + 0.114 * b);
        // Faint ruled lines fall on the white side; writing and print don't.
        r = g = b = filter === "blackAndWhite" ? (l < 140 ? 0 : 255) : l;
      }
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
    }
  }
}

const clamp = (v: number) => Math.min(255, Math.max(0, v));

/// Leaves paper white and pulls everything darker towards black, so faint
/// pencil and grey ink read clearly.
const inkCurve = (v: number) => 255 * Math.pow(v / 255, 1.6);

/// A coarse grid of how bright the paper is in each part of the page.
function paperBrightness({ width: w, height: h, data }: ImageData) {
  const cell = Math.max(8, Math.round(Math.max(w, h) / 40));
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  const grid = new Float32Array(cols * rows);
  const counts = new Uint32Array(cols * rows);
  const tops = new Float32Array(cols * rows);

  // The 90th percentile is approximated as the mean of the brighter half of
  // each cell, taken twice, which ignores text and specks of noise.
  for (let pass = 0; pass < 2; pass++) {
    grid.fill(0);
    counts.fill(0);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const p = (y * w + x) * 4;
        const l = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!;
        const i = Math.floor(y / cell) * cols + Math.floor(x / cell);
        if (l >= tops[i]!) {
          grid[i]! += l;
          counts[i]!++;
        }
      }
    }
    for (let i = 0; i < grid.length; i++) tops[i] = counts[i] ? grid[i]! / counts[i]! : tops[i]!;
  }

  // Fill cells past the page's edge, then smooth so patches don't show.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!counts[i]) tops[i] = tops[Math.min(r, rows - 2) * cols + Math.min(c, cols - 2)] ?? 200;
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          sum += tops[rr * cols + cc]!;
          n++;
        }
      }
      grid[r * cols + c] = sum / n;
    }
  }
  return { grid, cols, rows, cell };
}

/// Turns `canvas` a quarter turn clockwise `turns` times.
export function rotated(canvas: HTMLCanvasElement, turns: number): HTMLCanvasElement {
  const quarter = ((turns % 4) + 4) % 4;
  if (quarter === 0) return canvas;
  const out = document.createElement("canvas");
  const sideways = quarter % 2 === 1;
  out.width = sideways ? canvas.height : canvas.width;
  out.height = sideways ? canvas.width : canvas.height;
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((quarter * Math.PI) / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The page couldn’t be saved."))), type, quality),
  );
}

/// Decodes `blob` into pixels.
export async function readPixels(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/// The finished page: straightened, filtered, turned, and as a JPEG.
export async function renderPage(
  original: Blob,
  quad: Quad,
  filter: ScanFilter,
  turns: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const source = await readPixels(original);
  const { width, height } = straightenedSize(quad, source.width, source.height);
  const flat = straighten(source, quad, width, height);
  applyFilter(flat, filter);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(flat, 0, 0);
  const out = rotated(canvas, turns);
  return { blob: await canvasToBlob(out), width: out.width, height: out.height };
}
