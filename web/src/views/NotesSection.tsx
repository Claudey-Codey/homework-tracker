import { lazy, Suspense, useState, type Dispatch, type SetStateAction } from "react";
import type { StudyNote } from "../db";
import { pickTextFile, readTextFile } from "../support/files";
import { newId } from "../support/id";
import { pickImageFiles, useImageURL, type DraftImage } from "../support/images";
import { notePreview, noteTitle } from "../support/noteText";
import { Alert } from "../ui/Alert";
import { GlassButton } from "../ui/GlassButton";
import { ComposeIcon, ImportIcon, PhotoIcon, TrashIcon } from "../ui/icons";
import { ButtonRow, Section } from "../ui/List";
import { Sheet, SheetBody, SheetNav, useDismiss } from "../ui/Sheet";
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

/// Markdown notes and attached images, with Add and Import buttons — the
/// exam's study material and an assignment's content. Tapping a note opens
/// the editor; tapping an image shows it full size.
export function NotesSection({
  header,
  emptyFooter,
  notes,
  onChange,
  images,
  onImagesChange,
}: {
  header: string;
  /// Shown under the section while it has nothing in it yet.
  emptyFooter: string;
  notes: DraftNote[];
  onChange: Dispatch<SetStateAction<DraftNote[]>>;
  images: DraftImage[];
  onImagesChange: Dispatch<SetStateAction<DraftImage[]>>;
}) {
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<DraftImage | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const addImages = () =>
    pickImageFiles((files) =>
      onImagesChange((current) => [
        ...current,
        ...files.map((file) => ({ id: newId(), name: file.name, createdAt: Date.now(), blob: file })),
      ]),
    );

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
        footer={
          notes.length === 0 && images.length === 0
            ? emptyFooter
            : "Tap a note or image to open it, swipe to delete."
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
        {images.map((image) => (
          <SwipeRow
            key={image.id}
            onClick={() => setViewingImage(image)}
            trailing={[
              {
                label: "Delete",
                icon: <TrashIcon size={20} />,
                color: "var(--red)",
                onAction: () => onImagesChange((current) => current.filter((i) => i.id !== image.id)),
              },
            ]}
          >
            <ImageThumbnail image={image} />
            <span className="line-clamp-1" dir="auto" style={{ minWidth: 0 }}>{image.name}</span>
          </SwipeRow>
        ))}
        <ButtonRow icon={<ComposeIcon size={20} />} label="Add Note" onClick={addNote} />
        <ButtonRow icon={<PhotoIcon size={20} />} label="Add Image…" onClick={addImages} />
        <ButtonRow icon={<ImportIcon size={20} />} label="Import .md File…" onClick={importNote} />
      </Section>

      <Sheet item={viewingImage} onClose={() => setViewingImage(null)} plain>
        {(image) => <ImageViewer image={image} />}
      </Sheet>

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

function ImageThumbnail({ image }: { image: DraftImage }) {
  const url = useImageURL(image);
  return (
    <span className="image-thumbnail">
      {url && <img src={url} alt="" />}
    </span>
  );
}

function ImageViewer({ image }: { image: DraftImage }) {
  const dismiss = useDismiss();
  const url = useImageURL(image);
  return (
    <>
      <SheetNav
        title={<span className="line-clamp-1" dir="auto">{image.name}</span>}
        trailing={
          <GlassButton prominent onClick={dismiss}>
            Done
          </GlassButton>
        }
      />
      <SheetBody>
        <div className="image-viewer">{url && <img src={url} alt={image.name} />}</div>
      </SheetBody>
    </>
  );
}
