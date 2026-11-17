import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/// A `.sheet(item:)`: slides up over everything, dims what's behind, and can
/// be dragged down by its bar to dismiss. Sheets opened from inside a sheet
/// stack on top, as on iOS.
///
/// The sheet holds on to the last item it was shown with, so its content can
/// keep rendering while it animates away after `item` has gone back to null.

const SheetContext = createContext<{ dismiss: () => void }>({ dismiss: () => {} });

/// `@Environment(\.dismiss)` for whatever is inside a sheet.
export const useDismiss = () => useContext(SheetContext).dismiss;

const closeDuration = 320;

export function Sheet<T>({
  item,
  onClose,
  height,
  plain,
  children,
}: {
  item: T | null | undefined | false;
  onClose: () => void;
  /// White page instead of grouped grey — for a writing surface.
  plain?: boolean;
  /// A fixed-height detent, like `.presentationDetents([.height(…)])`.
  /// Omitted, the sheet is full height.
  height?: number;
  children: (item: T) => ReactNode;
}) {
  const isOpen = item !== null && item !== undefined && item !== false;
  const [shown, setShown] = useState<T | null>(isOpen ? (item as T) : null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShown(item as T);
      setClosing(false);
      return;
    }
    if (shown === null) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setShown(null);
      setClosing(false);
    }, closeDuration);
    return () => window.clearTimeout(timer);
    // `shown` is deliberately not a dependency: it's what the timer clears.
  }, [isOpen, item]);

  if (shown === null) return null;

  return createPortal(
    <SheetFrame closing={closing} onClose={onClose} height={height} plain={plain}>
      {children(shown)}
    </SheetFrame>,
    document.body,
  );
}

function SheetFrame({
  closing,
  onClose,
  height,
  plain,
  children,
}: {
  closing: boolean;
  onClose: () => void;
  height?: number;
  plain?: boolean;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; lastY: number; lastTime: number; velocity: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<"idle" | "dragging" | "settling">("idle");

  // Only the nav bar starts a drag, so scrolling the form never fights it.
  const onPointerDown = (event: React.PointerEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest("[data-drag-handle]") || target.closest("button, input, a")) return;
    drag.current = { startY: event.clientY, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0 };
    sheetRef.current?.setPointerCapture(event.pointerId);
    setPhase("dragging");
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    const dy = event.clientY - state.startY;
    const dt = Math.max(1, event.timeStamp - state.lastTime);
    state.velocity = (event.clientY - state.lastY) / dt;
    state.lastY = event.clientY;
    state.lastTime = event.timeStamp;
    // Pulling up past the top resists, like a rubber band.
    setOffset(dy > 0 ? dy : -Math.sqrt(-dy) * 2);
  };

  const onPointerUp = () => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    const dy = state.lastY - state.startY;
    if (dy > 120 || (dy > 30 && state.velocity > 0.6)) {
      setPhase("idle");
      onClose();
      return;
    }
    setPhase("settling");
    setOffset(0);
    window.setTimeout(() => setPhase("idle"), 400);
  };

  const classes = ["sheet"];
  if (height) classes.push("detent");
  if (plain) classes.push("plain");
  if (closing) classes.push("closing");
  else if (phase !== "idle") classes.push(phase);

  return (
    <SheetContext.Provider value={{ dismiss: onClose }}>
      <div className={closing ? "sheet-backdrop closing" : "sheet-backdrop"} onClick={onClose} />
      <div
        ref={sheetRef}
        className={classes.join(" ")}
        role="dialog"
        aria-modal="true"
        style={{
          height: height ? `${height}px` : undefined,
          transform: !closing && offset !== 0 ? `translateY(${offset}px)` : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
    </SheetContext.Provider>
  );
}

/// The sheet's inline nav bar — Cancel on the left, Save on the right.
/// Also the handle you drag to dismiss.
export function SheetNav({
  title,
  leading,
  trailing,
}: {
  title: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="sheet-nav" data-drag-handle>
      <div className="navbar-leading">{leading}</div>
      <div className="navbar-title">{title}</div>
      <div className="navbar-trailing">{trailing}</div>
    </div>
  );
}

export function SheetBody({ children }: { children: ReactNode }) {
  return <div className="sheet-body">{children}</div>;
}
