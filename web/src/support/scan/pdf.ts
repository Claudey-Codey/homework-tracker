/// A minimal PDF writer: one JPEG per page, nothing else. PDF can hold JPEG
/// data as it is (the DCTDecode filter), so pages aren't re-encoded and the
/// file is barely bigger than the images in it.

export interface PdfPage {
  jpeg: Uint8Array;
  width: number;
  height: number;
}

/// Pages are A4 wide (595 points) and as tall as the scan's shape needs.
const pageWidth = 595;

export function pdfFromJpegs(pages: PdfPage[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  /// Objects are numbered from 1 in the order they're written.
  const object = (body: () => void) => {
    offsets.push(length);
    write(`${offsets.length} 0 obj\n`);
    body();
    write("\nendobj\n");
  };

  // Each page takes three objects (page, drawing instructions, image) after
  // the catalog (1) and the page tree (2).
  const pageObject = (index: number) => 3 + index * 3;

  write("%PDF-1.4\n%âãÏÓ\n");
  object(() => write("<< /Type /Catalog /Pages 2 0 R >>"));
  object(() =>
    write(
      `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageObject(i)} 0 R`).join(" ")}] >>`,
    ),
  );

  pages.forEach((page, i) => {
    const w = pageWidth;
    const h = Math.round((pageWidth * page.height) / page.width);
    const drawing = `q ${w} 0 0 ${h} 0 0 cm /Scan Do Q`;
    object(() =>
      write(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
          `/Resources << /XObject << /Scan ${pageObject(i) + 2} 0 R >> >> /Contents ${pageObject(i) + 1} 0 R >>`,
      ),
    );
    object(() => write(`<< /Length ${drawing.length} >>\nstream\n${drawing}\nendstream`));
    object(() => {
      write(
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      );
      write(page.jpeg);
      write("\nendstream");
    });
  });

  const xref = length;
  write(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) write(`${String(offset).padStart(10, "0")} 00000 n \n`);
  write(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
