import { createPortal } from "react-dom";

/// A one-button `.alert` — used for things like a file that wouldn't import.
export function Alert({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string | null;
  onClose: () => void;
}) {
  if (message === null) return null;
  return createPortal(
    <div className="alert-backdrop" onClick={onClose}>
      <div className="alert" role="alertdialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="alert-title">{title}</div>
        <div className="alert-message">{message}</div>
        <button type="button" className="prominent-button" onClick={onClose} autoFocus>
          OK
        </button>
      </div>
    </div>,
    document.body,
  );
}
