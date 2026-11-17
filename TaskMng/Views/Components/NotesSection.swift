import SwiftUI
import UniformTypeIdentifiers

/// A list of Markdown notes with Add and Import buttons — the exam's study
/// material and an assignment's content. Tapping a note opens the editor.
/// Notes are held as drafts by the owning form and only committed on Save.
struct NotesSection: View {
    let header: String
    /// Shown under the section while it has no notes yet.
    let emptyFooter: String
    @Binding var notes: [DraftNote]

    @State private var editingNote: DraftNote?
    @State private var importingNote = false
    @State private var importError: String?

    var body: some View {
        Section {
            ForEach(notes) { note in
                Button { editingNote = note } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(NoteText.title(of: note.text))
                            .font(.body)
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                        Text(NoteText.preview(of: note.text))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }
            .onDelete { notes.remove(atOffsets: $0) }

            Button {
                let note = DraftNote(text: "")
                notes.append(note)
                editingNote = note
            } label: {
                Label("Add Note", systemImage: "square.and.pencil")
            }
            // Presentations hang off this one always-present row: modifiers on
            // a Section are handed to every row in it, which would stack one
            // sheet per note.
            //
            // Closing the editor on an untouched note discards it, so tapping
            // "Add Note" and backing out doesn't leave an empty row behind.
            .sheet(item: $editingNote, onDismiss: discardEmptyNotes) { note in
                StudyNoteEditorView(text: binding(for: note))
            }
            // Importing straight into a new note, so you don't have to create
            // an empty one first.
            .fileImporter(isPresented: $importingNote,
                          allowedContentTypes: [.markdownText, .plainText, .text]) { result in
                importNote(result)
            }
            .alert("Couldn't Import File",
                   isPresented: Binding(get: { importError != nil },
                                        set: { if !$0 { importError = nil } })) {
                Button("OK", role: .cancel) { importError = nil }
            } message: {
                Text(importError ?? "")
            }

            Button {
                importingNote = true
            } label: {
                Label("Import .md File…", systemImage: "square.and.arrow.down")
            }
        } header: {
            Text(header)
        } footer: {
            Text(notes.isEmpty ? emptyFooter : "Tap a note to edit it, swipe to delete.")
        }
    }

    private func importNote(_ result: Result<URL, Error>) {
        do {
            let url = try result.get()
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }

            let contents = try String(contentsOf: url, encoding: .utf8)
            guard !contents.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                importError = "That file is empty."
                return
            }
            // Fall back to the filename as a heading if the file has no title.
            let hasHeading = contents.trimmingCharacters(in: .whitespacesAndNewlines)
                .hasPrefix("#")
            let name = url.deletingPathExtension().lastPathComponent
            let text = hasHeading ? contents : "# \(name)\n\n\(contents)"
            withAnimation { notes.append(DraftNote(text: text)) }
        } catch {
            importError = error.localizedDescription
        }
    }

    /// Bridges a `DraftNote` back to its slot in `notes` so the editor writes through.
    private func binding(for note: DraftNote) -> Binding<String> {
        guard let index = notes.firstIndex(where: { $0.id == note.id }) else {
            return .constant(note.text)
        }
        return $notes[index].text
    }

    private func discardEmptyNotes() {
        notes.removeAll { $0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }
}
