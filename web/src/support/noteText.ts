/// Splitting a note's raw text into a title line and a preview line.
const lines = (text: string) => text.split("\n").filter((line) => line.length > 0);

export function noteTitle(text: string): string {
  const stripped = stripMarkdown((lines(text)[0] ?? "").trim());
  return stripped === "" ? "New Note" : stripped;
}

export function notePreview(text: string): string {
  const rest = lines(text)
    .slice(1)
    .map(stripMarkdown)
    .filter((line) => line !== "")
    .join(" ");
  return rest === "" ? "No additional text" : rest;
}

/// Titles and previews are shown as plain text, so drop the syntax that
/// would otherwise leak into the list (`# Chapter 3` reads as "Chapter 3").
export function stripMarkdown(line: string): string {
  let text = line.trim();
  while (text.startsWith("#")) text = text.slice(1);
  text = text.trim();
  for (const marker of ["- ", "* ", "+ ", "> "]) {
    if (text.startsWith(marker)) text = text.slice(marker.length);
  }
  for (const syntax of ["**", "__", "`", "~~"]) {
    text = text.split(syntax).join("");
  }
  // The editor escapes Markdown characters typed as plain text ("1\. ").
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1");
  return text.trim();
}

/// Note titles are free text, so strip anything a filesystem would object to.
export function safeFilename(raw: string): string {
  const cleaned = raw.split(/[/\\:?%*|"<>]/).join("-").trim();
  return cleaned === "" ? "Note" : cleaned.slice(0, 60);
}
