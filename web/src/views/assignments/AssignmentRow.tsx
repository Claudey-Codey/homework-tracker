import { db, type Assignment, type Subject } from "../../db";
import { formatMonthDay, formatTime } from "../../support/dates";
import { urgencyColor } from "../../support/due";
import { noSubjectHex, withAlpha } from "../../support/theme";
import { CheckBox } from "../../ui/CheckBox";
import { ChecklistIcon, NoteIcon } from "../../ui/icons";

export function AssignmentRow({
  assignment,
  subject,
}: {
  assignment: Assignment;
  subject?: Subject;
}) {
  const accent = subject?.colorHex ?? noSubjectHex;
  const doneSteps = assignment.checklist.filter((item) => item.isDone).length;
  const noteCount = assignment.notes?.length ?? 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 0" }}>
      <span style={{ width: 28, display: "flex", justifyContent: "center" }}>
        <CheckBox
          isOn={assignment.isDone}
          tint={accent}
          toggle={() => {
            void db.assignments.update(assignment.id, { isDone: !assignment.isDone });
            // Finishing a whole assignment is the bigger moment, so it always
            // gets the fuller cue.
            return !assignment.isDone;
          }}
        />
      </span>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span
          dir="auto"
          style={{
            textDecoration: assignment.isDone ? "line-through" : undefined,
            color: assignment.isDone ? "var(--label-2)" : undefined,
            overflowWrap: "anywhere",
          }}
        >
          {assignment.title}
        </span>

        {(subject || assignment.checklist.length > 0 || noteCount > 0) && (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {subject && (
              <span
                className="caption"
                dir="auto"
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: withAlpha(accent, 0.18),
                  color: accent,
                }}
              >
                {subject.name}
              </span>
            )}
            {assignment.checklist.length > 0 && (
              <span className="caption secondary" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <ChecklistIcon size={13} strokeWidth={2.2} />
                {doneSteps}/{assignment.checklist.length}
              </span>
            )}
            {noteCount > 0 && (
              <span className="caption secondary" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <NoteIcon size={13} strokeWidth={2.2} />
                {noteCount}
              </span>
            )}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <span className="subheadline" style={{ color: urgencyColor(assignment.dueDate, assignment.isDone) }}>
          {formatMonthDay(assignment.dueDate)}
        </span>
        {assignment.hasTime && (
          <span className="caption2 secondary">{formatTime(assignment.dueDate)}</span>
        )}
      </div>
    </div>
  );
}
