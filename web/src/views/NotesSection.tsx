import { lazy, Suspense, useState, type Dispatch, type SetStateAction } from "react";
import type { StudyNote } from "../db";
import { pickTextFile, readTextFile } from "../support/files";
import { newId } from "../support/id";
import { notePreview, noteTitle } from "../support/noteText";
import { Alert } from "../ui/Alert";
import { ComposeIcon, ImportIcon, TrashIcon } from "../ui/icons";
import { ButtonRow, Section } from "../ui/List";
import { Sheet } from "../ui/Sheet";
import { SwipeRow } from "../ui/SwipeRow";

/// The editor pulls in a whole rich-text engine, so it's only downloaded the
/// first time a note is opened.
const StudyNoteEditor = lazy(() =>
  import("./exams/StudyNoteEditor").then((module) => ({ default: module.StudyNoteEditor })),
);

/// In-progress note, held by a form until Save.
export interface DraftNote {
  id: string;
  text: string;
  createdAt: number;
}

const isBlank = (text: string) => text.trim() === "";

/// Turns a form's drafts into notes ready to store: blanks dropped, text
/// trimmed, and `updatedAt` only moved for notes whose text actually changed.
export function finalizeNotes(drafts: DraftNote[], saved: StudyNote[] = []): StudyNote[] {
  const savedById = new Map(saved.map((note) => [note.id, note]));
  const now = Date.now();
  return drafts
    .map((note) => ({ ...note, text: note.text.trim() }))
    .filter((note) => note.text !== "")
    .map((note) => {
      const previous = savedById.get(note.id);
      return {
        id: note.id,
        text: note.text,
        createdAt: note.createdAt,
        updatedAt: previous && previous.text === note.text ? previous.updatedAt : now,
      };
    });
}

/// A list of Markdown notes with Add and Import buttons — the exam's study
/// material and an assignment's content. Tapping a note opens the editor.
export function NotesSection({
  header,
  emptyFooter,
  notes,
  onChange,
}: {
  header: string;
  /// Shown under the section while it has no notes yet.
  emptyFooter: string;
  notes: DraftNote[];
  onChange: Dispatch<SetStateAction<DraftNote[]>>;
}) {
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const addNote = () => {
    const note: DraftNote = { id: newId(), text: "", createdAt: Date.now() };
    onChange((current) => [...current, note]);
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
        onChange((current) => [...current, { id: newId(), text, createdAt: Date.now() }]);
      } catch {
        setImportError("That file couldn't be read as text.");
      }
    });

  /// Closing the editor on an untouched note discards it, so tapping
  /// "Add Note" and backing out doesn't leave an empty row behind.
  const closeEditor = () => {
    setEditingNote(null);
    onChange((current) => current.filter((note) => !isBlank(note.text)));
  };

  return (
    <>
      <Section
        header={header}
        footer={notes.length === 0 ? emptyFooter : "Tap a note to edit it, swipe to delete."}
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
                onAction: () => onChange((current) => current.filter((n) => n.id !== note.id)),
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

      <Sheet item={editingNote} onClose={closeEditor} plain>
        {(id) => (
          <Suspense fallback={null}>
            <StudyNoteEditor
              text={notes.find((note) => note.id === id)?.text ?? ""}
              onChange={(text) =>
                onChange((current) => current.map((note) => (note.id === id ? { ...note, text } : note)))
              }
            />
          </Suspense>
        )}
      </Sheet>

      <Alert title="Couldn't Import File" message={importError} onClose={() => setImportError(null)} />
    </>
  );
}
