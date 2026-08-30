import SwiftUI
import UIKit

/// Drives the note editor from the formatting bar. The text view holds styled
/// text; Markdown exists only as the stored form, so the writer never sees
/// asterisks or hashes.
@MainActor
final class NoteEditorController: ObservableObject {
    weak var textView: UITextView?
    var onTextChange: ((String) -> Void)?

    /// Reflects the caret so the bar can highlight what's currently active.
    @Published var activeBlock: BlockStyle = .body
    @Published var isBold = false
    @Published var isItalic = false
    @Published var isCode = false

    // MARK: Inline formatting

    func toggleBold() { toggleTrait(.traitBold) }
    func toggleItalic() { toggleTrait(.traitItalic) }

    func toggleCode() {
        guard let textView else { return }
        let range = textView.selectedRange

        if range.length == 0 {
            var typing = textView.typingAttributes
            let turningOn = !(typing[.inlineCode] as? Bool ?? false)
            applyCode(turningOn, to: &typing)
            textView.typingAttributes = typing
            refreshState()
            return
        }

        let storage = textView.textStorage
        let turningOn = storage.attribute(.inlineCode, at: range.location,
                                          effectiveRange: nil) as? Bool != true
        storage.beginEditing()
        storage.enumerateAttributes(in: range) { attributes, subRange, _ in
            var updated = attributes
            applyCode(turningOn, to: &updated)
            storage.setAttributes(updated, range: subRange)
        }
        storage.endEditing()
        textView.selectedRange = range
        commit()
    }

    private func applyCode(_ on: Bool, to attributes: inout [NSAttributedString.Key: Any]) {
        if on {
            attributes[.inlineCode] = true
            attributes[.font] = MarkdownStyler.codeFont
            attributes[.backgroundColor] = UIColor.secondarySystemFill
        } else {
            let block = BlockStyle(rawValue: attributes[.blockStyle] as? Int ?? 0) ?? .body
            attributes[.inlineCode] = nil
            attributes[.backgroundColor] = nil
            attributes[.font] = MarkdownStyler.font(for: block)
        }
    }

    private func toggleTrait(_ trait: UIFontDescriptor.SymbolicTraits) {
        guard let textView else { return }
        let range = textView.selectedRange

        if range.length == 0 {
            var typing = textView.typingAttributes
            let font = (typing[.font] as? UIFont) ?? MarkdownStyler.bodyFont
            typing[.font] = font.has(trait) ? font.withoutTraits(trait) : font.withTraits(trait)
            textView.typingAttributes = typing
            refreshState()
            return
        }

        let storage = textView.textStorage
        let current = storage.attribute(.font, at: range.location, effectiveRange: nil) as? UIFont
        let turningOn = !(current?.has(trait) ?? false)

        storage.beginEditing()
        storage.enumerateAttribute(.font, in: range) { value, subRange, _ in
            let font = (value as? UIFont) ?? MarkdownStyler.bodyFont
            storage.addAttribute(.font,
                                 value: turningOn ? font.withTraits(trait) : font.withoutTraits(trait),
                                 range: subRange)
        }
        storage.endEditing()
        textView.selectedRange = range
        commit()
    }

    // MARK: Block formatting

    /// Applies a block style to the paragraph at the caret, or clears it back
    /// to body when that style is already active.
    func setBlock(_ style: BlockStyle) {
        guard let textView else { return }
        let storage = textView.textStorage
        let string = storage.string as NSString
        guard string.length > 0 || style != .body else { return }

        let selection = textView.selectedRange
        let paragraph = string.paragraphRange(for: selection)
        let current = MarkdownStyler.blockStyle(of: storage, at: paragraph)
        let target: BlockStyle = (current == style) ? .body : style

        // Round-tripping through Markdown preserves inline bold/italic/code
        // while the block's font and marker change underneath it.
        let existing = storage.attributedSubstring(from: paragraph)
        let hadNewline = (existing.string as NSString).hasSuffix("\n")
        let content = MarkdownStyler.inlineMarkdown(of: existing, block: current)

        let replacement = NSMutableAttributedString(
            attributedString: MarkdownStyler.attributedParagraph(block: target, content: content))
        if hadNewline {
            replacement.append(NSAttributedString(string: "\n",
                                                  attributes: MarkdownStyler.attributes(for: target)))
        }

        let lengthDelta = replacement.length - paragraph.length
        storage.beginEditing()
        storage.replaceCharacters(in: paragraph, with: replacement)
        storage.endEditing()

        let caret = max(paragraph.location,
                        min(selection.location + lengthDelta, storage.length))
        textView.selectedRange = NSRange(location: caret, length: 0)
        textView.typingAttributes = MarkdownStyler.attributes(for: target)
        commit()
    }

    // MARK: Plumbing

    func commit() {
        guard let textView else { return }
        onTextChange?(MarkdownStyler.markdown(from: textView.attributedText))
        refreshState()
    }

    func refreshState() {
        guard let textView else { return }
        let storage = textView.textStorage
        let selection = textView.selectedRange

        let attributes: [NSAttributedString.Key: Any]
        if selection.length == 0 || storage.length == 0 {
            attributes = textView.typingAttributes
        } else {
            attributes = storage.attributes(at: min(selection.location, storage.length - 1),
                                            effectiveRange: nil)
        }

        let font = (attributes[.font] as? UIFont) ?? MarkdownStyler.bodyFont
        isCode = attributes[.inlineCode] as? Bool ?? false
        isBold = font.has(.traitBold) && !isCode
        isItalic = font.has(.traitItalic) && !isCode

        if storage.length > 0 {
            let paragraph = (storage.string as NSString).paragraphRange(for: selection)
            activeBlock = MarkdownStyler.blockStyle(of: storage, at: paragraph)
        } else {
            activeBlock = BlockStyle(rawValue: attributes[.blockStyle] as? Int ?? 0) ?? .body
        }
        // Headings carry a bold font by definition; don't light up the B button.
        if activeBlock.isHeading { isBold = false }
        if activeBlock == .quote { isItalic = false }
    }
}

/// A `UITextView` wrapper. SwiftUI's `TextEditor` offers no selection, styling
/// or typing-attribute control on iOS 17, all of which this editor needs.
struct MarkdownTextView: UIViewRepresentable {
    @Binding var text: String
    let controller: NoteEditorController

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.delegate = context.coordinator
        view.adjustsFontForContentSizeCategory = true
        view.backgroundColor = .clear
        view.textContainerInset = UIEdgeInsets(top: 12, left: 12, bottom: 32, right: 12)
        view.keyboardDismissMode = .interactive
        view.alwaysBounceVertical = true
        view.attributedText = MarkdownStyler.attributed(from: text)
        view.typingAttributes = MarkdownStyler.bodyAttributes

        controller.textView = view
        controller.onTextChange = { context.coordinator.push($0) }
        context.coordinator.lastSerialized = text
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        // Only re-render when the change came from outside the editor (an
        // import, say) — re-rendering on every keystroke would fight the caret.
        guard context.coordinator.lastSerialized != text else { return }
        context.coordinator.lastSerialized = text

        let selection = view.selectedRange
        view.attributedText = MarkdownStyler.attributed(from: text)
        view.selectedRange = NSRange(
            location: min(selection.location, view.textStorage.length), length: 0)
        controller.refreshState()
    }

    func makeCoordinator() -> Coordinator { Coordinator(text: $text, controller: controller) }

    final class Coordinator: NSObject, UITextViewDelegate {
        private let text: Binding<String>
        private let controller: NoteEditorController
        var lastSerialized: String?

        init(text: Binding<String>, controller: NoteEditorController) {
            self.text = text
            self.controller = controller
        }

        func push(_ newValue: String) {
            lastSerialized = newValue
            text.wrappedValue = newValue
        }

        func textViewDidChange(_ textView: UITextView) {
            push(MarkdownStyler.markdown(from: textView.attributedText))
            controller.refreshState()
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            controller.refreshState()
        }

        /// Return continues lists, and ends heading/quote paragraphs.
        func textView(_ textView: UITextView,
                      shouldChangeTextIn range: NSRange,
                      replacementText: String) -> Bool {
            guard replacementText == "\n" else { return true }

            let storage = textView.textStorage
            let string = storage.string as NSString
            let paragraph = string.paragraphRange(for: NSRange(location: range.location, length: 0))
            let block = MarkdownStyler.blockStyle(of: storage, at: paragraph)

            let line = string.substring(with: paragraph).trimmingCharacters(in: .newlines)
            let content = MarkdownStyler.inlineMarkdown(
                of: storage.attributedSubstring(from: paragraph), block: block)
                .trimmingCharacters(in: .whitespaces)

            switch block {
            case .bullet, .numbered:
                if content.isEmpty {
                    // Return on an empty item ends the list.
                    let blank = NSAttributedString(string: "\n", attributes: MarkdownStyler.bodyAttributes)
                    storage.beginEditing()
                    storage.replaceCharacters(in: paragraph, with: blank)
                    storage.endEditing()
                    textView.selectedRange = NSRange(location: paragraph.location + 1, length: 0)
                    textView.typingAttributes = MarkdownStyler.bodyAttributes
                } else {
                    let marker = block == .bullet
                        ? BlockStyle.bullet.visiblePrefix
                        : Self.nextNumber(after: line)
                    let insert = NSMutableAttributedString(
                        string: "\n", attributes: MarkdownStyler.attributes(for: block))
                    insert.append(NSAttributedString(string: marker,
                                                     attributes: MarkdownStyler.attributes(for: block)))
                    storage.beginEditing()
                    storage.replaceCharacters(in: range, with: insert)
                    storage.endEditing()
                    textView.selectedRange = NSRange(location: range.location + insert.length, length: 0)
                    textView.typingAttributes = MarkdownStyler.attributes(for: block)
                }

            case .heading1, .heading2, .heading3, .quote:
                // A heading shouldn't bleed into the paragraph after it.
                let insert = NSAttributedString(string: "\n", attributes: MarkdownStyler.bodyAttributes)
                storage.beginEditing()
                storage.replaceCharacters(in: range, with: insert)
                storage.endEditing()
                textView.selectedRange = NSRange(location: range.location + 1, length: 0)
                textView.typingAttributes = MarkdownStyler.bodyAttributes

            case .body:
                return true
            }

            push(MarkdownStyler.markdown(from: textView.attributedText))
            controller.refreshState()
            return false
        }

        /// "3. third" -> "4. "
        private static func nextNumber(after line: String) -> String {
            let parts = line.trimmingCharacters(in: .whitespaces).split(separator: " ", maxSplits: 1)
            if let first = parts.first, first.hasSuffix("."), let number = Int(first.dropLast()) {
                return "\(number + 1). "
            }
            return "1. "
        }
    }
}
