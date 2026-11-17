/// Reads a text file the user picked. Rejects anything that isn't UTF-8 text.
export async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}

/// Opens the system file picker for Markdown or plain text.
export function pickTextFile(onPick: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".md,.markdown,.txt,text/markdown,text/plain";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onPick(file);
  };
  input.click();
}

/// Hands a `.md` file to the share sheet where there is one (iOS, Android),
/// and downloads it everywhere else.
export async function exportMarkdown(filename: string, text: string) {
  const file = new File([text], `${filename}.md`, { type: "text/markdown" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
