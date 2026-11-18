import { useEffect, useRef, useState } from "react";

/// A New Assignment or New Exam form that's closed with something in it keeps
/// its values for a few seconds, so closing it by accident (a stray swipe
/// down, Cancel instead of Save) loses nothing: open it again in time and it
/// comes back as it was, with a Reset button to start over instead.
///
/// Drafts live in memory only. Images are still unsaved blobs at this point,
/// which storage can't hold, and a draft only has to outlive a closed sheet.

/// How long a closed form's draft is kept.
export const draftLifetime = 5000;

type Values = Record<string, unknown>;

const drafts = new Map<string, { values: Values; closedAt: number }>();

/// The draft to start a new form with, or null to start empty. Read once,
/// when the form opens. Edit forms pass `enabled: false` and always start
/// from the saved item.
export function useRestoredDraft<T extends Values>(key: string, enabled: boolean): T | null {
  const [restored] = useState(() => {
    if (!enabled) return null;
    const draft = drafts.get(key);
    if (!draft || Date.now() - draft.closedAt > draftLifetime) {
      drafts.delete(key);
      return null;
    }
    return draft.values as T;
  });
  return restored;
}

/// Keeps the form's current `values` as its draft when the form closes,
/// unless it was saved or nothing was entered (`isEmpty`).
///
/// `showReset` is true while a restored draft is on screen untouched. The
/// first change hides it for good: once you carry on typing, the draft is
/// simply your form.
export function useKeepDraft<T extends Values>({
  key,
  enabled,
  restored,
  values,
  isEmpty,
}: {
  key: string;
  enabled: boolean;
  restored: T | null;
  values: T;
  isEmpty: boolean;
}) {
  const [showReset, setShowReset] = useState(restored !== null);
  const latest = useRef({ values, isEmpty });
  latest.current = { values, isEmpty };
  /// Set on Save and Reset: the form is finished with, so nothing is kept.
  const finished = useRef(false);

  useEffect(() => {
    if (showReset && restored && Object.keys(values).some((name) => !Object.is(values[name], restored[name]))) {
      setShowReset(false);
    }
  });

  useEffect(() => {
    if (!enabled) return;
    return () => {
      if (finished.current || latest.current.isEmpty) drafts.delete(key);
      else drafts.set(key, { values: latest.current.values, closedAt: Date.now() });
    };
  }, [key, enabled]);

  /// Call before closing on Save, and before Reset starts the form over.
  const discard = () => {
    finished.current = true;
    drafts.delete(key);
  };

  return { showReset, discard };
}
