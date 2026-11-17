import type { ReactNode } from "react";
import {
  formatMediumDate,
  formatTime,
  toDateInput,
  toTimeInput,
  withDay,
  withTime,
} from "../support/dates";
import { ChevronsUpDownIcon } from "./icons";

/// A native picker laid invisibly over our own styling, so tapping it opens
/// the real iOS date wheel / calendar / menu while it *looks* like SwiftUI.
/// Desktop browsers won't open a picker from a click on an invisible input,
/// hence `showPicker()`.
function openPicker(event: React.MouseEvent<HTMLInputElement | HTMLSelectElement>) {
  const input = event.currentTarget as HTMLInputElement;
  try {
    input.showPicker?.();
  } catch {
    // Already open, or not allowed — the native tap still works.
  }
}

/// `DatePicker(displayedComponents: .date)` in its compact style.
export function DateRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}) {
  return (
    <div className="cell">
      <span className="cell-label">{label}</span>
      <span className="pill-picker">
        {formatMediumDate(value.getTime())}
        <input
          type="date"
          className="native-overlay"
          aria-label={label}
          value={toDateInput(value)}
          onClick={openPicker}
          onChange={(event) => {
            if (event.target.value) onChange(withDay(value, event.target.value));
          }}
        />
      </span>
    </div>
  );
}

/// `DatePicker(displayedComponents: .hourAndMinute)`.
export function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}) {
  return (
    <div className="cell">
      <span className="cell-label">{label}</span>
      <span className="pill-picker">
        {formatTime(value.getTime())}
        <input
          type="time"
          className="native-overlay"
          aria-label={label}
          value={toTimeInput(value)}
          onClick={openPicker}
          onChange={(event) => {
            if (event.target.value) onChange(withTime(value, event.target.value));
          }}
        />
      </span>
    </div>
  );
}

/// A menu-style `Picker` row: label, current value and ⌃⌄ on the right.
export function MenuPickerRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const current = options.find((option) => option.value === value)?.label ?? "";
  return (
    <div className="cell" style={{ position: "relative" }}>
      <span className="cell-label">{label}</span>
      <span className="cell-value">
        <span dir="auto">{current}</span>
        <ChevronsUpDownIcon size={15} strokeWidth={2.2} />
      </span>
      <select
        className="native-overlay"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/// A segmented control with the sliding thumb.
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  return (
    <div className="segmented" role="radiogroup">
      <span
        className="segmented-thumb"
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={option.value === value ? "selected" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
