import UIKit

/// Reads and writes the custom profile photo.
///
/// The image is a file in Application Support (UserDefaults is the wrong place
/// for image blobs), but SwiftUI can't observe the filesystem — so every write
/// bumps `Account.photoVersionKey` in UserDefaults, and views bind that with
/// `@AppStorage` to know when to redraw. The decoded image is cached against
/// that same version so a redraw isn't a disk read.
enum AvatarStore {
    /// Longest edge of the stored image. A profile photo is never shown larger
    /// than ~96pt, so anything beyond this is wasted disk and memory.
    private static let maxDimension: CGFloat = 512

    private static var cachedVersion = -1
    private static var cachedImage: UIImage?

    private static var fileURL: URL {
        let directory = FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: directory,
                                                 withIntermediateDirectories: true)
        return directory.appendingPathComponent("avatar.jpg")
    }

    static var version: Int {
        UserDefaults.standard.integer(forKey: Account.photoVersionKey)
    }

    static var hasPhoto: Bool { photo != nil }

    static var photo: UIImage? {
        let current = version
        if cachedVersion == current { return cachedImage }
        cachedVersion = current
        cachedImage = (try? Data(contentsOf: fileURL)).flatMap(UIImage.init(data:))
        return cachedImage
    }

    /// Downscales, writes to disk, and bumps the version. Returns false if the
    /// data wasn't a decodable image.
    @discardableResult
    static func save(imageData: Data) -> Bool {
        guard let decoded = UIImage(data: imageData) else { return false }
        let resized = downscaled(decoded)
        guard let jpeg = resized.jpegData(compressionQuality: 0.85) else { return false }
        guard (try? jpeg.write(to: fileURL, options: .atomic)) != nil else { return false }

        bumpVersion()
        return true
    }

    static func remove() {
        try? FileManager.default.removeItem(at: fileURL)
        bumpVersion()
    }

    private static func bumpVersion() {
        // Invalidate first so the next read re-decodes from disk.
        cachedVersion = -1
        cachedImage = nil
        UserDefaults.standard.set(version + 1, forKey: Account.photoVersionKey)
    }

    private static func downscaled(_ image: UIImage) -> UIImage {
        let longest = max(image.size.width, image.size.height)
        guard longest > maxDimension else { return image }

        let scale = maxDimension / longest
        let target = CGSize(width: image.size.width * scale,
                            height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1                     // target is already in pixels
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
    }
}
