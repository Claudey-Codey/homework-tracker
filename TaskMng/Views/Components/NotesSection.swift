import PDFKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// Markdown notes and attached images and PDFs, with Add and Import buttons —
/// the exam's study material and an assignment's content. Tapping a note opens
/// the editor; tapping an image or PDF shows it full size. Everything is held as drafts
/// by the owning form and only committed on Save.
struct NotesSection: View {
    let header: String
    /// Shown under the section while it has nothing in it yet.
    let emptyFooter: String
    @Binding var notes: [DraftNote]
    @Binding var images: [DraftImage]

    @State private var editingNote: DraftNote?
    @State private var importingNote = false
    @State private var viewingImage: DraftImage?
    @State private var photoSelection: [PhotosPickerItem] = []
    @State private var importingImages = false
    @State private var importingPDFs = false
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

            ForEach(images) { image in
                Button { viewingImage = image } label: {
                    HStack(spacing: 12) {
                        ImageThumbnail(image: image.thumbnail, isPDF: image.isPDF)
                        Text(image.name)
                            .font(.body)
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                    }
                }
            }
            .onDelete { images.remove(atOffsets: $0) }

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

            PhotosPicker(selection: $photoSelection, matching: .images) {
                Label("Add Photo", systemImage: "photo.on.rectangle")
            }
            .onChange(of: photoSelection) { _, items in addPhotos(items) }
            .sheet(item: $viewingImage) { image in
                if image.isPDF {
                    PDFViewer(pdf: image)
                } else {
                    ImageViewer(image: image)
                }
            }

            Button {
                importingImages = true
            } label: {
                Label("Add Image from Files…", systemImage: "photo.badge.plus")
            }
            .fileImporter(isPresented: $importingImages,
                          allowedContentTypes: [.png, .image],
                          allowsMultipleSelection: true) { result in
                importImages(result)
            }

            Button {
                importingPDFs = true
            } label: {
                Label("Add PDF…", systemImage: "doc.richtext")
            }
            .fileImporter(isPresented: $importingPDFs,
                          allowedContentTypes: [.pdf],
                          allowsMultipleSelection: true) { result in
                importPDFs(result)
            }

            Button {
                importingNote = true
            } label: {
                Label("Import .md File…", systemImage: "square.and.arrow.down")
            }
        } header: {
            Text(header)
        } footer: {
            Text(notes.isEmpty && images.isEmpty
                 ? emptyFooter
                 : "Tap a note, image or PDF to open it, swipe to delete.")
        }
    }

    /// Photos come out of the picker as they were taken (HEIC, JPEG or PNG)
    /// and are kept that way.
    private func addPhotos(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        // Clear the selection so picking the same photo again still registers.
        photoSelection = []
        Task {
            for item in items {
                guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
                withAnimation { images.append(DraftImage(data: data, name: "Photo")) }
            }
        }
    }

    private func importImages(_ result: Result<[URL], Error>) {
        do {
            var unreadable = 0
            for url in try result.get() {
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }

                let data = try Data(contentsOf: url)
                let image = DraftImage(data: data, name: url.lastPathComponent)
                guard image.thumbnail != nil else {
                    unreadable += 1
                    continue
                }
                withAnimation { images.append(image) }
            }
            if unreadable > 0 {
                importError = unreadable == 1
                    ? "That file isn't an image this iPhone can open."
                    : "\(unreadable) files aren't images this iPhone can open."
            }
        } catch {
            importError = error.localizedDescription
        }
    }

    private func importPDFs(_ result: Result<[URL], Error>) {
        do {
            var unreadable = 0
            for url in try result.get() {
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }

                let data = try Data(contentsOf: url)
                guard PDFDocument(data: data) != nil else {
                    unreadable += 1
                    continue
                }
                let pdf = DraftImage(data: data, name: url.lastPathComponent, isPDF: true)
                withAnimation { images.append(pdf) }
            }
            if unreadable > 0 {
                importError = unreadable == 1
                    ? "That file isn't a PDF this iPhone can open."
                    : "\(unreadable) files aren't PDFs this iPhone can open."
            }
        } catch {
            importError = error.localizedDescription
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

/// A rounded square preview for an image or PDF row.
private struct ImageThumbnail: View {
    let image: UIImage?
    var isPDF = false

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: isPDF ? "doc.richtext" : "photo")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 44, height: 44)
        .background(Color(.tertiarySystemFill))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding(.vertical, 2)
    }
}

/// An attached image, fitted to the screen, with a share button for saving it
/// to Photos or sending it on.
private struct ImageViewer: View {
    let image: DraftImage
    @Environment(\.dismiss) private var dismiss
    @State private var uiImage: UIImage?

    var body: some View {
        NavigationStack {
            Group {
                if let uiImage {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFit()
                        .padding()
                } else {
                    ProgressView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle(image.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if let uiImage {
                        ShareLink(item: Image(uiImage: uiImage),
                                  preview: SharePreview(image.name, image: Image(uiImage: uiImage)))
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .task { uiImage = UIImage(data: image.data) }
    }
}

/// An attached PDF, scrollable and zoomable, with a share button for opening
/// it in Books, saving it to Files or sending it on.
private struct PDFViewer: View {
    let pdf: DraftImage
    @Environment(\.dismiss) private var dismiss
    /// A temporary copy under the original filename, so the share sheet
    /// hands on a named PDF rather than anonymous data.
    @State private var fileURL: URL?

    var body: some View {
        NavigationStack {
            PDFKitView(data: pdf.data)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(pdf.name)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        if let fileURL {
                            ShareLink(item: fileURL)
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
        .task {
            let folder = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
            let name = pdf.name.lowercased().hasSuffix(".pdf") ? pdf.name : "\(pdf.name).pdf"
            let url = folder.appendingPathComponent(name)
            do {
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                try pdf.data.write(to: url)
                fileURL = url
            } catch {
                fileURL = nil
            }
        }
    }
}

/// PDFKit's viewer, which SwiftUI has no native equivalent of.
private struct PDFKitView: UIViewRepresentable {
    let data: Data

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.document = PDFDocument(data: data)
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {}
}
