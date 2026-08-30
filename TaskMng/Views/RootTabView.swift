import SwiftUI

struct RootTabView: View {
    @AppStorage(AppTheme.accentKey) private var accentHex = AppTheme.defaultAccentHex
    @AppStorage(AppTheme.appearanceKey) private var appearanceRaw = ThemeAppearance.system.rawValue
    @AppStorage(Account.nameKey) private var accountName = Account.defaultName
    @AppStorage(Account.avatarHexKey) private var avatarHex = Account.defaultAvatarHex
    @AppStorage(Account.avatarKindKey) private var kindRaw = AvatarKind.initials.rawValue
    @AppStorage(Account.avatarEmojiKey) private var emoji = Account.defaultEmoji
    @AppStorage(Account.avatarPresetKey) private var presetRaw = AvatarPreset.aurora.rawValue
    @AppStorage(Account.photoVersionKey) private var photoVersion = 0
    @AppStorage(AppTheme.showTabLabelsKey) private var showTabLabels = true

    @Environment(\.displayScale) private var displayScale

    /// Held outside the TabView so it survives the rebuild below.
    @State private var selectedTab = 0

    private var appearance: ThemeAppearance {
        ThemeAppearance(rawValue: appearanceRaw) ?? .system
    }

    /// `.tabItem` only accepts Label/Image/Text, so the avatar is baked into a
    /// UIImage. Reading `photoVersion` here is what refreshes the icon after a
    /// photo change. See `AvatarView.tabIcon`.
    private var avatarTabIcon: UIImage? {
        _ = photoVersion
        return AvatarView.tabIcon(
            kind: AvatarKind(rawValue: kindRaw) ?? .initials,
            name: accountName,
            colorHex: avatarHex,
            emoji: emoji,
            preset: AvatarPreset(rawValue: presetRaw) ?? .aurora,
            photo: AvatarStore.photo,
            scale: displayScale)
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            AssignmentsView()
                .tabItem {
                    Image(systemName: "list.bullet.rectangle")
                    Text("Assignments")
                }
                .tag(0)

            ExamsView()
                .tabItem {
                    Image(systemName: "graduationcap")
                    Text("Exams")
                }
                .tag(1)

            SubjectsView()
                .tabItem {
                    Image(systemName: "books.vertical")
                    Text("Subjects")
                }
                .tag(2)

            AccountView()
                .tabItem {
                    if let avatarTabIcon {
                        Image(uiImage: avatarTabIcon).renderingMode(.original)
                    } else {
                        Image(systemName: "person.crop.circle")
                    }
                    Text("Account")
                }
                .tag(3)
        }
        .tint(Color(hex: accentHex))
        .onChange(of: showTabLabels) { _, show in
            TabBarLabels.apply(hidden: !show)
        }
        .onChange(of: selectedTab) { _, _ in
            // SwiftUI can re-set an item's title when its tab appears.
            TabBarLabels.apply(hidden: !showTabLabels)
        }
        .preferredColorScheme(appearance.colorScheme)
        .task {
            TabBarLabels.apply(hidden: !showTabLabels)
            Feedback.configureAudioSession()
            await NotificationManager.shared.requestAuthorizationIfNeeded()
        }
    }
}
