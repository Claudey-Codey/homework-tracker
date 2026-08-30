import Foundation
import UniformTypeIdentifiers
import CoreTransferable

extension UTType {
    /// The system Markdown type when it's available, plain text otherwise.
    static var markdownText: UTType {
        UTType(filenameExtension: "md") ?? .plainText
    }
}

/// A note packaged for the share sheet, so "Export" produces a real `.md`
/// file that Files, Mail, or any other app can take.
struct MarkdownDocument: Transferable {
    var filename: String
    var text: String

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .markdownText) { document in
            Data(document.text.utf8)
        }
        .suggestedFileName { document in
            "\(MarkdownDocument.safeFilename(document.filename)).md"
        }
    }

    /// Note titles are free text, so strip anything a filesystem would object to.
    static func safeFilename(_ raw: String) -> String {
        let cleaned = raw
            .components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>"))
            .joined(separator: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? "Note" : String(cleaned.prefix(60))
    }
}
