import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { newId } from "../../support/id";
import { pickFiles } from "../../support/images";
import {
  defaultQuad,
  detectQuad,
  maxCornerDistance,
  scaleQuad,
  type Point,
  type Quad,
} from "../../support/scan/detect";
import { pdfFromJpegs } from "../../support/scan/pdf";
import { canvasToBlob, filterNames, renderPage, type ScanFilter } from "../../support/scan/process";
import { CheckIcon, CropIcon, FiltersIcon, PhotoIcon, RotateIcon, TrashIcon } from "../../ui/icons";

/// A document scanner like the one in Notes: the camera finds the page and
/// outlines it, Auto takes the picture once you hold still, and each page is
/// straightened and cleaned up. Pages can be cropped, filtered, turned and
/// deleted before Save makes one PDF of them all.
///
/// Without a camera (one isn't there, or permission was refused) it scans
/// from a photo instead.

interface ScanPage {
  id: string;
  /// The photo as taken, kept so the crop can be changed later.
  original: Blob;
  originalURL: string;
  width: number;
  height: number;
  quad: Quad;
  filter: ScanFilter;
  /// Quarter turns clockwise.
  turns: number;
  /// The finished page.
  output: Blob;
  outputURL: string;
  outputWidth: number;
  outputHeight: number;
}

/// A photo waiting for its corners to be set, before it becomes a page, or a
/// page whose crop is being changed.
interface Adjusting {
  original: Blob;
  originalURL: string;
  width: number;
  height: number;
  quad: Quad;
  /// Set when re-cropping a page already scanned.
  pageId?: string;
}

type CameraState = { kind: "starting" } | { kind: "live" } | { kind: "unavailable"; reason: string };

/// Photos are kept no bigger than this on their long side.
const maxPhotoSide = 2560;
/// Frames are searched for the page at this width, about ten times a second.
const detectWidth = 240;
const detectEvery = 100;
/// How long the page must stay put before Auto takes it.
const holdStill = 900;

export function DocumentScanner({
  onSave,
  onClose,
}: {
  onSave: (pdf: Blob, pageCount: number) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const viewfinder = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<CameraState>({ kind: "starting" });
  const [auto, setAuto] = useState(true);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [adjusting, setAdjusting] = useState<Adjusting | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [flash, setFlash] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /// The page outline on screen, in video pixels, and what Auto is waiting for.
  const [outline, setOutline] = useState<Quad | null>(null);
  const [hint, setHint] = useState("Position the page in view");
  const tracking = useRef({
    quad: null as Quad | null,
    stillSince: 0,
    lostSince: 0,
    /// After a capture, Auto waits for a new page before taking another.
    armed: true,
    lastCaptured: null as Quad | null,
  });

  const cameraLive = camera.kind === "live";
  const showingCamera = !adjusting && !reviewing;

  // Start the rear camera, and stop it when the scanner closes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera({ kind: "unavailable", reason: "This browser can’t use the camera here." });
        return;
      }
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        const el = video.current!;
        el.srcObject = media;
        await el.play().catch(() => {});
        setCamera({ kind: "live" });
      } catch (err) {
        const name = (err as DOMException).name;
        setCamera({
          kind: "unavailable",
          reason:
            name === "NotAllowedError"
              ? "Camera access is turned off for this app. You can allow it in Settings, or scan a photo instead."
              : name === "NotFoundError" || name === "OverconstrainedError"
                ? "No camera was found on this device."
                : "The camera couldn’t be started.",
        });
      }
    })();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Free the photos' memory when the scanner closes.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  useEffect(
    () => () => {
      for (const page of pagesRef.current) {
        URL.revokeObjectURL(page.originalURL);
        URL.revokeObjectURL(page.outputURL);
      }
    },
    [],
  );

  /// Turns a photo into a page with the given corners and adds it.
  const addPage = useCallback(async (photo: Omit<Adjusting, "pageId">) => {
    setBusy(true);
    try {
      const rendered = await renderPage(photo.original, photo.quad, "color", 0);
      const page: ScanPage = {
        id: newId(),
        ...photo,
        filter: "color",
        turns: 0,
        output: rendered.blob,
        outputURL: URL.createObjectURL(rendered.blob),
        outputWidth: rendered.width,
        outputHeight: rendered.height,
      };
      setPages((current) => [...current, page]);
    } catch {
      setError("That page couldn’t be scanned. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  /// Takes the current camera frame. Auto keeps it straight away, as Notes
  /// does; the shutter opens it for the corners to be checked first.
  const capture = useCallback(
    async (automatic: boolean) => {
      const el = video.current;
      if (!el || !el.videoWidth) return;
      const scale = Math.min(1, maxPhotoSide / Math.max(el.videoWidth, el.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(el.videoWidth * scale);
      canvas.height = Math.round(el.videoHeight * scale);
      canvas.getContext("2d")!.drawImage(el, 0, 0, canvas.width, canvas.height);
      setFlash((n) => n + 1);

      // The live outline says where the page is; a closer look at the photo
      // itself places the corners more exactly. If the two disagree, the
      // closer look found something else, so the outline wins.
      const seen = tracking.current.quad;
      const live = seen ? scaleQuad(seen, scale) : null;
      const refined = findPage(canvas);
      const quad =
        (refined && (!live || maxCornerDistance(refined, live) < canvas.width * 0.05) ? refined : live) ??
        defaultQuad(canvas.width, canvas.height);
      tracking.current.armed = false;
      tracking.current.lastCaptured = seen;

      const original = await canvasToBlob(canvas, "image/jpeg", 0.92);
      const photo = {
        original,
        originalURL: URL.createObjectURL(original),
        width: canvas.width,
        height: canvas.height,
        quad,
      };
      if (automatic) await addPage(photo);
      else setAdjusting(photo);
    },
    [addPage],
  );

  // Look for the page about ten times a second while the camera is showing.
  useEffect(() => {
    if (!cameraLive || !showingCamera) return;
    const small = document.createElement("canvas");
    const ctx = small.getContext("2d", { willReadFrequently: true })!;
    let frame = 0;
    let last = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < detectEvery || busy) return;
      last = now;
      const el = video.current;
      if (!el || !el.videoWidth) return;

      const scale = detectWidth / el.videoWidth;
      small.width = detectWidth;
      small.height = Math.round(el.videoHeight * scale);
      ctx.drawImage(el, 0, 0, small.width, small.height);
      const found = detectQuad(ctx.getImageData(0, 0, small.width, small.height));
      const t = tracking.current;

      if (!found) {
        if (!t.lostSince) t.lostSince = now;
        // A page that's gone for a moment has been turned or taken away.
        if (now - t.lostSince > 400) {
          t.quad = null;
          t.armed = true;
          setOutline(null);
        }
        setHint(t.quad ? "Hold still" : "Position the page in view");
        return;
      }
      t.lostSince = 0;
      const seen = scaleQuad(found, 1 / scale);
      // Smooth the outline so it glides rather than jitters.
      const previous = t.quad;
      const jump = previous ? maxCornerDistance(previous, seen) : Infinity;
      const quad =
        previous && jump < el.videoWidth * 0.15
          ? (previous.map((p, i) => ({ x: p.x + (seen[i]!.x - p.x) * 0.5, y: p.y + (seen[i]!.y - p.y) * 0.5 })) as Quad)
          : seen;
      if (!previous || jump > el.videoWidth * 0.015) t.stillSince = now;
      t.quad = quad;
      setOutline(quad);

      if (!t.armed && t.lastCaptured && maxCornerDistance(t.lastCaptured, quad) > el.videoWidth * 0.12) {
        t.armed = true;
      }
      if (!auto) {
        setHint("Tap the shutter to scan");
      } else if (!t.armed) {
        setHint("Ready for the next page");
      } else if (now - t.stillSince >= holdStill) {
        setHint("Scanning…");
        void capture(true);
      } else {
        setHint("Hold still");
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cameraLive, showingCamera, auto, busy, capture]);

  /// Without a camera: scan a photo from the library or Files instead.
  const scanPhoto = () =>
    pickFiles({ accept: "image/*", multiple: false }, async ([file]) => {
      if (!file) return;
      try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxPhotoSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        const original = await canvasToBlob(canvas, "image/jpeg", 0.92);
        setAdjusting({
          original,
          originalURL: URL.createObjectURL(original),
          width: canvas.width,
          height: canvas.height,
          quad: findPage(canvas) ?? defaultQuad(canvas.width, canvas.height),
        });
      } catch {
        setError("That photo couldn’t be opened.");
      }
    });

  /// Re-renders a page after its crop, filter or turn changed.
  const updatePage = async (id: string, change: Partial<Pick<ScanPage, "quad" | "filter" | "turns">>) => {
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    const next = { ...page, ...change };
    setBusy(true);
    try {
      const rendered = await renderPage(next.original, next.quad, next.filter, next.turns);
      URL.revokeObjectURL(page.outputURL);
      setPages((current) =>
        current.map((p) =>
          p.id === id
            ? {
                ...next,
                output: rendered.blob,
                outputURL: URL.createObjectURL(rendered.blob),
                outputWidth: rendered.width,
                outputHeight: rendered.height,
              }
            : p,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const deletePage = (id: string) => {
    const page = pages.find((p) => p.id === id);
    if (page) {
      URL.revokeObjectURL(page.originalURL);
      URL.revokeObjectURL(page.outputURL);
    }
    const remaining = pages.filter((p) => p.id !== id);
    setPages(remaining);
    if (remaining.length === 0) setReviewing(false);
  };

  const save = async () => {
    if (pages.length === 0) return;
    setBusy(true);
    try {
      const jpegs = await Promise.all(
        pages.map(async (page) => ({
          jpeg: new Uint8Array(await page.output.arrayBuffer()),
          width: page.outputWidth,
          height: page.outputHeight,
        })),
      );
      onSave(pdfFromJpegs(jpegs), pages.length);
      onClose();
    } catch {
      setError("The scan couldn’t be saved as a PDF.");
      setBusy(false);
    }
  };

  const cancel = () => (pages.length > 0 ? setConfirmingDiscard(true) : onClose());

  const finishAdjusting = async (quad: Quad) => {
    const target = adjusting;
    if (!target) return;
    setAdjusting(null);
    tracking.current.stillSince = performance.now();
    if (target.pageId) await updatePage(target.pageId, { quad });
    else await addPage({ ...target, quad });
  };

  const abandonAdjusting = () => {
    if (adjusting && !adjusting.pageId) URL.revokeObjectURL(adjusting.originalURL);
    setAdjusting(null);
    tracking.current.armed = true;
    tracking.current.stillSince = performance.now();
  };

  const lastPage = pages[pages.length - 1];

  return createPortal(
    <div className="scanner" role="dialog" aria-label="Scan Document">
      {/* The camera stays mounted under the other screens, so it doesn't restart. */}
      <div className="scanner-camera" hidden={!showingCamera}>
        <div className="scanner-top">
          <button type="button" className="scanner-text-button" onClick={cancel}>
            Cancel
          </button>
          <span />
          {cameraLive && (
            <button
              type="button"
              className="scanner-pill"
              aria-pressed={auto}
              onClick={() => setAuto((on) => !on)}
            >
              {auto ? "Auto" : "Manual"}
            </button>
          )}
        </div>

        <div className="scanner-viewfinder" ref={viewfinder}>
          <video ref={video} playsInline muted autoPlay hidden={!cameraLive} />
          {cameraLive && outline && video.current && (
            <Outline quad={outline} video={video.current} container={viewfinder.current} />
          )}
          {cameraLive && <div className="scanner-hint">{busy ? "Scanning…" : hint}</div>}
          {camera.kind === "starting" && <div className="scanner-hint">Starting the camera…</div>}
          {camera.kind === "unavailable" && (
            <div className="scanner-no-camera">
              <PhotoIcon size={40} strokeWidth={1.5} />
              <strong>Camera isn’t available</strong>
              <span>{camera.reason}</span>
              <button type="button" className="prominent-button" onClick={scanPhoto}>
                Scan a Photo…
              </button>
            </div>
          )}
          {flash > 0 && <div key={flash} className="scanner-flash" />}
        </div>

        <div className="scanner-bottom">
          <button
            type="button"
            className="scanner-stack"
            onClick={() => setReviewing(true)}
            disabled={pages.length === 0}
            aria-label={pages.length ? `Review ${pages.length} scanned page${pages.length > 1 ? "s" : ""}` : "No pages yet"}
          >
            {lastPage && (
              <>
                {pages.length > 1 && <span className="scanner-stack-under" />}
                <img src={lastPage.outputURL} alt="" />
                <span className="scanner-count">{pages.length}</span>
              </>
            )}
          </button>
          {cameraLive ? (
            <button
              type="button"
              className="scanner-shutter"
              aria-label="Take scan"
              disabled={busy}
              onClick={() => void capture(false)}
            >
              <span />
            </button>
          ) : (
            camera.kind === "unavailable" && pages.length > 0 && (
              <button type="button" className="scanner-pill" onClick={scanPhoto}>
                Add a Photo…
              </button>
            )
          )}
          <button
            type="button"
            className="scanner-save"
            disabled={pages.length === 0 || busy}
            onClick={() => void save()}
          >
            {pages.length > 0 ? `Save (${pages.length})` : "Save"}
          </button>
        </div>
      </div>

      {adjusting && (
        <AdjustCorners
          key={adjusting.originalURL}
          photo={adjusting}
          cancelLabel={adjusting.pageId ? "Cancel" : "Retake"}
          doneLabel={adjusting.pageId ? "Done" : "Keep Scan"}
          onCancel={abandonAdjusting}
          onDone={(quad) => void finishAdjusting(quad)}
        />
      )}

      {reviewing && !adjusting && pages.length > 0 && (
        <Review
          pages={pages}
          busy={busy}
          onDone={() => setReviewing(false)}
          onCrop={(page) =>
            setAdjusting({
              original: page.original,
              originalURL: page.originalURL,
              width: page.width,
              height: page.height,
              quad: page.quad,
              pageId: page.id,
            })
          }
          onFilter={(page, filter) => void updatePage(page.id, { filter })}
          onRotate={(page) => void updatePage(page.id, { turns: page.turns + 1 })}
          onDelete={(page) => deletePage(page.id)}
        />
      )}

      {confirmingDiscard && (
        <div className="alert-backdrop scanner-alert" onClick={() => setConfirmingDiscard(false)}>
          <div className="alert" role="alertdialog" aria-label="Discard scans" onClick={(e) => e.stopPropagation()}>
            <div className="alert-title">
              Discard {pages.length} {pages.length === 1 ? "Scan" : "Scans"}?
            </div>
            <div className="alert-message">The pages you scanned won’t be kept.</div>
            <div className="alert-buttons">
              <button type="button" className="alert-button" onClick={() => setConfirmingDiscard(false)} autoFocus>
                Keep Scanning
              </button>
              <button type="button" className="alert-button destructive" onClick={onClose}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert-backdrop scanner-alert" onClick={() => setError(null)}>
          <div className="alert" role="alertdialog" aria-label="Scan error" onClick={(e) => e.stopPropagation()}>
            <div className="alert-title">Couldn’t Scan</div>
            <div className="alert-message">{error}</div>
            <button type="button" className="prominent-button" onClick={() => setError(null)} autoFocus>
              OK
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

/// Looks for the page in a photo being kept. It searches a copy twice the
/// size the live view uses, which places the corners more exactly; the page's
/// proportions depend on them.
function findPage(canvas: HTMLCanvasElement): Quad | null {
  const small = document.createElement("canvas");
  const scale = Math.min(1, (detectWidth * 2) / canvas.width);
  small.width = Math.round(canvas.width * scale);
  small.height = Math.round(canvas.height * scale);
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  const found = detectQuad(ctx.getImageData(0, 0, small.width, small.height));
  return found ? scaleQuad(found, 1 / scale) : null;
}

/// Where an image of `width` × `height` lands when fitted into `box` with
/// object-fit `cover` or `contain`.
function fit(width: number, height: number, box: DOMRect | { width: number; height: number }, mode: "cover" | "contain") {
  const scale =
    mode === "cover" ? Math.max(box.width / width, box.height / height) : Math.min(box.width / width, box.height / height);
  return { scale, x: (box.width - width * scale) / 2, y: (box.height - height * scale) / 2 };
}

const toScreen = (quad: Quad, f: { scale: number; x: number; y: number }) =>
  quad.map((p) => ({ x: f.x + p.x * f.scale, y: f.y + p.y * f.scale })) as Quad;

const points = (quad: Quad) => quad.map((p) => `${p.x},${p.y}`).join(" ");

/// The blue shape over the page in the live camera view.
function Outline({ quad, video, container }: { quad: Quad; video: HTMLVideoElement; container: HTMLElement | null }) {
  if (!container) return null;
  const box = container.getBoundingClientRect();
  const shown = toScreen(quad, fit(video.videoWidth, video.videoHeight, box, "cover"));
  return (
    <svg className="scanner-outline" width={box.width} height={box.height} aria-hidden="true">
      <polygon points={points(shown)} />
    </svg>
  );
}

/// Drag the four corners onto the page's corners. A magnifier shows the area
/// under your finger, which would otherwise hide the corner.
function AdjustCorners({
  photo,
  cancelLabel,
  doneLabel,
  onCancel,
  onDone,
}: {
  photo: Adjusting;
  cancelLabel: string;
  doneLabel: string;
  onCancel: () => void;
  onDone: (quad: Quad) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [quad, setQuad] = useState<Quad>(photo.quad);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const f = box ? fit(photo.width, photo.height, box, "contain") : null;

  const startDrag = (index: number, event: ReactPointerEvent<SVGCircleElement>) => {
    event.preventDefault();
    (event.target as Element).setPointerCapture(event.pointerId);
    setDragging(index);
  };
  const drag = (event: ReactPointerEvent) => {
    if (dragging === null || !f || !stage.current) return;
    const rect = stage.current.getBoundingClientRect();
    const x = Math.min(photo.width, Math.max(0, (event.clientX - rect.left - f.x) / f.scale));
    const y = Math.min(photo.height, Math.max(0, (event.clientY - rect.top - f.y) / f.scale));
    setQuad((current) => current.map((p, i) => (i === dragging ? { x, y } : p)) as Quad);
  };

  /// Arrow keys nudge a focused corner, for anyone not using touch.
  const nudge = (index: number, key: string) => {
    const step = Math.max(photo.width, photo.height) / 100;
    const d: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const move = d[key];
    if (!move) return false;
    setQuad((current) =>
      current.map((p, i) =>
        i === index
          ? {
              x: Math.min(photo.width, Math.max(0, p.x + move.x)),
              y: Math.min(photo.height, Math.max(0, p.y + move.y)),
            }
          : p,
      ) as Quad,
    );
    return true;
  };

  const shown = f ? toScreen(quad, f) : null;
  const held = shown && dragging !== null ? shown[dragging]! : null;
  const names = ["top left", "top right", "bottom right", "bottom left"];
  const loupe = 110;
  const zoom = 2.5;

  return (
    <div className="scanner-screen">
      <div className="scanner-top">
        <span />
        <span className="scanner-title">Drag the corners to fit the page</span>
        <span />
      </div>
      <div className="scanner-stage" ref={stage} onPointerMove={drag} onPointerUp={() => setDragging(null)}>
        {f && shown && (
          <>
            <img
              src={photo.originalURL}
              alt=""
              style={{ position: "absolute", left: f.x, top: f.y, width: photo.width * f.scale, height: photo.height * f.scale }}
            />
            <svg className="scanner-crop" width={box!.width} height={box!.height}>
              <path
                className="scanner-crop-dim"
                fillRule="evenodd"
                d={`M0 0H${box!.width}V${box!.height}H0Z M${shown.map((p) => `${p.x} ${p.y}`).join(" L")}Z`}
              />
              <polygon className="scanner-crop-edge" points={points(shown)} />
              {shown.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={dragging === i ? 16 : 13}
                  className="scanner-corner"
                  tabIndex={0}
                  role="slider"
                  aria-label={`Move the ${names[i]} corner. Use the arrow keys.`}
                  aria-valuetext={`${Math.round(quad[i]!.x)}, ${Math.round(quad[i]!.y)}`}
                  onPointerDown={(e) => startDrag(i, e)}
                  onKeyDown={(e) => {
                    if (nudge(i, e.key)) e.preventDefault();
                  }}
                />
              ))}
            </svg>
            {held && (
              <div
                className="scanner-loupe"
                aria-hidden="true"
                style={{
                  width: loupe,
                  height: loupe,
                  left: held.x - loupe / 2,
                  top: held.y - loupe - 40 < 0 ? held.y + 40 : held.y - loupe - 40,
                  backgroundImage: `url(${photo.originalURL})`,
                  backgroundSize: `${photo.width * f.scale * zoom}px ${photo.height * f.scale * zoom}px`,
                  backgroundPosition: `${loupe / 2 - (held.x - f.x) * zoom}px ${loupe / 2 - (held.y - f.y) * zoom}px`,
                }}
              />
            )}
          </>
        )}
      </div>
      <div className="scanner-bottom">
        <button type="button" className="scanner-text-button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <span />
        <button type="button" className="scanner-save" onClick={() => onDone(quad)}>
          {doneLabel}
        </button>
      </div>
    </div>
  );
}

/// The scanned pages, one at a time, with Crop, Filter, Rotate and Delete.
function Review({
  pages,
  busy,
  onDone,
  onCrop,
  onFilter,
  onRotate,
  onDelete,
}: {
  pages: ScanPage[];
  busy: boolean;
  onDone: () => void;
  onCrop: (page: ScanPage) => void;
  onFilter: (page: ScanPage, filter: ScanFilter) => void;
  onRotate: (page: ScanPage) => void;
  onDelete: (page: ScanPage) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(pages.length - 1);
  const [choosingFilter, setChoosingFilter] = useState(false);
  const current = pages[Math.min(index, pages.length - 1)]!;

  // Open on the newest page.
  useEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = el.clientWidth * (pages.length - 1);
    // Only when the review opens.
  }, []);

  return (
    <div className="scanner-screen">
      <div className="scanner-top">
        <span />
        <span className="scanner-title">
          {Math.min(index, pages.length - 1) + 1} of {pages.length}
        </span>
        <button type="button" className="scanner-text-button strong" onClick={onDone}>
          Done
        </button>
      </div>
      <div
        className="scanner-pages"
        ref={strip}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          setChoosingFilter(false);
        }}
      >
        {pages.map((page, i) => (
          <div key={page.id} className="scanner-page">
            <img src={page.outputURL} alt={`Page ${i + 1}`} />
          </div>
        ))}
      </div>
      {choosingFilter && (
        <div className="scanner-filters" role="menu">
          {(Object.keys(filterNames) as ScanFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              role="menuitemradio"
              aria-checked={current.filter === filter}
              onClick={() => {
                setChoosingFilter(false);
                if (filter !== current.filter) onFilter(current, filter);
              }}
            >
              <span>{filterNames[filter]}</span>
              {current.filter === filter && <CheckIcon size={18} strokeWidth={2.6} />}
            </button>
          ))}
        </div>
      )}
      <div className="scanner-toolbar">
        <button type="button" onClick={() => onCrop(current)} disabled={busy} aria-label="Crop">
          <CropIcon size={24} />
        </button>
        <button
          type="button"
          onClick={() => setChoosingFilter((open) => !open)}
          disabled={busy}
          aria-label={`Filter: ${filterNames[current.filter]}`}
          aria-expanded={choosingFilter}
        >
          <FiltersIcon size={24} />
        </button>
        <button type="button" onClick={() => onRotate(current)} disabled={busy} aria-label="Rotate">
          <RotateIcon size={24} />
        </button>
        <button type="button" onClick={() => onDelete(current)} disabled={busy} aria-label="Delete page">
          <TrashIcon size={24} />
        </button>
      </div>
    </div>
  );
}
