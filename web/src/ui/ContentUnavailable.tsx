import type { ReactNode } from "react";

/// `ContentUnavailableView`: the big icon, title and hint shown when a list
/// has nothing in it yet.
export function ContentUnavailable({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-description">{description}</div>
      {action && (
        <button type="button" className="prominent-button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
