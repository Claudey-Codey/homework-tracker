import UIKit

/// How the avatar is drawn.
enum AvatarKind: String, CaseIterable, Identifiable {
    case initials, emoji, preset, photo

    var id: String { rawValue }

    var label: String {
        switch self {
        case .initials: return "Initials"
        case .emoji:    return "Emoji"
        case .preset:   return "Preset"
        case .photo:    return "Photo"
        }
    }

    var symbol: String {
        switch self {
        case .initials: return "textformat"
        case .emoji:    return "face.smiling"
        case .preset:   return "square.grid.2x2"
        case .photo:    return "photo"
        }
    }
}

/// One of the built-in avatar images, bundled under `Resources/Avatars`.
enum AvatarPreset: String, CaseIterable, Identifiable {
    case aurora, sunset, ocean, mint, confetti, violet
    case nebula, galaxy, lava, forest, bubbles, peach
    case citrus, candy, blueprint, slate

    var id: String { rawValue }
    var imageName: String { "avatar-\(rawValue)" }
    var label: String { rawValue.capitalized }

    /// These ship as loose PNGs rather than in an asset catalog (the project has
    /// none), and SwiftUI's `Image(name)` resolves through the catalog — so it
    /// silently renders nothing. Load the file directly instead.
    var image: UIImage? {
        if let named = UIImage(named: imageName) { return named }
        guard let url = Bundle.main.url(forResource: imageName, withExtension: "png"),
              let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }
}

/// The signed-in user — except there is no signing in yet, so this is a single
/// local profile stored in `@AppStorage` alongside the app's other preferences.
enum Account {
    static let nameKey = "accountName"
    static let avatarHexKey = "accountAvatarHex"
    static let avatarKindKey = "accountAvatarKind"
    static let avatarEmojiKey = "accountAvatarEmoji"
    static let avatarPresetKey = "accountAvatarPreset"
    /// Bumped whenever the photo file changes. Views observe this so they
    /// redraw — the image itself lives on disk, which SwiftUI can't watch.
    static let photoVersionKey = "accountAvatarPhotoVersion"

    static let defaultName = "Simcha Gora"
    /// Indigo, from `AppTheme.accents`.
    static let defaultAvatarHex = "#5856D6"
    static let defaultEmoji = "📚"

    /// Grouped rather than one long wall — enough choice to feel personal
    /// without dragging in the full emoji keyboard.
    static let emojiGroups: [(name: String, emoji: [String])] = [
        ("Smileys", [
            "😀", "😄", "😅", "🤣", "🙂", "😊", "😇", "🙃",
            "😉", "😌", "😍", "🤩", "😘", "😜", "🤪", "🤔",
            "🤨", "😐", "😴", "🥱", "😎", "🥳", "🤯", "🥹",
            "😤", "😭", "🤓", "🫠", "🫡", "🤗"
        ]),
        ("People", [
            "👋", "🤙", "✌️", "🤞", "👍", "👏", "🙌", "💪",
            "🧠", "👀", "🦾", "🕺", "💃", "🧑‍🎓", "🧑‍🏫", "🧑‍💻"
        ]),
        ("Animals", [
            "🐱", "🐶", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁",
            "🐸", "🐵", "🐧", "🐦", "🦆", "🦉", "🦄", "🐝",
            "🦋", "🐢", "🐙", "🦕", "🐳", "🐬", "🦈", "🐺"
        ]),
        ("School", [
            "📚", "🎓", "✏️", "📝", "📖", "📐", "📏", "🔬",
            "🔭", "🧪", "🧮", "🖇️", "📎", "📌", "🗂️", "💼",
            "🎒", "🖊️", "🖍️", "📅"
        ]),
        ("Sports & Hobbies", [
            "⚽️", "🏀", "🏈", "⚾️", "🎾", "🏐", "🏓", "🏸",
            "🥊", "🛹", "🏂", "⛷️", "🏊", "🚴", "🎮", "🎲",
            "🎸", "🎹", "🥁", "🎤", "🎧", "🎨", "🎬", "♟️"
        ]),
        ("Food", [
            "🍕", "🍔", "🌮", "🍣", "🍜", "🍩", "🍪", "🎂",
            "🍦", "🍫", "🍓", "🍉", "🍎", "🥑", "🥐", "☕️",
            "🧋", "🥤", "🍿", "🧁"
        ]),
        ("Nature", [
            "🌵", "🌻", "🌸", "🌺", "🍀", "🌴", "🌲", "🍁",
            "🌊", "🔥", "⚡️", "❄️", "🌈", "☀️", "🌙", "⭐️",
            "🌟", "☁️", "🌍", "🌋"
        ]),
        ("Symbols", [
            "🚀", "💡", "💎", "🏆", "🥇", "🎯", "🧩", "🔑",
            "🧿", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤",
            "✨", "💥", "💫", "♾️"
        ])
    ]

    /// First letters of the first two words — "Simcha Gora" → "SG".
    static func initials(from name: String) -> String {
        let letters = name
            .split(separator: " ", omittingEmptySubsequences: true)
            .prefix(2)
            .compactMap { $0.first }
            .map { String($0).uppercased() }
            .joined()
        return letters.isEmpty ? "?" : letters
    }
}
