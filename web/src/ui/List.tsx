import type { CSSProperties, ReactNode } from "react";
import { ChevronRightIcon } from "./icons";

/// SwiftUI's insetGrouped `List` / `Form`: rounded cards of rows on a grey
/// background, each section with an optional header and footer.

export function List({ children }: { children: ReactNode }) {
  return <div className="list">{children}</div>;
}

export function Section({
  header,
  footer,
  clear,
  separatorInset,
  children,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  /// No card behind the rows — `.listRowBackground(Color.clear)`.
  clear?: boolean;
  /// Where row separators start, for rows that lead with an icon.
  separatorInset?: number;
  children: ReactNode;
}) {
  const style = separatorInset === undefined
    ? undefined
    : ({ "--separator-inset": `${separatorInset}px` } as CSSProperties);
  return (
    <section className="section">
      {header && <div className="section-header">{header}</div>}
      <div className={clear ? "cells clear" : "cells"} style={style}>
        {children}
      </div>
      {footer && <div className="section-footer">{footer}</div>}
    </section>
  );
}

export function Row({
  children,
  onClick,
  className = "",
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  if (onClick) {
    return (
      <button type="button" className={`cell tappable ${className}`} onClick={onClick} style={style}>
        {children}
      </button>
    );
  }
  return (
    <div className={`cell ${className}`} style={style}>
      {children}
    </div>
  );
}

/// A row that pushes another screen: icon + label + chevron.
export function LinkRow({
  icon,
  label,
  onClick,
}: {
  icon?: ReactNode;
  label: ReactNode;
  onClick: () => void;
}) {
  return (
    <Row onClick={onClick}>
      {icon && <span className="row-icon">{icon}</span>}
      <span className="cell-label">{label}</span>
      <ChevronRightIcon size={17} strokeWidth={2.4} className="chevron" />
    </Row>
  );
}

/// An accent-coloured action row — "Add Reminder", "Add Note".
export function ButtonRow({
  icon,
  label,
  onClick,
  color,
}: {
  icon?: ReactNode;
  label: ReactNode;
  onClick: () => void;
  color?: string;
}) {
  return (
    <Row onClick={onClick} className="accent">
      {icon && <span style={{ display: "flex", color }}>{icon}</span>}
      <span className="cell-label">{label}</span>
    </Row>
  );
}
