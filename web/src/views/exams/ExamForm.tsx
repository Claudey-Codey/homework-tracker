import { useState } from "react";
import { db, examScore, type Exam, type Reminder } from "../../db";
import { defaultExamDate, endOfDay } from "../../support/dates";
import { newId } from "../../support/id";
import { useKeepDraft, useRestoredDraft } from "../../support/formDraft";
import { commitImages, type DraftImage } from "../../support/images";
import { GlassButton } from "../../ui/GlassButton";
import { List, Row, Section } from "../../ui/List";
import { DateRow, MenuPickerRow, TimeRow } from "../../ui/Pickers";
import { SheetBody, SheetNav, useDismiss } from "../../ui/Sheet";
import { ToggleRow } from "../../ui/Toggle";
import { finalizeNotes, NotesSection, type DraftNote } from "../NotesSection";
import { ReminderSection } from "../ReminderEditor";
import { RestoredDraftBanner } from "../RestoredDraftBanner";
import { subjectOptions, useSubjects } from "../useSubjects";
import { TextField } from "../../ui/TextField";

/// Everything a new exam's form holds, kept for a few seconds after it
/// closes unsaved (see `formDraft.ts`).
type ExamDraft = {
  title: string;
  notes: DraftNote[];
  images: DraftImage[];
  date: Date;
  hasTime: boolean;
  subjectId: string;
  reminders: Reminder[];
  /// The score field's digits, "" when empty.
  score: string;
};

const draftKey = "new-exam";

/// Add or edit an exam. Presented as a sheet. Reset starts a restored new
/// exam over by mounting a fresh form.
export function ExamForm({ exam }: { exam?: Exam }) {
  const [generation, setGeneration] = useState(0);
  return <ExamFormBody key={generation} exam={exam} onReset={() => setGeneration((n) => n + 1)} />;
}

function ExamFormBody({ exam, onReset }: { exam?: Exam; onReset: () => void }) {
  const dismiss = useDismiss();
  const subjects = useSubjects();
  const draft = useRestoredDraft<ExamDraft>(draftKey, !exam);

  const [title, setTitle] = useState(draft?.title ?? exam?.title ?? "");
  const [notes, setNotes] = useState<DraftNote[]>(draft?.notes ?? exam?.notes ?? []);
  const [images, setImages] = useState<DraftImage[]>(draft?.images ?? exam?.images ?? []);
  const [date, setDate] = useState(() => draft?.date ?? (exam ? new Date(exam.date) : defaultExamDate()));
  const [hasTime, setHasTime] = useState(draft?.hasTime ?? exam?.hasTime ?? false);
  const [subjectId, setSubjectId] = useState(draft?.subjectId ?? exam?.subjectId ?? "");
  const [reminders, setReminders] = useState<Reminder[]>(draft?.reminders ?? exam?.reminders ?? []);
  const [score, setScore] = useState(() => {
    if (draft) return draft.score;
    const saved = exam ? examScore(exam) : null;
    return saved === null ? "" : String(saved);
  });

  const { showReset, discard } = useKeepDraft<ExamDraft>({
    key: draftKey,
    enabled: !exam,
    restored: draft,
    values: { title, notes, images, date, hasTime, subjectId, reminders, score },
    isEmpty:
      title.trim() === "" &&
      score === "" &&
      subjectId === "" &&
      !hasTime &&
      date.getTime() === defaultExamDate().getTime() &&
      reminders.length === 0 &&
      notes.length === 0 &&
      images.length === 0,
  });

  const reset = () => {
    discard();
    onReset();
  };

  const canSave = subjectId !== "" || title.trim() !== "";

  const save = async () => {
    const savedImages = await commitImages(images, exam?.images);
    await db.exams.put({
      id: exam?.id ?? newId(),
      title: title.trim(),
      date: (hasTime ? date : endOfDay(date)).getTime(),
      hasTime,
      subjectId: subjectId || null,
      notes: finalizeNotes(notes, exam?.notes),
      images: savedImages,
      reminders,
      score: score === "" ? undefined : Number(score),
      createdAt: exam?.createdAt ?? Date.now(),
    });
    discard();
    dismiss();
  };

  return (
    <>
      <SheetNav
        title={exam ? "Edit Exam" : "New Exam"}
        leading={<GlassButton onClick={dismiss}>Cancel</GlassButton>}
        trailing={
          <GlassButton prominent disabled={!canSave} onClick={save}>
            Save
          </GlassButton>
        }
      />
      <SheetBody>
        <List>
          {showReset && <RestoredDraftBanner onReset={reset} />}
          <Section header="Exam">
            <Row>
              <TextField
                placeholder="Title (optional)"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                enterKeyHint="done"
              />
            </Row>
            {subjects.some((subject) => subject.isActive) || subjectId ? (
              <MenuPickerRow
                label="Subject"
                value={subjectId}
                options={subjectOptions(subjects, subjectId)}
                onChange={setSubjectId}
              />
            ) : (
              <Row className="disabled">No subjects yet. Add them in Account, under Subjects.</Row>
            )}
            <DateRow label="Date" value={date} onChange={setDate} />
            <ToggleRow label="Set a time" isOn={hasTime} onChange={setHasTime} />
            {hasTime && <TimeRow label="Time" value={date} onChange={setDate} />}
          </Section>

          <Section
            header="Score"
            footer="Out of 100. Shown on the exam in the Exams list. Leave it empty until you get your result."
          >
            <Row>
              <TextField
                placeholder="e.g. 88"
                aria-label="Score"
                inputMode="numeric"
                value={score}
                onChange={(event) => setScore(scoreInput(event.target.value, score))}
                enterKeyHint="done"
              />
              <span className="secondary">/ 100</span>
            </Row>
          </Section>

          <NotesSection
            header="Study material"
            emptyFooter="Add as many notes as you like — one per topic, chapter, or worksheet."
            notes={notes}
            onChange={setNotes}
            images={images}
            onImagesChange={setImages}
          />

          <ReminderSection reminders={reminders} onChange={setReminders} />
        </List>
      </SheetBody>
    </>
  );
}

/// Keeps the score field to a whole number from 0 to 100: anything but
/// digits is dropped, and a keystroke that would go past 100 is ignored.
function scoreInput(typed: string, previous: string): string {
  const digits = typed.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits === "" || Number(digits) <= 100 ? digits : previous;
}
