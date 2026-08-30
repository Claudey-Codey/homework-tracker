import SwiftUI

/// Light / dark / follow-system appearance choice.
enum ThemeAppearance: String, CaseIterable, Identifiable {
    case system, light, dark

    var id: String { rawValue }
    var label: String { rawValue.capitalized }

    var symbol: String {
        switch self {
        case .system: return "circle.lefthalf.filled"
        case .light:  return "sun.max.fill"
        case .dark:   return "moon.fill"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light:  return .light
        case .dark:   return .dark
        }
    }
}

/// Theme options and the `@AppStorage` keys used to persist the user's choice.
enum AppTheme {
    static let accentKey = "accentColorHex"
    static let appearanceKey = "appearanceMode"
    static let showTabLabelsKey = "showTabLabels"

    static let defaultAccentHex = "#007AFF"

    /// Selectable accent colors. The first one is the default.
    static let accents: [(name: String, hex: String)] = [
        ("Blue", "#007AFF"),
        ("Indigo", "#5856D6"),
        ("Purple", "#AF52DE"),
        ("Pink", "#FF2D55"),
        ("Red", "#FF3B30"),
        ("Orange", "#FF9500"),
        ("Yellow", "#FFCC00"),
        ("Green", "#34C759"),
        ("Teal", "#00C7BE"),
        ("Brown", "#A2845E")
    ]
}
