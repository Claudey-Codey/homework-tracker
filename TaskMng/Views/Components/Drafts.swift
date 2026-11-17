import Foundation
import PDFKit
import UIKit

/// In-progress checklist step held by `AssignmentFormView` before it is
/// committed to a `ChecklistItem` on save.
struct DraftChecklistItem: Identifiable, Equatable {
    let id = UUID()
    var text: String
    var isDone: Bool
}

/// In-progress note held by `ExamFormView` or `AssignmentFormView` before it
/// is committed to a `StudyNote` on save.
struct DraftNote: Identifiable, Equatable {
    let id = UUID()
    var text: String
}

/// An image or PDF held by a form before Save — either picked since the form opened,
/// or copied from a saved `ImageAttachment` so Cancel leaves that untouched.
struct DraftImage: Identifiable {
    let id = UUID()
    let data: Data
    let name: String
    let isPDF: Bool
    /// The saved attachment this draft stands for; nil for a newly picked one.
    let saved: ImageAttachment?
    /// Decoded once and kept small, so list rows don't decode the full image
    /// every time they redraw. For a PDF it's the first page. Nil when the
    /// data isn't something iOS can read.
    let thumbnail: UIImage?

    init(data: Data, name: String, isPDF: Bool = false, saved: ImageAttachment? = nil) {
        self.data = data
        self.name = name
        self.isPDF = isPDF
        self.saved = saved
        self.thumbnail = isPDF ? Self.pdfThumbnail(of: data) : Self.thumbnail(of: data)
    }

    init(_ attachment: ImageAttachment) {
        self.init(data: attachment.data, name: attachment.name,
                  isPDF: attachment.isPDF, saved: attachment)
    }

    /// The first page, rendered small. Nil when the data isn't a PDF.
    private static func pdfThumbnail(of data: Data) -> UIImage? {
        guard let page = PDFDocument(data: data)?.page(at: 0) else { return nil }
        return page.thumbnail(of: CGSize(width: 132, height: 132), for: .mediaBox)
    }

    /// Big enough to fill a 44pt square at 3x, aspect ratio kept.
    private static func thumbnail(of data: Data) -> UIImage? {
        guard let image = UIImage(data: data),
              image.size.width > 0, image.size.height > 0 else { return nil }
        let scale = 132 / min(image.size.width, image.size.height)
        guard scale < 1 else { return image }
        return image.preparingThumbnail(of: CGSize(width: image.size.width * scale,
                                                   height: image.size.height * scale))
    }
}

/// In-progress reminder held by the assignment and exam forms before it is
/// committed to a `Reminder` on save.
struct DraftReminder: Identifiable, Equatable {
    let id = UUID()
    var count: Int
    var unit: ReminderUnit

    /// Lead time in seconds — also what the list is sorted and de-duped by.
    var offset: TimeInterval { unit.offset(count: count) }

    /// "1 week before", "30 minutes before".
    var label: String { "\(count) \(unit.name(for: count)) before" }
}
