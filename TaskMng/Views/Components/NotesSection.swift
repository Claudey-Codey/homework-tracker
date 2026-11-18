import PDFKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
import VisionKit

/// Markdown notes and attached images and PDFs — the exam's study material and
/// an assignment's content. One "Add…" row opens a menu for every source:
/// a new note, the document scanner, the camera, the photo library, Files, or
/// an image on the clipboard. Tapping a note opens the editor; tapping an
/// image or PDF shows it full size. Everything is held as drafts by the
/// owning form and only committed on Save.
struct NotesSection: View {
    let header: String
    /// Shown under the section while it has nothing in it yet.
    let emptyFooter: String
    @Binding var notes: [DraftNote]
    @Binding var images: [DraftImage]

    @State private var editingNote: DraftNote?
    @State private var viewingImage: DraftImage?
    @State private var photoSelection: [PhotosPickerItem] = []
    @State private var choosingPhotos = false
    @State private var choosingFiles = false
    @State private var scanning = false
    @State private var takingPhoto = false
    @State private var renaming: DraftImage?
    @State private var newName = ""
    @State private var importError: String?
    /// An error from the scanner, shown once its full-screen cover has gone.
    @State private var pendingError: String?

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
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        withAnimation { images.removeAll { $0.id == image.id } }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                    Button {
                        newName = image.name
                        renaming = image
                    } label: {
                        Label("Rename", systemImage: "pencil")
                    }
                    .tint(.orange)
                }
            }
            // Touch and hold a row, then drag it.
            .onMove { images.move(fromOffsets: $0, toOffset: $1) }

            addMenu
                // Presentations hang off this one always-present row: modifiers
                // on a Section are handed to every row in it, which would
                // stack one sheet per note.
                //
                // Closing the editor on an untouched note discards it, so
                // tapping "New Note" and backing out doesn't leave an empty
                // row behind.
                .sheet(item: $editingNote, onDismiss: discardEmptyNotes) { note in
                    StudyNoteEditorView(text: binding(for: note))
                }
                .sheet(item: $viewingImage) { image in
                    if image.isPDF {
                        PDFViewer(pdf: image)
                    } else {
                        ImageViewer(image: image)
                    }
                }
                .photosPicker(isPresented: $choosingPhotos, selection: $photoSelection, matching: .images)
                .onChange(of: photoSelection) { _, items in addPhotos(items) }
                .fileImporter(isPresented: $choosingFiles,
                              allowedContentTypes: [.image, .pdf, .markdownText, .plainText, .text],
                              allowsMultipleSelection: true) { result in
                    chooseFiles(result)
                }
                .fullScreenCover(isPresented: $scanning, onDismiss: showPendingError) {
                    DocumentScannerView { pages in
                        scanning = false
                        addScan(pages)
                    } onFail: { error in
                        pendingError = error.localizedDescription
                        scanning = false
                    } onCancel: {
                        scanning = false
                    }
                    .ignoresSafeArea()
                }
                .fullScreenCover(isPresented: $takingPhoto) {
                    CameraPicker { photo in
                        takingPhoto = false
                        if let data = photo?.jpegData(compressionQuality: 0.85) {
                            addImage(data, named: AttachmentImport.datedName("Photo"))
                        }
                    }
                    .ignoresSafeArea()
                }
                .alert("Rename", isPresented: Binding(get: { renaming != nil },
                                                      set: { if !$0 { renaming = nil } })) {
                    TextField("Name", text: $newName)
                    Button("Cancel", role: .cancel) { renaming = nil }
                    Button("Save") { applyRename() }
                        .disabled(newName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .alert("Couldn’t Add Everything",
                       isPresented: Binding(get: { importError != nil },
                                            set: { if !$0 { importError = nil } })) {
                    Button("OK", role: .cancel) { importError = nil }
                } message: {
                    Text(importError ?? "")
                }
        } header: {
            Text(header)
        } footer: {
            if notes.isEmpty && images.isEmpty {
                Text(emptyFooter)
            } else if images.count > 1 {
                Text("Tap to open. Swipe to rename or delete, touch and hold a file to move it.")
            } else {
                Text("Tap to open. Swipe to rename or delete.")
            }
        }
    }

    /// The one Add row. The menu keeps its order even when it opens upward
    /// from the bottom of the screen.
    private var addMenu: some View {
        Menu {
            Button {
                let note = DraftNote(text: "")
                notes.append(note)
                editingNote = note
            } label: {
                Label("New Note", systemImage: "square.and.pencil")
            }

            Section {
                if VNDocumentCameraViewController.isSupported {
                    Button { scanning = true } label: {
                        Label {
                            Text("Scan Document")
                            Text("Saves as one PDF")
                        } icon: {
                            Image(systemName: "doc.viewfinder")
                        }
                    }
                }
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button { takingPhoto = true } label: {
                        Label("Take Photo", systemImage: "camera")
                    }
                }
                Button { choosingPhotos = true } label: {
                    Label("Photo Library", systemImage: "photo.on.rectangle")
                }
            }

            Section {
                Button { choosingFiles = true } label: {
                    Label {
                        Text("Choose File…")
                        Text("Images, PDFs, or .md and .txt notes")
                    } icon: {
                        Image(systemName: "folder")
                    }
                }
                // Checking for an image doesn't read the clipboard, so this
                // doesn't trigger the paste permission prompt.
                if UIPasteboard.general.hasImages {
                    Button(action: pasteImages) {
                        Label("Paste Image", systemImage: "doc.on.clipboard")
                    }
                }
            }
        } label: {
            Label("Add…", systemImage: "plus.circle.fill")
        }
        .menuOrder(.fixed)
    }

    /// Adds an image or PDF under `name`, numbered if that name is already in
    /// the list.
    private func addImage(_ data: Data, named name: String, isPDF: Bool = false) {
        let unique = AttachmentImport.uniqueName(name, taken: images.map(\.name))
        withAnimation { images.append(DraftImage(data: data, name: unique, isPDF: isPDF)) }
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
                addImage(data, named: AttachmentImport.datedName("Photo"))
            }
        }
    }

    private func addScan(_ pages: [UIImage]) {
        guard !pages.isEmpty else { return }
        guard let pdf = AttachmentImport.scanPDF(pages) else {
            pendingError = "The scan couldn’t be saved as a PDF."
            return
        }
        addImage(pdf, named: AttachmentImport.datedName("Scan"), isPDF: true)
    }

    private func pasteImages() {
        let pasted = (UIPasteboard.general.images ?? []).compactMap { $0.pngData() }
        guard !pasted.isEmpty else {
            importError = "There’s no image on the clipboard."
            return
        }
        for data in pasted {
            addImage(data, named: AttachmentImport.datedName("Pasted Image"))
        }
    }

    /// Files from "Choose File…": images and PDFs are attached, Markdown and
    /// plain text become notes, and anything else is listed in one alert.
    private func chooseFiles(_ result: Result<[URL], Error>) {
        do {
            let loaded = AttachmentImport.load(try result.get(), taken: images.map(\.name))
            withAnimation {
                images.append(contentsOf: loaded.images)
                notes.append(contentsOf: loaded.notes)
            }
            if !loaded.failures.isEmpty {
                importError = loaded.failures.joined(separator: "\n")
            }
        } catch {
            importError = error.localizedDescription
        }
    }

    private func applyRename() {
        let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        defer { renaming = nil }
        guard !name.isEmpty,
              let id = renaming?.id,
              let index = images.firstIndex(where: { $0.id == id }) else { return }
        images[index].name = name
    }

    private func showPendingError() {
        if let pendingError {
            importError = pendingError
            self.pendingError = nil
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
