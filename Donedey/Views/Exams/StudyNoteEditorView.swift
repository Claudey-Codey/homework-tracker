import SwiftUI
import UniformTypeIdentifiers

/// A Markdown note editor. One writing surface, a formatting bar so the syntax
/// doesn't have to be memorised, and `.md` import/export.
struct StudyNoteEditorView: View {
    @Binding var text: String
    @Environment(\.dismiss) private var dismiss

    @StateObject private var controller = NoteEditorController()
    @State private var importing = false
    @State private var importError: String?

    private var document: MarkdownDocument {
        MarkdownDocument(filename: NoteText.title(of: text), text: text)
    }

    private var isBlank: Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .topLeading) {
                MarkdownTextView(text: $text, controller: controller)

                if text.isEmpty {
                    Text("Start typing…")
                        .font(.body)
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 17)
                        .padding(.vertical, 20)
                        .allowsHitTesting(false)
                }
            }
            .safeAreaInset(edge: .bottom) { formatBar }
            .navigationTitle(isBlank ? "New Note" : NoteText.title(of: text))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        ShareLink(item: document,
                                  preview: SharePreview(document.filename)) {
                            Label("Export as Markdown", systemImage: "square.and.arrow.up")
                        }
                        .disabled(isBlank)

                        Button {
                            importing = true
                        } label: {
                            Label("Import Markdown…", systemImage: "square.and.arrow.down")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .fileImporter(isPresented: $importing,
                          allowedContentTypes: [.markdownText, .plainText, .text]) { result in
                importFile(result)
            }
            .alert("Couldn't Import File",
                   isPresented: Binding(get: { importError != nil },
                                        set: { if !$0 { importError = nil } })) {
                Button("OK", role: .cancel) { importError = nil }
            } message: {
                Text(importError ?? "")
            }
        }
    }

    private var formatBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                button("Title", "textformat.size.larger",
                       active: controller.activeBlock == .heading1) {
                    controller.setBlock(.heading1)
                }
                button("Heading", "textformat.size",
                       active: controller.activeBlock == .heading2) {
                    controller.setBlock(.heading2)
                }

                separator

                button("Bold", "bold", active: controller.isBold) { controller.toggleBold() }
                button("Italic", "italic", active: controller.isItalic) { controller.toggleItalic() }
                button("Code", "curlybraces", active: controller.isCode) { controller.toggleCode() }

                separator

                button("Bulleted list", "list.bullet",
                       active: controller.activeBlock == .bullet) {
                    controller.setBlock(.bullet)
                }
                button("Numbered list", "list.number",
                       active: controller.activeBlock == .numbered) {
                    controller.setBlock(.numbered)
                }
                button("Quote", "text.quote",
                       active: controller.activeBlock == .quote) {
                    controller.setBlock(.quote)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .background(.bar)
    }

    private var separator: some View {
        Divider().frame(height: 22).padding(.horizontal, 2)
    }

    private func button(_ label: String,
                        _ systemImage: String,
                        active: Bool,
                        action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.body)
                .foregroundStyle(active ? Color.white : Color.primary)
                .frame(width: 38, height: 32)
                .background(active ? Color.accentColor : Color.clear,
                            in: RoundedRectangle(cornerRadius: 7))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
    }

    private func importFile(_ result: Result<URL, Error>) {
        do {
            let url = try result.get()
            // A file picked from Files lives outside the sandbox.
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }

            let contents = try String(contentsOf: url, encoding: .utf8)
            // Append rather than overwrite, so an import can't silently
            // destroy something already typed.
            text = text.isEmpty ? contents : text + "\n\n" + contents
        } catch {
            importError = error.localizedDescription
        }
    }
}
