import SwiftUI

extension Color {
    /// Creates a Color from a "#RRGGBB" (or "RGB") hex string. Falls back to iOS blue.
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)

        let r, g, b: UInt64
        switch cleaned.count {
        case 6:
            (r, g, b) = (value >> 16 & 0xFF, value >> 8 & 0xFF, value & 0xFF)
        case 3:
            (r, g, b) = ((value >> 8 & 0xF) * 17, (value >> 4 & 0xF) * 17, (value & 0xF) * 17)
        default:
            (r, g, b) = (0, 122, 255)
        }
        self.init(.sRGB,
                  red: Double(r) / 255,
                  green: Double(g) / 255,
                  blue: Double(b) / 255)
    }
}

/// A small, iOS-native palette for tagging subjects with a color.
enum SubjectPalette {
    static let colors: [String] = [
        "#FF3B30", "#FF9500", "#FFCC00", "#34C759",
        "#00C7BE", "#007AFF", "#5856D6", "#AF52DE",
        "#FF2D55", "#A2845E", "#8E8E93"
    ]
}
