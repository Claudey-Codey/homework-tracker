import Foundation
import SwiftData

/// A picture attached to an assignment or an exam — a PNG, a photo of the
/// worksheet, a screenshot of the slides. The bytes are kept exactly as picked.
@Model
final class ImageAttachment {
    /// Stored beside the database rather than inside it, so loading a list of
    /// assignments doesn't pull every image into memory.
    @Attribute(.externalStorage) var data: Data = Data()
    /// The original filename, or "Photo" for one from the photo library.
    var name: String = ""
    /// Explicit ordering — SwiftData relationships come back unordered.
    var order: Int = 0
    var createdAt: Date = Date()
    /// Exactly one of these is set: the image belongs to an exam or an assignment.
    var exam: Exam?
    var assignment: Assignment?

    init(data: Data, name: String, order: Int) {
        self.data = data
        self.name = name
        self.order = order
        self.createdAt = Date()
    }
}

extension ModelContext {
    /// Writes a form's image drafts back: images removed in the form are
    /// deleted, new ones are inserted and handed to `attach` to link them to
    /// their owner, and every image takes its place in the list order.
    func commitImages(_ drafts: [DraftImage],
                      replacing saved: [ImageAttachment],
                      attach: (ImageAttachment) -> Void) {
        let kept = Set(drafts.compactMap { $0.saved?.persistentModelID })
        for old in saved where !kept.contains(old.persistentModelID) {
            delete(old)
        }
        for (index, draft) in drafts.enumerated() {
            if let existing = draft.saved {
                existing.order = index
                continue
            }
            let image = ImageAttachment(data: draft.data, name: draft.name, order: index)
            attach(image)
            insert(image)
        }
    }
}
