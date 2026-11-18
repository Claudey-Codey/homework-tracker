import Foundation
import UIKit

extension NSAttributedString.Key {
    /// Which block style a paragraph is in. Stored across the whole paragraph
    /// so the block survives editing and can be recovered on serialization.
    static let blockStyle = NSAttributedString.Key("donedey.blockStyle")
    /// Marks a run as inline code, since a monospaced font alone is ambiguous.
    static let inlineCode = NSAttributedString.Key("donedey.inlineCode")
}

enum BlockStyle: Int {
    case body, heading1, heading2, heading3, bullet, numbered, quote

    var isHeading: Bool { self == .heading1 || self == .heading2 || self == .heading3 }

    /// What this block contributes to the front of a serialized Markdown line.
    var markdownPrefix: String {
        switch self {
        case .body, .numbered: return ""   // numbered keeps its "1. " in the text
        case .heading1:        return "# "
        case .heading2:        return "## "
        case .heading3:        return "### "
        case .bullet:          return "- "
        case .quote:           return "> "
        }
    }

    /// The marker shown to the reader. Bullets display a real • rather than "-".
    var visiblePrefix: String {
        self == .bullet ? "• " : ""
    }
}

extension UIFont {
    func withTraits(_ traits: UIFontDescriptor.SymbolicTraits) -> UIFont {
        guard let descriptor = fontDescriptor.withSymbolicTraits(
            fontDescriptor.symbolicTraits.union(traits)) else { return self }
        return UIFont(descriptor: descriptor, size: 0)
    }

    func withoutTraits(_ traits: UIFontDescriptor.SymbolicTraits) -> UIFont {
        guard let descriptor = fontDescriptor.withSymbolicTraits(
            fontDescriptor.symbolicTraits.subtracting(traits)) else { return self }
        return UIFont(descriptor: descriptor, size: 0)
    }

    func has(_ trait: UIFontDescriptor.SymbolicTraits) -> Bool {
        fontDescriptor.symbolicTraits.contains(trait)
    }
}

/// Converts between the Markdown a note is stored as and the styled text shown
/// in the editor, so the writer sees **bold** as bold rather than as asterisks.
enum MarkdownStyler {

    // MARK: Fonts

    static var bodyFont: UIFont { UIFont.preferredFont(forTextStyle: .body) }

    static var codeFont: UIFont {
        UIFont.monospacedSystemFont(ofSize: bodyFont.pointSize * 0.95, weight: .regular)
    }

    static func font(for block: BlockStyle) -> UIFont {
        switch block {
        case .heading1: return UIFont.preferredFont(forTextStyle: .title1).withTraits(.traitBold)
        case .heading2: return UIFont.preferredFont(forTextStyle: .title2).withTraits(.traitBold)
        case .heading3: return UIFont.preferredFont(forTextStyle: .title3).withTraits(.traitBold)
        case .quote:    return bodyFont.withTraits(.traitItalic)
        default:        return bodyFont
        }
    }

    static func color(for block: BlockStyle) -> UIColor {
        block == .quote ? .secondaryLabel : .label
    }

    static func paragraphStyle(for block: BlockStyle) -> NSParagraphStyle {
        let style = NSMutableParagraphStyle()
        style.alignment = .natural          // Hebrew right, English left, per paragraph
        style.lineSpacing = 2
        style.paragraphSpacing = block.isHeading ? 6 : 3
        switch block {
        case .bullet, .numbered: style.firstLineHeadIndent = 0; style.headIndent = 18
        case .quote:             style.firstLineHeadIndent = 14; style.headIndent = 14
        default:                 break
        }
        return style
    }

    static func attributes(for block: BlockStyle) -> [NSAttributedString.Key: Any] {
        [.font: font(for: block),
         .foregroundColor: color(for: block),
         .paragraphStyle: paragraphStyle(for: block),
         .blockStyle: block.rawValue]
    }

    static var bodyAttributes: [NSAttributedString.Key: Any] { attributes(for: .body) }

    // MARK: Markdown -> styled text

    static func attributed(from markdown: String) -> NSAttributedString {
        let result = NSMutableAttributedString()
        let lines = markdown.components(separatedBy: .newlines)

        for (index, rawLine) in lines.enumerated() {
            let (block, content) = parseBlock(rawLine)
            result.append(attributedParagraph(block: block, content: content))
            if index < lines.count - 1 {
                result.append(NSAttributedString(string: "\n", attributes: attributes(for: block)))
            }
        }
        return result
    }

    /// Splits a Markdown line into its block style and remaining inline content.
    static func parseBlock(_ line: String) -> (BlockStyle, String) {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        for (marker, block) in [("### ", BlockStyle.heading3),
                                ("## ", .heading2),
                                ("# ", .heading1),
                                ("> ", .quote)] where trimmed.hasPrefix(marker) {
            return (block, String(trimmed.dropFirst(marker.count)))
        }
        for marker in ["- ", "* ", "+ "] where trimmed.hasPrefix(marker) {
            return (.bullet, String(trimmed.dropFirst(marker.count)))
        }
        let parts = trimmed.split(separator: " ", maxSplits: 1)
        if let first = parts.first, first.hasSuffix("."), Int(first.dropLast()) != nil {
            return (.numbered, trimmed)   // "1. " stays visible; it is already Markdown
        }
        return (.body, line)
    }

    /// One styled paragraph, no trailing newline.
    static func attributedParagraph(block: BlockStyle, content: String) -> NSAttributedString {
        let result = NSMutableAttributedString()
        if !block.visiblePrefix.isEmpty {
            result.append(NSAttributedString(string: block.visiblePrefix,
                                             attributes: attributes(for: block)))
        }
        result.append(inlineAttributed(content, block: block))
        return result
    }

    /// Applies **bold**, *italic* and `code` within a paragraph's text.
    private static func inlineAttributed(_ content: String, block: BlockStyle) -> NSAttributedString {
        let base = attributes(for: block)
        guard !content.isEmpty else { return NSAttributedString(string: "", attributes: base) }

        guard let parsed = try? AttributedString(
            markdown: content,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) else {
            return NSAttributedString(string: content, attributes: base)
        }

        let result = NSMutableAttributedString()
        let baseFont = font(for: block)
        for run in parsed.runs {
            let piece = String(parsed[run.range].characters)
            guard !piece.isEmpty else { continue }
            var attributes = base
            let intent = run.inlinePresentationIntent ?? []

            if intent.contains(.code) {
                attributes[.font] = codeFont
                attributes[.inlineCode] = true
                attributes[.backgroundColor] = UIColor.secondarySystemFill
            } else {
                var font = baseFont
                if intent.contains(.stronglyEmphasized) { font = font.withTraits(.traitBold) }
                if intent.contains(.emphasized) { font = font.withTraits(.traitItalic) }
                attributes[.font] = font
            }
            result.append(NSAttributedString(string: piece, attributes: attributes))
        }
        return result
    }

    // MARK: Styled text -> Markdown

    static func markdown(from attributed: NSAttributedString) -> String {
        let text = attributed.string as NSString
        guard text.length > 0 else { return "" }

        var lines: [String] = []
        var location = 0
        while location < text.length {
            let paragraph = text.paragraphRange(for: NSRange(location: location, length: 0))
            let block = blockStyle(of: attributed, at: paragraph)
            lines.append(block.markdownPrefix + inlineMarkdown(
                of: attributed.attributedSubstring(from: paragraph), block: block))
            location = NSMaxRange(paragraph)
        }
        // A trailing newline produces a final empty paragraph the loop misses.
        if text.hasSuffix("\n") { lines.append("") }
        return lines.joined(separator: "\n")
    }

    /// A paragraph's inline content as Markdown — no block prefix, no bullet glyph.
    static func inlineMarkdown(of paragraph: NSAttributedString, block: BlockStyle) -> String {
        var content = ""
        let string = paragraph.string as NSString

        paragraph.enumerateAttributes(in: NSRange(location: 0, length: paragraph.length)) { attributes, range, _ in
            var piece = string.substring(with: range).replacingOccurrences(of: "\n", with: "")
            guard !piece.isEmpty else { return }

            if attributes[.inlineCode] as? Bool == true {
                piece = "`\(piece)`"
            } else if let font = attributes[.font] as? UIFont {
                // Headings and quotes are already bold/italic by definition —
                // marking them again would emit "# **Title**".
                if font.has(.traitBold) && !block.isHeading { piece = "**\(piece)**" }
                if font.has(.traitItalic) && block != .quote { piece = "*\(piece)*" }
            }
            content += piece
        }

        if !block.visiblePrefix.isEmpty, content.hasPrefix(block.visiblePrefix) {
            content.removeFirst(block.visiblePrefix.count)
        }
        return content
    }

    static func blockStyle(of attributed: NSAttributedString, at range: NSRange) -> BlockStyle {
        guard attributed.length > 0 else { return .body }
        let probe = min(range.location, attributed.length - 1)
        let raw = attributed.attribute(.blockStyle, at: probe, effectiveRange: nil) as? Int
        return BlockStyle(rawValue: raw ?? 0) ?? .body
    }
}
