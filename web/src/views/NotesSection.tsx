import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { isPdf, type StudyNote } from "../db";
import { newId } from "../support/id";
import {
  attachableTypes,
  datedName,
  draftFromFile,
  imageTypes,
  pickFiles,
  sortFiles,
  uniqueName,
  useImageURL,
  type DraftImage,
  type FileSource,
} from "../support/images";
import { notePreview, noteTitle } from "../support/noteText";
import { Alert, Prompt } from "../ui/Alert";
import { GlassButton } from "../ui/GlassButton";
import {
  AddCircleIcon,
  CameraIcon,
  ComposeIcon,
  FolderIcon,
  PdfIcon,
  PencilIcon,
  PhotoIcon,
  ReorderIcon,
  ScanIcon,
  ShareIcon,
  TrashIcon,
  UploadIcon,
} from "../ui/icons";
import { Section } from "../ui/List";
import { Sheet, SheetBody, SheetNav, useDismiss } from "../ui/Sheet";
import { SwipeRow } from "../ui/SwipeRow";

/// The editor pulls in a whole rich-text engine, so it's only downloaded the
/// first time a note is opened.
const StudyNoteEditor = lazy(() =>
  import("./exams/StudyNoteEditor").then((module) => ({ default: module.StudyNoteEditor })),
);

/// The scanner is only downloaded the first time it's opened, too.
const DocumentScanner = lazy(() =>
  import("./scanner/DocumentScanner").then((module) => ({ default: module.DocumentScanner })),
);

/// In-progress note, held by a form until Save.
export interface DraftNote {
  id: string;
  text: string;
  createdAt: number;
}

const isBlank = (text: string) => text.trim() === "";

/// Phones get the camera and photo library in the Add menu; with a mouse
/// those are just a file picker, so it offers "Choose File…" alone.
const isTouch = () => window.matchMedia?.("(pointer: coarse)").matches ?? false;

/// Pastes and drops into a text field or the note editor belong to that field.
const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest("input, textarea, [contenteditable='true']");

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

/// Markdown notes and attached images and PDFs — the exam's study material and
/// an assignment's content. One "Add…" row opens a menu for every source, and
/// files can also be dropped onto the page or pasted. Tapping a note opens the
/// editor; tapping an image or PDF shows it full size.
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
  const [renaming, setRenaming] = useState<DraftImage | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [scanning, setScanning] = useState(false);
  const addRow = useRef<HTMLButtonElement>(null);
  const grips = useRef(new Map<string, HTMLElement>());

  // Read from window listeners, which outlive the render they were set up in.
  const latest = useRef({ images, busy: false });
  latest.current = { images, busy: editingNote !== null || viewingImage !== null || renaming !== null || scanning };

  /// Every way of adding files ends here: they're sorted into images, PDFs
  /// and notes, and anything that couldn't be added is listed in one alert.
  const addFiles = async (files: File[], source: FileSource) => {
    const taken = latest.current.images.map((image) => image.name);
    const sorted = await sortFiles(files, source, taken);
    if (sorted.images.length > 0) onImagesChange((current) => [...current, ...sorted.images]);
    if (sorted.notes.length > 0) {
      const now = Date.now();
      onChange((current) => [...current, ...sorted.notes.map((text) => ({ id: newId(), text, createdAt: now }))]);
    }
    if (sorted.skipped.length > 0) setImportError(sorted.skipped.join("\n"));
  };
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

  // Drop files anywhere on the form, or paste a screenshot.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const accepts = (event: DragEvent) => hasFiles(event) && !latest.current.busy && !isEditable(event.target);

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event) || latest.current.busy) return;
      depth++;
      setDropping(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!accepts(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDropping(false);
    };
    const onDrop = (event: DragEvent) => {
      depth = 0;
      setDropping(false);
      if (!accepts(event)) return;
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) void addFilesRef.current(files, "files");
    };
    const onPaste = (event: ClipboardEvent) => {
      if (latest.current.busy || isEditable(event.target)) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      void addFilesRef.current(files, "paste");
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, []);

  const addNote = () => {
    const note: DraftNote = { id: newId(), text: "", createdAt: Date.now() };
    onChange((current) => [...current, note]);
    setEditingNote(note.id);
  };

  /// Closing the editor on an untouched note discards it, so tapping
  /// "New Note" and backing out doesn't leave an empty row behind.
  const closeEditor = () => {
    setEditingNote(null);
    onChange((current) => current.filter((note) => !isBlank(note.text)));
  };

  /// A finished scan becomes one PDF, "Scan – Nov 18.pdf".
  const addScan = (pdf: Blob) => {
    const taken = latest.current.images.map((image) => image.name);
    const base = uniqueName(datedName("Scan"), taken.map((name) => name.replace(/\.pdf$/i, "")));
    const file = new File([pdf], `${base}.pdf`, { type: "application/pdf" });
    onImagesChange((current) => [...current, draftFromFile(file, "pdf")]);
  };

  const move = (id: string, to: number) => {
    const current = latest.current.images;
    const from = current.findIndex((image) => image.id === id);
    const target = Math.max(0, Math.min(current.length - 1, to));
    if (from < 0 || from === target) return;
    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(target, 0, item);
    latest.current.images = next;
    onImagesChange(next);
  };

  /// Drag the ≡ handle up or down. The row follows the pointer one slot at a
  /// time, as soon as the pointer passes the middle of its neighbour.
  const startReorder = (id: string, event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    // Keep the row's own swipe gesture from starting.
    event.stopPropagation();
    event.preventDefault();
    setDragging(id);

    // The new slot is the number of other rows whose middle is above the
    // pointer. It doesn't depend on where the dragged row currently sits, so
    // a move that hasn't reached the screen yet can't make it jump back.
    const onMove = (e: PointerEvent) => {
      let to = 0;
      for (const image of latest.current.images) {
        const row = image.id === id ? null : grips.current.get(image.id)?.closest(".cell");
        if (!row) continue;
        const rect = row.getBoundingClientRect();
        if (rect.top + rect.height / 2 < e.clientY) to++;
      }
      move(id, to);
    };
    const onEnd = () => {
      setDragging(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

  /// The handle is a button, so the arrow keys reorder too.
  const reorderWithKeys = (id: string, event: ReactKeyboardEvent) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const index = latest.current.images.findIndex((image) => image.id === id);
    move(id, index + (event.key === "ArrowUp" ? -1 : 1));
    requestAnimationFrame(() => grips.current.get(id)?.focus());
  };

  const touch = isTouch();
  const menuItems: MenuEntry[] = [
    { label: "New Note", icon: <ComposeIcon size={20} />, onSelect: addNote },
    "divider",
    {
      label: "Scan Document",
      detail: "Saves as one PDF",
      icon: <ScanIcon size={20} />,
      onSelect: () => setScanning(true),
    },
    ...(touch
      ? ([
          {
            label: "Take Photo",
            icon: <CameraIcon size={20} />,
            onSelect: () => pickFiles({ accept: imageTypes, multiple: false, capture: true }, (f) => addFiles(f, "camera")),
          },
          {
            label: "Photo Library",
            icon: <PhotoIcon size={20} />,
            onSelect: () => pickFiles({ accept: imageTypes }, (f) => addFiles(f, "library")),
          },
        ] satisfies MenuEntry[])
      : []),
    {
      label: "Choose File…",
      detail: "Images, PDFs, or .md and .txt notes",
      icon: <FolderIcon size={20} />,
      onSelect: () => pickFiles({ accept: attachableTypes }, (f) => addFiles(f, "files")),
    },
  ];

  const empty = notes.length === 0 && images.length === 0;
  const footer = empty
    ? emptyFooter
    : images.length > 1
      ? "Tap to open. Swipe to rename or delete, drag ≡ to reorder."
      : "Tap to open. Swipe to rename or delete.";

  return (
    <>
      <Section header={header} footer={touch ? footer : `${footer} You can also drop or paste files here.`}>
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
            className={dragging === image.id ? "reordering" : ""}
            onClick={() => setViewingImage(image)}
            trailing={[
              {
                label: "Delete",
                icon: <TrashIcon size={20} />,
                color: "var(--red)",
                onAction: () => onImagesChange((current) => current.filter((i) => i.id !== image.id)),
              },
              {
                label: "Rename",
                icon: <PencilIcon size={20} />,
                color: "var(--orange)",
                onAction: () => setRenaming(image),
              },
            ]}
          >
            {isPdf(image) ? <PdfThumbnail /> : <ImageThumbnail image={image} />}
            <span className="line-clamp-1" dir="auto" style={{ minWidth: 0, flex: 1 }}>{image.name}</span>
            {images.length > 1 && (
              <button
                type="button"
                className="reorder-handle"
                aria-label={`Move ${image.name}. Use the up and down arrow keys.`}
                ref={(el) => {
                  if (el) grips.current.set(image.id, el);
                  else grips.current.delete(image.id);
                }}
                onPointerDown={(event) => startReorder(image.id, event)}
                onKeyDown={(event) => reorderWithKeys(image.id, event)}
                onClick={(event) => event.stopPropagation()}
              >
                <ReorderIcon size={20} />
              </button>
            )}
          </SwipeRow>
        ))}
        <button
          ref={addRow}
          type="button"
          className="cell tappable accent"
          aria-haspopup="menu"
          aria-expanded={menuAnchor !== null}
          onClick={() => setMenuAnchor(addRow.current?.getBoundingClientRect() ?? null)}
        >
          <span style={{ display: "flex" }}>
            <AddCircleIcon size={20} />
          </span>
          <span className="cell-label">Add…</span>
        </button>
      </Section>

      <AnchoredMenu anchor={menuAnchor} items={menuItems} onClose={() => setMenuAnchor(null)} />

      {dropping &&
        createPortal(
          <div className="drop-overlay" aria-hidden="true">
            <div>
              <UploadIcon size={40} />
              <strong>Drop to attach</strong>
              <span>Images and PDFs are attached. .md and .txt files become notes.</span>
            </div>
          </div>,
          document.body,
        )}

      <Sheet item={viewingImage} onClose={() => setViewingImage(null)} plain>
        {(image) => (isPdf(image) ? <PdfViewer pdf={image} /> : <ImageViewer image={image} />)}
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

      {scanning && (
        <Suspense fallback={null}>
          <DocumentScanner onSave={addScan} onClose={() => setScanning(false)} />
        </Suspense>
      )}

      <Prompt
        title="Rename"
        initialValue={renaming?.name ?? null}
        onClose={() => setRenaming(null)}
        onSave={(name) =>
          onImagesChange((current) => current.map((image) => (image.id === renaming?.id ? { ...image, name } : image)))
        }
      />

      <Alert title="Couldn’t Add Everything" message={importError} onClose={() => setImportError(null)} />
    </>
  );
}

type MenuEntry =
  | "divider"
  | { label: string; detail?: string; icon: ReactNode; onSelect: () => void };

/// A `Menu` that opens from a list row rather than a toolbar button: below the
/// row when it fits, above it when the row is near the bottom of the screen.
function AnchoredMenu({
  anchor,
  items,
  onClose,
}: {
  anchor: DOMRect | null;
  items: MenuEntry[];
  onClose: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useEffect(() => {
    if (!anchor || !menu.current) return;
    const height = menu.current.offsetHeight;
    const left = Math.min(anchor.left + 16, window.innerWidth - menu.current.offsetWidth - 12);
    const below = anchor.bottom + 6;
    const fitsBelow = below + height < window.innerHeight - 16;
    setStyle({
      position: "fixed",
      left: Math.max(12, left),
      top: fitsBelow ? below : Math.max(12, anchor.top - height - 6),
      transformOrigin: fitsBelow ? "top left" : "bottom left",
    });
    menu.current.querySelector("button")?.focus({ preventScroll: true });
  }, [anchor]);

  if (!anchor) return null;
  return createPortal(
    <>
      <div className="menu-scrim" onClick={onClose} />
      <div
        ref={menu}
        className="menu glass"
        role="menu"
        style={style}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        {items.map((item, index) =>
          item === "divider" ? (
            <div key={`divider-${index}`} className="menu-divider" role="separator" />
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              <span className="menu-item-text">
                <span>{item.label}</span>
                {item.detail && <span className="menu-item-detail">{item.detail}</span>}
              </span>
              {item.icon}
            </button>
          ),
        )}
      </div>
    </>,
    document.body,
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

function PdfThumbnail() {
  return (
    <span className="image-thumbnail pdf-thumbnail">
      <PdfIcon size={22} />
    </span>
  );
}

/// Hands the PDF to the share sheet where there is one, so on iPhone it can be
/// opened in Books or saved to Files; elsewhere it opens in a new tab.
async function sharePdf(pdf: DraftImage, url: string) {
  const blob: Blob = pdf.blob ? pdf.blob : await (await fetch(url)).blob();
  const file = new File([blob], pdf.name, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
    }
  }
  window.open(url, "_blank", "noopener");
}

/// The browser's own PDF viewer, filling the sheet.
function PdfViewer({ pdf }: { pdf: DraftImage }) {
  const dismiss = useDismiss();
  const url = useImageURL(pdf);
  return (
    <>
      <SheetNav
        title={<span className="line-clamp-1" dir="auto">{pdf.name}</span>}
        leading={
          url && (
            <GlassButton onClick={() => void sharePdf(pdf, url)} label="Share">
              <ShareIcon size={20} />
            </GlassButton>
          )
        }
        trailing={
          <GlassButton prominent onClick={dismiss}>
            Done
          </GlassButton>
        }
      />
      <SheetBody>
        <div className="pdf-viewer">{url && <iframe src={url} title={pdf.name} />}</div>
      </SheetBody>
    </>
  );
}
