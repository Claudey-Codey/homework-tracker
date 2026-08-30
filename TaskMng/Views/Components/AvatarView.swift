import SwiftUI

/// The account avatar in whichever form the user picked: initials, an emoji on
/// a coloured circle, one of the bundled presets, or their own photo.
///
/// All inputs are passed in rather than read from storage, so the same view can
/// be handed to `ImageRenderer` for the tab bar and to a preview grid.
struct AvatarView: View {
    let kind: AvatarKind
    let name: String
    let colorHex: String
    var emoji: String = Account.defaultEmoji
    var preset: AvatarPreset = .aurora
    var size: CGFloat = 80
    /// Only read for `.photo`; passing it in keeps this view pure.
    var photo: UIImage? = nil

    var body: some View {
        content
            .frame(width: size, height: size)
            .clipShape(Circle())
            .accessibilityLabel("Avatar for \(name)")
    }

    @ViewBuilder
    private var content: some View {
        switch kind {
        case .initials:
            circle {
                Text(Account.initials(from: name))
                    .font(.system(size: size * 0.4, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.5)
            }

        case .emoji:
            circle {
                Text(emoji)
                    .font(.system(size: size * 0.52))
                    .minimumScaleFactor(0.5)
            }

        case .preset:
            if let image = preset.image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                circle {
                    Text(Account.initials(from: name))
                        .font(.system(size: size * 0.4, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                }
            }

        case .photo:
            if let photo {
                Image(uiImage: photo)
                    .resizable()
                    .scaledToFill()
            } else {
                // No photo chosen yet — fall back rather than showing a hole.
                circle {
                    Text(Account.initials(from: name))
                        .font(.system(size: size * 0.4, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                }
            }
        }
    }

    private func circle<Content: View>(@ViewBuilder _ inner: () -> Content) -> some View {
        Circle()
            .fill(Color(hex: colorHex))
            .overlay { inner() }
    }

    /// The avatar baked into a `UIImage` for `.tabItem`, which accepts only
    /// Label/Image/Text and can't take an arbitrary view.
    ///
    /// `.alwaysOriginal` on the `UIImage` is what stops the tab bar re-tinting
    /// it into a flat silhouette — setting `.renderingMode(.original)` on the
    /// SwiftUI `Image` alone is *not* enough, which is what made an earlier
    /// attempt come out as a solid white blob.
    @MainActor
    static func tabIcon(kind: AvatarKind,
                        name: String,
                        colorHex: String,
                        emoji: String,
                        preset: AvatarPreset,
                        photo: UIImage?,
                        scale: CGFloat,
                        size: CGFloat = 26) -> UIImage? {
        let content = AvatarView(kind: kind,
                                 name: name,
                                 colorHex: colorHex,
                                 emoji: emoji,
                                 preset: preset,
                                 size: size,
                                 photo: photo)

        let renderer = ImageRenderer(content: content)
        // Defaults to 1, which renders a blurry icon on a 2x/3x screen.
        renderer.scale = scale
        return renderer.uiImage?.withRenderingMode(.alwaysOriginal)
    }
}
