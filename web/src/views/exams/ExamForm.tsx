import { lazy, Suspense, useState } from "react";
import { db, type Exam, type Reminder, type StudyNote } from "../../db";
import { defaultExamDate, endOfDay } from "../../support/dates";
import { pickTextFile, readTextFile } from "../../support/files";
import { newId } from "../../support/id";
import { notePreview, noteTitle } from "../../support/noteText";
import { Alert } from "../../ui/Alert";
import { GlassButton } from "../../ui/GlassButton";
import { ComposeIcon, ImportIcon, TrashIcon } from "../../ui/icons";
import { ButtonRow, List, Row, Section } from "../../ui/List";
import { DateRow, MenuPickerRow, TimeRow } from "../../ui/Pickers";
import { Sheet, SheetBody, SheetNav, useDismiss } from "../../ui/Sheet";
import { SwipeRow } from "../../ui/SwipeRow";
import { ToggleRow } from "../../ui/Toggle";
import { ReminderSection } from "../ReminderEditor";
import { subjectOptions, useSubjects } from "../useSubjects";

/// The editor pulls in a whole rich-text engine, so it's only downloaded the
/// first time a note is opened.
const StudyNoteEditor = lazy(() =>
  import("./StudyNoteEditor").then((module) => ({ default: module.StudyNoteEditor })),
);

/// In-progress study note, held until Save.
interface DraftNote {
  id: string;
  text: string;
  createdAt: number;
}

const isBlank = (text: string) => text.trim() === "";

/// Add or edit an exam. Presented as a sheet.
export function ExamForm({ exam }: { exam?: Exam }) {
  const dismiss = useDismiss();
  const subjects = useSubjects();

  const [title, setTitle] = useState(exam?.title ?? "");
  const [notes, setNotes] = useState<DraftNote[]>(exam?.notes ?? []);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [date, setDate] = useState(() => (exam ? new Date(exam.date) : defaultExamDate()));
  const [hasTime, setHasTime] = useState(exam?.hasTime ?? false);
  const [subjectId, setSubjectId] = useState(exam?.subjectId ?? "");
  const [reminders, setReminders] = useState<Reminder[]>(exam?.reminders ?? []);

  const canSave = subjectId !== "" || title.trim() !== "";

  const addNote = () => {
    const note: DraftNote = { id: newId(), text: "", createdAt: Date.now() };
    setNotes((current) => [...current, note]);
    setEditingNote(note.id);
  };

  /// Importing straight into a new note, so you don't have to create an
  /// empty one first.
  const importNote = () =>
    pickTextFile(async (file) => {
      try {
        const contents = await readTextFile(file);
        if (isBlank(contents)) {
          setImportError("That file is empty.");
          return;
        }
        // Fall back to the filename as a heading if the file has no title.
        const hasHeading = contents.trim().startsWith("#");
        const name = file.name.replace(/\.[^.]+$/, "");
        const text = hasHeading ? contents : `# ${name}\n\n${contents}`;
        setNotes((current) => [...current, { id: newId(), text, createdAt: Date.now() }]);
      } catch {
        setImportError("That file couldn't be read as text.");
      }
    });

  /// Closing the editor on an untouched note discards it, so tapping
  /// "Add Note" and backing out doesn't leave an empty row behind.
  const closeEditor = () => {
    setEditingNote(null);
    setNotes((current) => current.filter((note) => !isBlank(note.text)));
  };

  const save = async () => {
    const savedNotes = new Map((exam?.notes ?? []).map((note) => [note.id, note]));
    const now = Date.now();
    const finalNotes: StudyNote[] = notes
      .map((note) => ({ ...note, text: note.text.trim() }))
      .filter((note) => note.text !== "")
      .map((note) => {
        const saved = savedNotes.get(note.id);
        return {
          id: note.id,
          text: note.text,
          createdAt: note.createdAt,
          updatedAt: saved && saved.text === note.text ? saved.updatedAt : now,
        };
      });

    await db.exams.put({
      id: exam?.id ?? newId(),
      title: title.trim(),
      date: (hasTime ? date : endOfDay(date)).getTime(),
      hasTime,
      subjectId: subjectId || null,
      notes: finalNotes,
      reminders,
      createdAt: exam?.createdAt ?? now,
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

          <Section
            header="Study material"
            footer={
              notes.length === 0
                ? "Add as many notes as you like — one per topic, chapter, or worksheet."
                : "Tap a note to edit it, swipe to delete."
            }
          >
            {notes.map((note) => (
              <SwipeRow
                key={note.id}
                onClick={() => setEditingNote(note.id)}
                trailing={[
                  {
                    label: "Delete",
                    icon: <TrashIcon size={20} />,
                    color: "var(--red)",
                    onAction: () => setNotes((current) => current.filter((n) => n.id !== note.id)),
                  },
                ]}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "9px 0", minWidth: 0 }}>
                  <span className="line-clamp-1" dir="auto">{noteTitle(note.text)}</span>
                  <span className="caption secondary line-clamp-1" dir="auto">
                    {notePreview(note.text)}
                  </span>
                </div>
              </SwipeRow>
            ))}
            <ButtonRow icon={<ComposeIcon size={20} />} label="Add Note" onClick={addNote} />
            <ButtonRow icon={<ImportIcon size={20} />} label="Import .md File…" onClick={importNote} />
          </Section>

          <ReminderSection reminders={reminders} onChange={setReminders} />
        </List>
      </SheetBody>

      <Sheet item={editingNote} onClose={closeEditor} plain>
        {(id) => (
          <Suspense fallback={null}>
            <StudyNoteEditor
              text={notes.find((note) => note.id === id)?.text ?? ""}
              onChange={(text) =>
                setNotes((current) => current.map((note) => (note.id === id ? { ...note, text } : note)))
              }
            />
          </Suspense>
        )}
      </Sheet>

      <Alert title="Couldn't Import File" message={importError} onClose={() => setImportError(null)} />
    </>
  );
}
