import { useEffect, useState } from "react";
import { newId } from "./id";
import { db, imageKey, type ImageAttachment } from "../db";
import { readTextFile } from "./files";

const pdfType = "application/pdf";

/// An image or PDF in a form, held until Save. `blob` is set for images picked since
/// the form opened; ones already saved are read back from `files` on demand.
export interface DraftImage extends ImageAttachment {
  blob?: Blob;
}

/// Opens the system file picker. `capture` goes straight to the rear camera
/// on phones; desktop browsers ignore it and show an ordinary picker.
export function pickFiles(
  { accept, multiple = true, capture }: { accept: string; multiple?: boolean; capture?: boolean },
  onPick: (files: File[]) => void,
) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.multiple = multiple;
  if (capture) input.setAttribute("capture", "environment");
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length > 0) onPick(files);
  };
  input.click();
}

/// Everything the Add menu's "Choose File…" accepts: images and PDFs become
/// attachments, Markdown and plain text become notes.
export const attachableTypes = "image/*,.pdf,application/pdf,.md,.markdown,.txt,text/markdown,text/plain";
export const imageTypes = "image/*";

export const isPdfFile = (file: File) => file.type === pdfType || file.name.toLowerCase().endsWith(".pdf");
const isTextFile = (file: File) =>
  /\.(md|markdown|txt)$/i.test(file.name) || file.type === "text/markdown" || file.type === "text/plain";

/// Where a batch of files came from, which decides what to call the ones
/// that arrive without a real name.
export type FileSource = "files" | "camera" | "library" | "paste";

/// "Photo – Nov 18". Browsers hand camera shots, library photos and pasted
/// images over as "image.jpg", which says nothing in a list.
export function datedName(prefix: string, date = new Date()): string {
  return `${prefix} – ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/// Adds " (2)", " (3)"… until `name` isn't already taken.
export function uniqueName(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(name)) return name;
  let n = 2;
  while (used.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

const genericName = /^(image|photo|img)\.[a-z0-9]+$/i;

function nameFor(file: File, source: FileSource): string {
  if (file.name && !genericName.test(file.name)) return file.name;
  return datedName(source === "paste" ? "Pasted Image" : "Photo");
}

/// A note's text from an imported file, with the filename as its heading
/// when the file doesn't start with one.
export function noteFromText(contents: string, filename: string): string {
  if (contents.trim().startsWith("#")) return contents;
  return `# ${filename.replace(/\.[^.]+$/, "")}\n\n${contents}`;
}

export interface SortedFiles {
  images: DraftImage[];
  /// Text for new notes, from .md and .txt files.
  notes: string[];
  /// Files that couldn't be added, each with the reason.
  skipped: string[];
}

/// The one way files get in, whether they were picked, dropped or pasted:
/// each is sorted into an image, a PDF or a note. `taken` is the names already
/// in the list, so new ones get a number instead of repeating one.
export async function sortFiles(files: File[], source: FileSource, taken: string[] = []): Promise<SortedFiles> {
  const result: SortedFiles = { images: [], notes: [], skipped: [] };
  const names = [...taken];
  for (const file of files) {
    const label = file.name || "A pasted item";
    if (file.type.startsWith("image/")) {
      const name = uniqueName(nameFor(file, source), names);
      names.push(name);
      result.images.push({ ...draftFromFile(file, "image"), name });
    } else if (isPdfFile(file)) {
      const name = uniqueName(file.name || datedName("Document"), names);
      names.push(name);
      result.images.push({ ...draftFromFile(file, "pdf"), name });
    } else if (isTextFile(file)) {
      try {
        const contents = await readTextFile(file);
        if (contents.trim() === "") result.skipped.push(`${label} is empty.`);
        else result.notes.push(noteFromText(contents, file.name));
      } catch {
        result.skipped.push(`${label} couldn’t be read as text.`);
      }
    } else {
      result.skipped.push(`${label} isn’t an image, PDF or text file.`);
    }
  }
  return result;
}

/// A draft for a file just picked. PDFs are stored with their type set even
/// when the browser didn't report one, so they open as PDFs later.
export function draftFromFile(file: File, kind: "image" | "pdf"): DraftImage {
  const type = kind === "pdf" ? pdfType : file.type;
  const blob = kind === "pdf" && file.type !== pdfType ? new Blob([file], { type: pdfType }) : file;
  return { id: newId(), name: file.name, createdAt: Date.now(), type, blob };
}

/// Writes newly picked images to `files` and deletes the ones that were
/// removed. Returns the descriptions to store on the record. The bytes go in
/// as-is, so a PNG stays a PNG.
export async function commitImages(
  drafts: DraftImage[],
  saved: ImageAttachment[] = [],
): Promise<ImageAttachment[]> {
  const keep = new Set(drafts.map((image) => image.id));
  await db.files.bulkPut(
    drafts.flatMap((image) => (image.blob ? [{ key: imageKey(image.id), blob: image.blob }] : [])),
  );
  await db.files.bulkDelete(saved.filter((image) => !keep.has(image.id)).map((image) => imageKey(image.id)));
  return drafts.map(({ id, name, createdAt, type }) => (type ? { id, name, createdAt, type } : { id, name, createdAt }));
}

/// An object URL for an image, whether it's still a draft or already saved.
/// Null while loading, or if the file has gone missing.
export function useImageURL(image: DraftImage): string | null {
  const [url, setURL] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    const show = (blob: Blob | undefined) => {
      if (cancelled || !blob) return;
      created = URL.createObjectURL(blob);
      setURL(created);
    };

    if (image.blob) show(image.blob);
    else void db.files.get(imageKey(image.id)).then((record) => show(record?.blob));

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
      setURL(null);
    };
  }, [image.id, image.blob]);

  return url;
}
