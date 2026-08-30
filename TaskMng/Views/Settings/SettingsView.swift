import SwiftUI

struct SettingsView: View {
    @AppStorage(AppTheme.accentKey) private var accentHex = AppTheme.defaultAccentHex
    @AppStorage(AppTheme.appearanceKey) private var appearanceRaw = ThemeAppearance.system.rawValue
    @AppStorage(Feedback.enabledKey) private var feedbackEnabled = true
    @AppStorage(AppTheme.showTabLabelsKey) private var showTabLabels = true

    private let swatches = [GridItem(.adaptive(minimum: 44), spacing: 14)]

    var body: some View {
        Form {
            Section("Appearance") {
                AppearancePicker(selection: $appearanceRaw)
            }

            Section {
                Toggle("Tab Bar Labels", isOn: $showTabLabels.animation())
            } footer: {
                Text("Turn off to show just the icons along the bottom.")
            }

            Section("Accent Color") {
                LazyVGrid(columns: swatches, spacing: 14) {
                    ForEach(AppTheme.accents, id: \.hex) { accent in
                        Button {
                            accentHex = accent.hex
                        } label: {
                            Circle()
                                .fill(Color(hex: accent.hex))
                                .frame(width: 34, height: 34)
                                .overlay {
                                    if accent.hex == accentHex {
                                        Image(systemName: "checkmark")
                                            .font(.system(size: 14, weight: .bold))
                                            .foregroundStyle(.white)
                                    }
                                }
                                .overlay {
                                    Circle()
                                        .strokeBorder(Color.primary.opacity(0.4), lineWidth: 2)
                                        .padding(-3)
                                        .opacity(accent.hex == accentHex ? 1 : 0)
                                }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(accent.name)
                        .accessibilityAddTraits(
                            accent.hex == accentHex ? [.isButton, .isSelected] : .isButton)
                    }
                }
                .padding(.vertical, 8)
            }

            Section {
                Toggle("Sounds & Haptics", isOn: $feedbackEnabled)
                    .onChange(of: feedbackEnabled) { _, enabled in
                        // Play the cue as you switch it on, so it's obvious
                        // what you just turned on.
                        if enabled { Feedback.checkOn() }
                    }
            } footer: {
                Text("Play a click and a tap when you check something off.")
            }
        }
        // Pushed from Account now, so it inherits tint and colour scheme from
        // RootTabView — no NavigationStack, Done button or preferredColorScheme
        // of its own, all of which existed only because it used to be a sheet.
        .navigationTitle("Settings")
    }
}

/// Horizontal and vertical scale for the selection capsule's swell, animated
/// as a pair by `keyframeAnimator`.
private struct Swell: Equatable {
    var width: CGFloat = 1
    var height: CGFloat = 1
}

/// A compact pill-shaped light/dark/system switcher — one row tall. On iOS 26
/// the selection is a Liquid Glass capsule that fluidly morphs between options;
/// older systems fall back to a plain sliding capsule.
private struct AppearancePicker: View {
    @Binding var selection: String

    private var options: [ThemeAppearance] { ThemeAppearance.allCases }

    private var selectedIndex: Int {
        options.firstIndex { $0.rawValue == selection } ?? 0
    }

    var body: some View {
        GeometryReader { proxy in
            let segmentWidth = proxy.size.width / CGFloat(options.count)

            ZStack(alignment: .leading) {
                // A single indicator living *behind* the whole row. Putting it
                // in each segment's background let the glass layer composite
                // over the label and hide it.
                indicator
                    .frame(width: segmentWidth, height: proxy.size.height)
                    // Swells on the way across and settles back, the way the
                    // tab bar's selection bubble does. Scaling has to sit
                    // *inside* the offset so it anchors on the capsule itself
                    // rather than on its un-offset layout position.
                    .keyframeAnimator(initialValue: Swell(),
                                      trigger: selectedIndex) { view, swell in
                        view.scaleEffect(x: swell.width, y: swell.height)
                    } keyframes: { _ in
                        KeyframeTrack(\.width) {
                            CubicKeyframe(1.18, duration: 0.16)
                            CubicKeyframe(1.0, duration: 0.19)
                        }
                        KeyframeTrack(\.height) {
                            CubicKeyframe(1.12, duration: 0.16)
                            CubicKeyframe(1.0, duration: 0.19)
                        }
                    }
                    .offset(x: segmentWidth * CGFloat(selectedIndex))
                    // Driven off the value, not `withAnimation`: `selection` is
                    // backed by @AppStorage, whose writes land on a later
                    // runloop tick and so escape an animation transaction.
                    .animation(.smooth(duration: 0.35), value: selectedIndex)

                HStack(spacing: 0) {
                    ForEach(options) { option in
                        let isSelected = option.rawValue == selection

                        Button {
                            selection = option.rawValue
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: option.symbol)
                                    .font(.footnote)
                                Text(option.label)
                                    .font(.subheadline)
                            }
                            .fontWeight(isSelected ? .semibold : .regular)
                            .foregroundStyle(isSelected ? Color.primary : Color.secondary)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(
                            isSelected ? [.isButton, .isSelected] : .isButton)
                    }
                }
            }
        }
        .frame(height: 34)
        .padding(3)
        .background(Color.secondary.opacity(0.14), in: Capsule())
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private var indicator: some View {
        if #available(iOS 26.0, *) {
            // Untinted: a tint at full strength reads as a flat colour slab,
            // and over a plain Form row there is nothing for it to refract.
            Capsule()
                .fill(.clear)
                .glassEffect(.regular.interactive(), in: Capsule())
        } else {
            Capsule()
                .fill(Color(uiColor: .systemBackground))
                .shadow(color: .black.opacity(0.15), radius: 1.5, y: 1)
        }
    }
}
