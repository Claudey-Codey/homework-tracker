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

/// A two-button `.alert` — Cancel and an action, such as "Sign Out". A
/// destructive action is shown in red.
export function Confirm({
  title,
  message,
  actionLabel,
  destructive,
  isPresented,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  actionLabel: string;
  destructive?: boolean;
  isPresented: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!isPresented) return null;
  return createPortal(
    <div className="alert-backdrop" onClick={onClose}>
      <div className="alert" role="alertdialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="alert-title">{title}</div>
        <div className="alert-message">{message}</div>
        <div className="alert-buttons">
          <button type="button" className="alert-button" onClick={onClose} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className={destructive ? "alert-button destructive" : "prominent-button"}
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface PromptProps {
  title: string;
  /// Shown under the title, as in an alert.
  message?: string;
  /// The confirm button. "Save" unless given.
  actionLabel?: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

/// An `.alert` with a text field — Rename. Return saves, Escape cancels, and
/// Save stays off while the field is blank.
export function Prompt({
  initialValue,
  ...props
}: PromptProps & {
  /// Null hides the prompt.
  initialValue: string | null;
}) {
  if (initialValue === null) return null;
  return createPortal(<PromptBody initialValue={initialValue} {...props} />, document.body);
}

function PromptBody({
  title,
  message,
  actionLabel = "Save",
  initialValue,
  onSave,
  onClose,
}: PromptProps & { initialValue: string }) {
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
        {message && <div className="alert-message">{message}</div>}
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
            {actionLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
