import Foundation
import SwiftData

/// A single note — an exam's study material or an assignment's content. Like
/// the Notes app, the first line doubles as the note's title and the rest is
/// the preview.
@Model
final class StudyNote {
    var text: String = ""
    /// Explicit ordering — SwiftData relationships come back unordered.
    var order: Int = 0
    var createdAt: Date = Date()
    var updatedAt: Date = Date()
    /// Exactly one of these is set: the note belongs to an exam or an assignment.
    var exam: Exam?
    var assignment: Assignment?

    init(text: String, order: Int) {
        self.text = text
        self.order = order
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}

/// Splitting a note's raw text into a title line and a preview line, shared by
/// the saved model and the in-progress drafts held by the forms.
enum NoteText {
    static func title(of text: String) -> String {
        let first = text
            .split(separator: "\n", omittingEmptySubsequences: true)
            .first
            .map(String.init)?
            .trimmingCharacters(in: .whitespaces) ?? ""
        let stripped = stripMarkdown(first)
        return stripped.isEmpty ? "New Note" : stripped
    }

    static func preview(of text: String) -> String {
        let rest = text
            .split(separator: "\n", omittingEmptySubsequences: true)
            .dropFirst()
            .map { stripMarkdown(String($0)) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        return rest.isEmpty ? "No additional text" : rest
    }

    /// Titles and previews are shown as plain text, so drop the syntax that
    /// would otherwise leak into the list (`# Chapter 3` reads as "Chapter 3").
    static func stripMarkdown(_ line: String) -> String {
        var text = line.trimmingCharacters(in: .whitespaces)
        while text.hasPrefix("#") { text.removeFirst() }
        for marker in ["- ", "* ", "+ ", "> "] where text.hasPrefix(marker) {
            text.removeFirst(marker.count)
        }
        for syntax in ["**", "__", "`", "~~"] {
            text = text.replacingOccurrences(of: syntax, with: "")
        }
        return text.trimmingCharacters(in: .whitespaces)
    }
}
