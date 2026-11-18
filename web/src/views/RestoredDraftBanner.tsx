import { ResetIcon } from "../ui/icons";

/// Shown at the top of a New Assignment or New Exam form that reopened with
/// what was being typed before it closed. Reset clears it all; carrying on
/// typing makes the banner go away instead.
export function RestoredDraftBanner({ onReset }: { onReset: () => void }) {
  return (
    <div className="restored-draft" role="status">
      <span>Restored your draft.</span>
      <button type="button" className="reset-button" onClick={onReset}>
        <ResetIcon size={16} strokeWidth={2.6} />
        Reset
      </button>
    </div>
  );
}
