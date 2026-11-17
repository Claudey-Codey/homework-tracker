import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, deleteExam, type Exam, type Subject } from "../../db";
import { formatMonthDay, formatTime } from "../../support/dates";
import { urgencyColor } from "../../support/due";
import { noteTitle } from "../../support/noteText";
import { noSubjectHex } from "../../support/theme";
import { ContentUnavailable } from "../../ui/ContentUnavailable";
import { GlassButton } from "../../ui/GlassButton";
import { emptyIconProps, GraduationCapIcon, NoteIcon, PhotoIcon, PlusIcon, TrashIcon } from "../../ui/icons";
import { List, Section } from "../../ui/List";
import { Screen } from "../../ui/NavStack";
import { Sheet } from "../../ui/Sheet";
import { SwipeRow } from "../../ui/SwipeRow";
import { useSubjectMap } from "../useSubjects";
import { ExamForm } from "./ExamForm";

export function ExamsView() {
  const exams = useLiveQuery(() => db.exams.orderBy("date").toArray(), [], undefined);
  const subjects = useSubjectMap();
  const [showingAdd, setShowingAdd] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);

  const isEmpty = exams !== undefined && exams.length === 0;

  return (
    <Screen
      title="Exams"
      large
      plain={isEmpty}
      trailing={
        <GlassButton onClick={() => setShowingAdd(true)} label="Add Exam">
          <PlusIcon size={24} strokeWidth={2} />
        </GlassButton>
      }
      overlay={
        isEmpty && (
          <ContentUnavailable
            icon={<GraduationCapIcon {...emptyIconProps} />}
            title="No Exams"
            description="Tap + to add an exam, its date, and what to study."
          />
        )
      }
    >
      {!isEmpty && (
        <List>
          <Section separatorInset={33}>
            {(exams ?? []).map((exam) => (
              <SwipeRow
                key={exam.id}
                onClick={() => setEditing(exam)}
                trailing={[
                  {
                    label: "Delete",
                    icon: <TrashIcon size={20} />,
                    color: "var(--red)",
                    onAction: () => void deleteExam(exam.id),
                  },
                ]}
              >
                <ExamRow exam={exam} subject={exam.subjectId ? subjects.get(exam.subjectId) : undefined} />
              </SwipeRow>
            ))}
          </Section>
        </List>
      )}

      <Sheet item={showingAdd} onClose={() => setShowingAdd(false)}>
        {() => <ExamForm />}
      </Sheet>
      <Sheet item={editing} onClose={() => setEditing(null)}>
        {(exam) => <ExamForm exam={exam} />}
      </Sheet>
    </Screen>
  );
}

function ExamRow({ exam, subject }: { exam: Exam; subject?: Subject }) {
  const accent = subject?.colorHex ?? noSubjectHex;
  const displayTitle = exam.title || subject?.name || "Exam";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 0" }}>
      <span style={{ width: 5, height: 40, borderRadius: 3, background: accent, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="headline" dir="auto">{displayTitle}</span>

        {subject && exam.title && (
          <span className="caption secondary" dir="auto">{subject.name}</span>
        )}

        {exam.notes.length > 0 && (
          <span className="subheadline secondary" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <NoteIcon size={15} strokeWidth={2} style={{ marginTop: 2 }} />
            <span className="line-clamp-2" dir="auto">
              {exam.notes.map((note) => noteTitle(note.text)).join(" · ")}
            </span>
          </span>
        )}

        {(exam.images?.length ?? 0) > 0 && (
          <span className="caption secondary" style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <PhotoIcon size={13} strokeWidth={2.2} />
            {exam.images!.length === 1 ? "1 image" : `${exam.images!.length} images`}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <span className="subheadline" style={{ fontWeight: 600, color: urgencyColor(exam.date, false) }}>
          {formatMonthDay(exam.date)}
        </span>
        {exam.hasTime && <span className="caption2 secondary">{formatTime(exam.date)}</span>}
      </div>
    </div>
  );
}
