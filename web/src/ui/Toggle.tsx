/// The iOS switch. Tinted with the accent colour, like a SwiftUI Toggle
/// under `.tint`.
export function Toggle({
  isOn,
  onChange,
  label,
}: {
  isOn: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={label}
      className={isOn ? "toggle on" : "toggle"}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!isOn);
      }}
    />
  );
}

/// A full Form row: label on the left, switch on the right.
export function ToggleRow({
  label,
  isOn,
  onChange,
}: {
  label: string;
  isOn: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="cell">
      <span className="cell-label">{label}</span>
      <Toggle isOn={isOn} onChange={onChange} label={label} />
    </div>
  );
}
