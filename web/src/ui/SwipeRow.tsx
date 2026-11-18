import { useEffect, useRef, useState, type ReactNode } from "react";

/// `.swipeActions`: drag a row sideways to reveal buttons behind it. Swiping
/// all the way across fires the first one, like a full swipe on iOS.

export interface SwipeAction {
  label: string;
  icon: ReactNode;
  color: string;
  onAction: () => void;
}

const actionWidth = 76;
/// Only one row is open at a time, as in UIKit.
const openEvent = "donedey-swipe-open";

export function SwipeRow({
  leading = [],
  trailing = [],
  onClick,
  className = "",
  children,
}: {
  leading?: SwipeAction[];
  trailing?: SwipeAction[];
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const id = useRef(Math.random());
  const rowRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; base: number; active: boolean } | null>(null);
  /// Set when a drag ends, so the click the browser fires after it is ignored.
  const justDragged = useRef(false);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);

  const leadingWidth = leading.length * actionWidth;
  const trailingWidth = trailing.length * actionWidth;

  useEffect(() => {
    const close = (event: Event) => {
      if ((event as CustomEvent).detail !== id.current) settle(0);
    };
    window.addEventListener(openEvent, close);
    return () => window.removeEventListener(openEvent, close);
  }, []);

  const settle = (to: number) => {
    setSettling(true);
    setOffset(to);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    justDragged.current = false;
    gesture.current = { x: event.clientX, y: event.clientY, base: offset, active: false };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null; // a vertical scroll, not ours
        return;
      }
      if (Math.abs(dx) < 10) return;
      g.active = true;
      rowRef.current?.setPointerCapture(event.pointerId);
      window.dispatchEvent(new CustomEvent(openEvent, { detail: id.current }));
    }
    let next = g.base + dx;
    if (next > 0 && leading.length === 0) next = 0;
    if (next < 0 && trailing.length === 0) next = 0;
    setSettling(false);
    setOffset(next);
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.active) return;
    justDragged.current = true;
    const width = rowRef.current?.offsetWidth ?? 320;
    if (offset < -width * 0.6 && trailing[0]) {
      settle(0);
      trailing[0].onAction();
    } else if (offset > width * 0.6 && leading[0]) {
      settle(0);
      leading[0].onAction();
    } else if (offset < -trailingWidth / 2) {
      settle(-trailingWidth);
    } else if (offset > leadingWidth / 2) {
      settle(leadingWidth);
    } else {
      settle(0);
    }
  };

  const onContentClick = (event: React.MouseEvent) => {
    // A tap on an open row closes it rather than opening the item.
    if (offset !== 0) {
      event.preventDefault();
      settle(0);
      return;
    }
    onClick?.();
  };

  const run = (action: SwipeAction) => {
    settle(0);
    action.onAction();
  };

  return (
    <div
      ref={rowRef}
      className={`cell swipe ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(event) => {
        if (!justDragged.current) return;
        justDragged.current = false;
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      {offset > 0 && (
        <div className="swipe-actions leading" style={{ width: Math.max(offset, leadingWidth) }}>
          {leading.map((action) => (
            <ActionButton key={action.label} action={action} onRun={run} grow={leading.length === 1} />
          ))}
        </div>
      )}
      {offset < 0 && (
        <div className="swipe-actions trailing" style={{ width: Math.max(-offset, trailingWidth) }}>
          {trailing.map((action) => (
            <ActionButton key={action.label} action={action} onRun={run} grow={trailing.length === 1} />
          ))}
        </div>
      )}
      <div
        className={settling ? "swipe-content settling" : "swipe-content"}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, cursor: onClick ? "pointer" : undefined }}
        onClick={onContentClick}
        onTransitionEnd={() => setSettling(false)}
      >
        {children}
      </div>
    </div>
  );
}

function ActionButton({
  action,
  onRun,
  grow,
}: {
  action: SwipeAction;
  onRun: (action: SwipeAction) => void;
  grow: boolean;
}) {
  return (
    <button
      type="button"
      className="swipe-action"
      style={{ background: action.color, flex: grow ? 1 : undefined }}
      onClick={(event) => {
        event.stopPropagation();
        onRun(action);
      }}
    >
      {action.icon}
      <span>{action.label}</span>
    </button>
  );
}
