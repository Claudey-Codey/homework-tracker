import { Extension, EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import { Markdown } from "tiptap-markdown";
import { exportMarkdown, pickTextFile, readTextFile } from "../../support/files";
import { noteTitle, safeFilename } from "../../support/noteText";
import { Alert } from "../../ui/Alert";
import { GlassButton } from "../../ui/GlassButton";
import {
  BoldIcon,
  BulletListIcon,
  CodeIcon,
  EllipsisCircleIcon,
  HeadingIcon,
  ImportIcon,
  ItalicIcon,
  NumberedListIcon,
  QuoteIcon,
  ShareIcon,
  TitleIcon,
} from "../../ui/icons";
import { Menu } from "../../ui/Menu";
import { SheetNav, useDismiss } from "../../ui/Sheet";

/// Every paragraph picks its own direction from its first letter, so Hebrew
/// lines sit on the right and English ones on the left — the web version of
/// the iOS editor's `.natural` alignment.
const AutoDirection = Extension.create({
  name: "autoDirection",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockquote", "bulletList", "orderedList"],
        attributes: {
          dir: {
            default: "auto",
            parseHTML: () => "auto",
            renderHTML: () => ({ dir: "auto" }),
          },
        },
      },
    ];
  },
});

function markdownOf(editor: Editor): string {
  const storage = editor.storage as unknown as { markdown: { getMarkdown: () => string } };
  return storage.markdown.getMarkdown();
}

/// How far the on-screen keyboard reaches up the page. iOS shrinks only the
/// *visual* viewport when it opens, so anything pinned to the bottom has to
/// be lifted by hand to stay above it.
function useKeyboardGap(): number {
  const [gap, setGap] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      setGap(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return gap;
}

/// A Markdown note editor. One writing surface, a formatting bar so the syntax
/// doesn't have to be memorised, and `.md` import/export. What you see is
/// styled text; what's stored is Markdown.
export function StudyNoteEditor({
  text,
  onChange,
}: {
  text: string;
  onChange: (text: string) => void;
}) {
  const dismiss = useDismiss();
  const keyboardGap = useKeyboardGap();
  const [importError, setImportError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: false,
      }),
      Placeholder.configure({ placeholder: "Start typing…" }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: false,
        transformPastedText: true,
      }),
      AutoDirection,
    ],
    content: text,
    // Re-render on every change so the format bar reflects the caret.
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => onChange(markdownOf(editor)),
  });

  const isBlank = text.trim() === "";

  const importFile = () =>
    pickTextFile(async (file) => {
      if (!editor) return;
      try {
        const contents = await readTextFile(file);
        // Append rather than overwrite, so an import can't silently destroy
        // something already typed.
        const current = markdownOf(editor);
        const combined = current.trim() === "" ? contents : `${current}\n\n${contents}`;
        editor.commands.setContent(combined);
        onChange(markdownOf(editor));
      } catch {
        setImportError("That file couldn't be read as text.");
      }
    });

  const active = (name: string, attributes?: Record<string, unknown>) =>
    editor?.isActive(name, attributes) ?? false;
  const chain = () => editor!.chain().focus();

  return (
    <>
      <SheetNav
        title={isBlank ? "New Note" : noteTitle(text)}
        leading={
          <Menu
            label="More"
            icon={<EllipsisCircleIcon size={24} />}
            items={[
              {
                label: "Export as Markdown",
                icon: <ShareIcon size={19} />,
                disabled: isBlank,
                onSelect: () => void exportMarkdown(safeFilename(noteTitle(text)), text),
              },
              { label: "Import Markdown…", icon: <ImportIcon size={19} />, onSelect: importFile },
            ]}
          />
        }
        trailing={
          <GlassButton prominent onClick={dismiss}>
            Done
          </GlassButton>
        }
      />

      <div className="editor-wrap" style={{ paddingBottom: keyboardGap }}>
        <EditorContent editor={editor} style={{ minHeight: "100%" }} />
      </div>

      <div
        className="format-bar"
        style={keyboardGap > 0 ? { bottom: keyboardGap, paddingBottom: 0 } : undefined}
        // Keep the editor focused (and the keyboard up) while tapping buttons.
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={(event) => event.preventDefault()}
      >
        <div className="format-bar-scroll">
          <FormatButton label="Title" active={active("heading", { level: 1 })}
            onClick={() => chain().toggleHeading({ level: 1 }).run()}>
            <TitleIcon size={20} />
          </FormatButton>
          <FormatButton label="Heading" active={active("heading", { level: 2 })}
            onClick={() => chain().toggleHeading({ level: 2 }).run()}>
            <HeadingIcon size={20} />
          </FormatButton>

          <span className="format-separator" />

          <FormatButton label="Bold" active={active("bold")} onClick={() => chain().toggleBold().run()}>
            <BoldIcon size={19} strokeWidth={2.4} />
          </FormatButton>
          <FormatButton label="Italic" active={active("italic")} onClick={() => chain().toggleItalic().run()}>
            <ItalicIcon size={19} />
          </FormatButton>
          <FormatButton label="Code" active={active("code")} onClick={() => chain().toggleCode().run()}>
            <CodeIcon size={19} />
          </FormatButton>

          <span className="format-separator" />

          <FormatButton label="Bulleted list" active={active("bulletList")}
            onClick={() => chain().toggleBulletList().run()}>
            <BulletListIcon size={20} />
          </FormatButton>
          <FormatButton label="Numbered list" active={active("orderedList")}
            onClick={() => chain().toggleOrderedList().run()}>
            <NumberedListIcon size={20} />
          </FormatButton>
          <FormatButton label="Quote" active={active("blockquote")}
            onClick={() => chain().toggleBlockquote().run()}>
            <QuoteIcon size={20} />
          </FormatButton>
        </div>
      </div>

      <Alert title="Couldn't Import File" message={importError} onClose={() => setImportError(null)} />
    </>
  );
}

function FormatButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? "format-button active" : "format-button"}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
