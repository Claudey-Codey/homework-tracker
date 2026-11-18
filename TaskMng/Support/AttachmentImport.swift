import PDFKit
import UIKit
import UniformTypeIdentifiers

/// The one way files get into a notes section, whichever way they were
/// added: each is sorted into an image, a PDF or a new note, and given a name
/// that's useful in a list.
enum AttachmentImport {
    struct Result {
        var images: [DraftImage] = []
        var notes: [DraftNote] = []
        /// Files that couldn't be added, each with the reason.
        var failures: [String] = []
    }

    /// Reads files picked in Files. `taken` is the names already in the list,
    /// so a repeated name gets a number instead.
    static func load(_ urls: [URL], taken: [String]) -> Result {
        var result = Result()
        var names = taken
        for url in urls {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }

            let filename = url.lastPathComponent
            let ext = url.pathExtension.lowercased()
            let type = UTType(filenameExtension: ext)
            guard let data = try? Data(contentsOf: url) else {
                result.failures.append("\(filename) couldn’t be opened.")
                continue
            }

            if type?.conforms(to: .pdf) == true {
                guard PDFDocument(data: data) != nil else {
                    result.failures.append("\(filename) isn’t a PDF this iPhone can open.")
                    continue
                }
                let name = uniqueName(filename, taken: names)
                names.append(name)
                result.images.append(DraftImage(data: data, name: name, isPDF: true))
            } else if type?.conforms(to: .image) == true {
                let image = DraftImage(data: data, name: uniqueName(filename, taken: names))
                guard image.thumbnail != nil else {
                    result.failures.append("\(filename) isn’t an image this iPhone can open.")
                    continue
                }
                names.append(image.name)
                result.images.append(image)
            } else if type?.conforms(to: .text) == true || ["md", "markdown", "txt"].contains(ext) {
                guard let contents = String(data: data, encoding: .utf8) else {
                    result.failures.append("\(filename) couldn’t be read as text.")
                    continue
                }
                guard !contents.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                    result.failures.append("\(filename) is empty.")
                    continue
                }
                result.notes.append(DraftNote(text: noteText(contents, filename: filename)))
            } else {
                result.failures.append("\(filename) isn’t an image, PDF or text file.")
            }
        }
        return result
    }

    /// A note's text from an imported file, with the filename as its heading
    /// when the file doesn't start with one.
    static func noteText(_ contents: String, filename: String) -> String {
        let hasHeading = contents.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("#")
        let title = (filename as NSString).deletingPathExtension
        return hasHeading ? contents : "# \(title)\n\n\(contents)"
    }

    /// "Photo – Nov 18", for photos, scans and pasted images, which arrive
    /// without a filename worth showing.
    static func datedName(_ prefix: String, date: Date = .now) -> String {
        "\(prefix) – \(date.formatted(.dateTime.month(.abbreviated).day()))"
    }

    /// Adds " (2)", " (3)"… until `name` isn't already taken.
    static func uniqueName(_ name: String, taken: [String]) -> String {
        guard taken.contains(name) else { return name }
        var number = 2
        while taken.contains("\(name) (\(number))") { number += 1 }
        return "\(name) (\(number))"
    }

    /// Scanned pages as one PDF. Pages are scaled down to a size that still
    /// prints sharply and stored as JPEG, so a few pages don't run to tens of
    /// megabytes. Nil if no page could be added.
    static func scanPDF(_ pages: [UIImage]) -> Data? {
        let document = PDFDocument()
        for page in pages {
            guard let jpeg = scaledDown(page, longestSide: 2200).jpegData(compressionQuality: 0.75),
                  let compact = UIImage(data: jpeg),
                  let pdfPage = PDFPage(image: compact) else { continue }
            document.insert(pdfPage, at: document.pageCount)
        }
        return document.pageCount > 0 ? document.dataRepresentation() : nil
    }

    private static func scaledDown(_ image: UIImage, longestSide: CGFloat) -> UIImage {
        let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        let longest = max(pixels.width, pixels.height)
        guard longest > longestSide else { return image }
        let factor = longestSide / longest
        let size = CGSize(width: pixels.width * factor, height: pixels.height * factor)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
