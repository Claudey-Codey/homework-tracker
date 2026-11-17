import { useState } from "react";
import { db, type Exam, type Reminder } from "../../db";
import { defaultExamDate, endOfDay } from "../../support/dates";
import { newId } from "../../support/id";
import { commitImages, type DraftImage } from "../../support/images";
import { GlassButton } from "../../ui/GlassButton";
import { List, Row, Section } from "../../ui/List";
import { DateRow, MenuPickerRow, TimeRow } from "../../ui/Pickers";
import { SheetBody, SheetNav, useDismiss } from "../../ui/Sheet";
import { ToggleRow } from "../../ui/Toggle";
import { finalizeNotes, NotesSection, type DraftNote } from "../NotesSection";
import { ReminderSection } from "../ReminderEditor";
import { subjectOptions, useSubjects } from "../useSubjects";

/// Add or edit an exam. Presented as a sheet.
export function ExamForm({ exam }: { exam?: Exam }) {
  const dismiss = useDismiss();
  const subjects = useSubjects();

  const [title, setTitle] = useState(exam?.title ?? "");
  const [notes, setNotes] = useState<DraftNote[]>(exam?.notes ?? []);
  const [images, setImages] = useState<DraftImage[]>(exam?.images ?? []);
  const [date, setDate] = useState(() => (exam ? new Date(exam.date) : defaultExamDate()));
  const [hasTime, setHasTime] = useState(exam?.hasTime ?? false);
  const [subjectId, setSubjectId] = useState(exam?.subjectId ?? "");
  const [reminders, setReminders] = useState<Reminder[]>(exam?.reminders ?? []);

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
          <Section header="Exam">
            <Row>
              <input
                className="field"
                placeholder="Title (optional)"
                value={title}
                dir="auto"
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
