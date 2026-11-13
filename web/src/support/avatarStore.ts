import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

/// Reads and writes the custom profile photo. It lives in IndexedDB as a Blob
/// (localStorage is the wrong place for images), and `useAvatarPhoto` hands
/// out an object URL that follows it.

const photoKey = "avatarPhoto";

/// Longest edge of the stored image. A profile photo is never shown larger
/// than ~96px, so anything beyond this is wasted space.
const maxDimension = 512;

/// Downscales and stores the picked file. Returns false if it wasn't an
/// image the browser could decode.
export async function saveAvatarPhoto(file: Blob): Promise<boolean> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return false;
  }
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!jpeg) return false;
  await db.files.put({ key: photoKey, blob: jpeg });
  return true;
}

export async function removeAvatarPhoto() {
  await db.files.delete(photoKey);
}

/// An object URL for the stored photo, or null when there isn't one.
export function useAvatarPhoto(): string | null {
  const record = useLiveQuery(() => db.files.get(photoKey), []);
  const [url, setURL] = useState<string | null>(null);

  useEffect(() => {
    if (!record) {
      setURL(null);
      return;
    }
    const next = URL.createObjectURL(record.blob);
    setURL(next);
    return () => URL.revokeObjectURL(next);
  }, [record]);

  return url;
}
