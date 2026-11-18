import { useState } from "react";
import { db, type Exam, type Reminder } from "../../db";
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

  const { showReset, discard } = useKeepDraft<ExamDraft>({
    key: draftKey,
    enabled: !exam,
    restored: draft,
    values: { title, notes, images, date, hasTime, subjectId, reminders },
    isEmpty:
      title.trim() === "" &&
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
              <Row className="disabled">No subjects yet. Add them in the Subjects tab.</Row>
            )}
            <DateRow label="Date" value={date} onChange={setDate} />
            <ToggleRow label="Set a time" isOn={hasTime} onChange={setHasTime} />
            {hasTime && <TimeRow label="Time" value={date} onChange={setDate} />}
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
