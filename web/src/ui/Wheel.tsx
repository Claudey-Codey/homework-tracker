import { useEffect, useRef, useState } from "react";

/// One column of a `.wheel` picker. Scroll-snapping does the physics; the
/// value is read back once the scroll comes to rest.

const itemHeight = 34;

export function Wheel<T extends string | number>({
  items,
  value,
  onChange,
  label,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number>();
  const index = Math.max(0, items.findIndex((item) => item.value === value));
  const [highlighted, setHighlighted] = useState(index);

  // Follow changes made from outside (e.g. clamping the count to a new unit).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (Math.round(el.scrollTop / itemHeight) !== index) {
      el.scrollTop = index * itemHeight;
    }
    setHighlighted(index);
  }, [index, items.length]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const current = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / itemHeight)));
    setHighlighted(current);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const item = items[current];
      if (item && item.value !== value) onChange(item.value);
    }, 90);
  };

  return (
    <div
      ref={ref}
      className="wheel"
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={(event) => {
        const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
        const next = items[index + step];
        if (step && next) {
          event.preventDefault();
          onChange(next.value);
        }
      }}
    >
      {items.map((item, i) => (
        <div
          key={String(item.value)}
          role="option"
          aria-selected={i === highlighted}
          className={i === highlighted ? "wheel-item selected" : "wheel-item"}
          onClick={() => ref.current?.scrollTo({ top: i * itemHeight, behavior: "smooth" })}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
