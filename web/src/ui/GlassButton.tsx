import type { ReactNode } from "react";

/// A toolbar button in iOS 26's Liquid Glass style: a circle for an icon, a
/// capsule for text. `prominent` is the tinted confirm action (Save, Done).
export function GlassButton({
  children,
  onClick,
  label,
  prominent,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  /// Accessible name, required when `children` is just an icon.
  label?: string;
  prominent?: boolean;
  disabled?: boolean;
}) {
  const isText = typeof children === "string";
  const classes = ["glass", "glass-button"];
  if (isText) classes.push("text");
  if (prominent) classes.push("prominent");
  return (
    <button
      type="button"
      className={classes.join(" ")}
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
