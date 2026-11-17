import { useEffect, useState } from "react";
import { db, imageKey, type ImageAttachment } from "../db";

/// An image in a form, held until Save. `blob` is set for images picked since
/// the form opened; ones already saved are read back from `files` on demand.
export interface DraftImage extends ImageAttachment {
  blob?: Blob;
}

/// Opens the system picker for images. On iPhone this offers the photo
/// library, the camera and Files.
export function pickImageFiles(onPick: (files: File[]) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/*";
  input.multiple = true;
  input.onchange = () => {
    const files = Array.from(input.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) onPick(files);
  };
  input.click();
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
  return drafts.map(({ id, name, createdAt }) => ({ id, name, createdAt }));
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
