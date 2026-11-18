import { useState } from "react";
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

/// An `.alert` with a text field — Rename. Return saves, Escape cancels, and
/// Save stays off while the field is blank.
export function Prompt({
  title,
  initialValue,
  onSave,
  onClose,
}: {
  title: string;
  /// Null hides the prompt.
  initialValue: string | null;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  if (initialValue === null) return null;
  return createPortal(
    <PromptBody title={title} initialValue={initialValue} onSave={onSave} onClose={onClose} />,
    document.body,
  );
}

function PromptBody({
  title,
  initialValue,
  onSave,
  onClose,
}: {
  title: string;
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const blank = value.trim() === "";
  const save = () => {
    if (blank) return;
    onSave(value.trim());
    onClose();
  };
  return (
    <div className="alert-backdrop" onClick={onClose}>
      <form
        className="alert"
        role="alertdialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="alert-title">{title}</div>
        <input
          className="alert-field"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          aria-label="Name"
          autoComplete="off"
          dir="auto"
          autoFocus
        />
        <div className="alert-buttons">
          <button type="button" className="alert-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="prominent-button" disabled={blank}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
