/// Finding the page in a camera frame, without a computer-vision library.
///
/// It looks for paper the way a person would: a large, bright, four-sided
/// region on a darker background. The frame is blurred, split into light and
/// dark (Otsu's method), and the biggest light region is traced. If that region
/// is close to a quadrilateral, its four corners are the page. A white page on
/// a white table won't be found, and the crop can then be set by hand.

export interface Point {
  x: number;
  y: number;
}

/// Corners in order: top left, top right, bottom right, bottom left.
export type Quad = [Point, Point, Point, Point];

/// The page has to cover at least this much of the frame to count.
const minAreaFraction = 0.12;
/// How much of the four-sided outline the light region must fill. Lower,
/// and a hand or a lamp's glare gets taken for a page.
const minFill = 0.85;
/// Light and dark must differ by at least this much (0–255), or the frame is
/// too even to tell paper from table.
const minContrast = 28;

/// The page's corners in `frame`, in its pixel coordinates, or null when no
/// page stands out. Meant for small frames, about 200–300 pixels wide.
export function detectQuad(frame: ImageData): Quad | null {
  const { width: w, height: h, data } = frame;
  const size = w * h;

  const gray = new Float32Array(size);
  for (let i = 0, p = 0; i < size; i++, p += 4) {
    gray[i] = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!;
  }
  const smooth = boxBlur(gray, w, h, 2);

  const split = otsu(smooth);
  if (split.contrast < minContrast) return null;

  const light = new Uint8Array(size);
  for (let i = 0; i < size; i++) light[i] = smooth[i]! > split.threshold ? 1 : 0;

  const region = largestRegion(light, w, h);
  if (!region || region.area < size * minAreaFraction) return null;

  // The region's outline: its leftmost and rightmost pixel on every row.
  const outline: Point[] = [];
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let first = -1;
    let last = -1;
    for (let x = 0; x < w; x++) {
      if (region.labels[row + x] === region.label) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first >= 0) {
      outline.push({ x: first, y }, { x: last + 1, y });
    }
  }

  const hull = convexHull(outline);
  if (hull.length < 4) return null;
  const quad = largestQuad(hull);
  const quadArea = area(quad);
  if (quadArea < size * minAreaFraction || region.area / quadArea < minFill) return null;
  return quad;
}

/// A quad inset from the edges of a `width` × `height` image, for when no
/// page was found and the crop has to be set by hand.
export function defaultQuad(width: number, height: number, inset = 0.08): Quad {
  const dx = width * inset;
  const dy = height * inset;
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ];
}

export function scaleQuad(quad: Quad, sx: number, sy = sx): Quad {
  return quad.map((p) => ({ x: p.x * sx, y: p.y * sy })) as Quad;
}

/// The furthest any corner moved between two quads.
export function maxCornerDistance(a: Quad, b: Quad): number {
  return Math.max(...a.map((p, i) => Math.hypot(p.x - b[i]!.x, p.y - b[i]!.y)));
}

/// Shoelace formula. Positive for corners in the order above.
export function area(quad: Quad): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i]!;
    const b = quad[(i + 1) % 4]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const span = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += src[row + Math.min(w - 1, Math.max(0, x + k))]!;
      tmp[row + x] = sum / span;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x]!;
      out[y * w + x] = sum / span;
    }
  }
  return out;
}

/// Otsu's threshold: the grey level that best splits the frame into two
/// groups, and how far apart the two groups' averages are.
function otsu(values: Float32Array): { threshold: number; contrast: number } {
  const histogram = new Float64Array(256);
  for (const v of values) histogram[Math.min(255, Math.max(0, Math.round(v)))]!++;
  const total = values.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i]!;

  let best = { threshold: 128, contrast: 0, score: -1 };
  let countBelow = 0;
  let sumBelow = 0;
  for (let t = 0; t < 256; t++) {
    countBelow += histogram[t]!;
    if (countBelow === 0) continue;
    const countAbove = total - countBelow;
    if (countAbove === 0) break;
    sumBelow += t * histogram[t]!;
    const meanBelow = sumBelow / countBelow;
    const meanAbove = (sumAll - sumBelow) / countAbove;
    const score = countBelow * countAbove * (meanBelow - meanAbove) ** 2;
    if (score > best.score) best = { threshold: t, contrast: meanAbove - meanBelow, score };
  }
  return { threshold: best.threshold, contrast: best.contrast };
}

/// Labels the connected light regions and returns the largest.
function largestRegion(light: Uint8Array, w: number, h: number) {
  const labels = new Int32Array(light.length);
  const stack = new Int32Array(light.length);
  let label = 0;
  let best = { label: 0, area: 0 };
  for (let start = 0; start < light.length; start++) {
    if (!light[start] || labels[start]) continue;
    label++;
    let top = 0;
    let count = 0;
    stack[top++] = start;
    labels[start] = label;
    while (top > 0) {
      const i = stack[--top]!;
      count++;
      const x = i % w;
      const neighbours = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1];
      for (const n of neighbours) {
        if (n >= 0 && light[n] && !labels[n]) {
          labels[n] = label;
          stack[top++] = n;
        }
      }
    }
    if (count > best.area) best = { label, area: count };
  }
  return best.area > 0 ? { labels, label: best.label, area: best.area } : null;
}

/// Andrew's monotone chain.
function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/// The largest four-cornered shape whose corners lie on the hull. It starts
/// from the corners furthest along each diagonal, then moves one corner at a
/// time to whichever hull point makes the shape biggest, until nothing grows.
function largestQuad(hull: Point[]): Quad {
  const pick = (score: (p: Point) => number) =>
    hull.reduce((best, p, i) => (score(p) > score(hull[best]!) ? i : best), 0);
  const corners = [
    pick((p) => -(p.x + p.y)),
    pick((p) => p.x - p.y),
    pick((p) => p.x + p.y),
    pick((p) => p.y - p.x),
  ];
  const quadOf = (c: number[]) => c.map((i) => hull[i]!) as Quad;

  let bestArea = area(quadOf(corners));
  for (let pass = 0; pass < 4; pass++) {
    let improved = false;
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < hull.length; i++) {
        const trial = [...corners];
        trial[k] = i;
        const a = area(quadOf(trial));
        if (a > bestArea + 1e-6) {
          bestArea = a;
          corners[k] = i;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return quadOf(corners);
}
