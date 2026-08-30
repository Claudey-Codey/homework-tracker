import SwiftUI

/// Edit the local profile: name, and a way into the avatar editor.
/// Password is shown for shape only — there is no authentication in the app yet.
struct EditAccountView: View {
    @AppStorage(Account.nameKey) private var name = Account.defaultName
    @AppStorage(Account.avatarHexKey) private var avatarHex = Account.defaultAvatarHex
    @AppStorage(Account.avatarKindKey) private var kindRaw = AvatarKind.initials.rawValue
    @AppStorage(Account.avatarEmojiKey) private var emoji = Account.defaultEmoji
    @AppStorage(Account.avatarPresetKey) private var presetRaw = AvatarPreset.aurora.rawValue
    @AppStorage(Account.photoVersionKey) private var photoVersion = 0

    private var kind: AvatarKind { AvatarKind(rawValue: kindRaw) ?? .initials }
    private var preset: AvatarPreset { AvatarPreset(rawValue: presetRaw) ?? .aurora }
    private var photo: UIImage? { _ = photoVersion; return AvatarStore.photo }

    var body: some View {
        Form {
            Section {
                VStack(spacing: 12) {
                    AvatarView(kind: kind, name: name, colorHex: avatarHex,
                               emoji: emoji, preset: preset, size: 96, photo: photo)

                    NavigationLink {
                        AvatarPickerView()
                    } label: {
                        Text("Edit Avatar")
                            .font(.subheadline.weight(.medium))
                    }
                    .fixedSize()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .listRowBackground(Color.clear)
            } footer: {
                Text("Currently: \(kind.label)")
                    .frame(maxWidth: .infinity, alignment: .center)
            }

            Section("Name") {
                TextField("Full name", text: $name)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
            }

            Section {
                HStack {
                    Text("Password")
                    Spacer()
                    Text("••••••••")
                        .foregroundStyle(.secondary)
                    Image(systemName: "lock.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .foregroundStyle(.secondary)
            } footer: {
                Text("There's no sign-in yet, so the password can't be changed.")
            }
        }
        .navigationTitle("Edit Account")
        .navigationBarTitleDisplayMode(.inline)
    }
}
