import SwiftUI
import PhotosUI

/// The avatar editor, reached from a row in Edit Account rather than sitting
/// inline — so opening Edit Account doesn't dump every option on screen at once.
struct AvatarPickerView: View {
    @AppStorage(Account.nameKey) private var name = Account.defaultName
    @AppStorage(Account.avatarHexKey) private var avatarHex = Account.defaultAvatarHex
    @AppStorage(Account.avatarKindKey) private var kindRaw = AvatarKind.initials.rawValue
    @AppStorage(Account.avatarEmojiKey) private var emoji = Account.defaultEmoji
    @AppStorage(Account.avatarPresetKey) private var presetRaw = AvatarPreset.aurora.rawValue
    @AppStorage(Account.photoVersionKey) private var photoVersion = 0

    @State private var pickedPhoto: PhotosPickerItem?
    @State private var photoError: String?

    private var kind: AvatarKind { AvatarKind(rawValue: kindRaw) ?? .initials }
    private var preset: AvatarPreset { AvatarPreset(rawValue: presetRaw) ?? .aurora }
    /// Reading `photoVersion` is what makes this refresh after a save.
    private var photo: UIImage? { _ = photoVersion; return AvatarStore.photo }

    private let swatches = [GridItem(.adaptive(minimum: 44), spacing: 14)]
    private let emojiColumns = [GridItem(.adaptive(minimum: 46), spacing: 10)]
    private let presetColumns = [GridItem(.adaptive(minimum: 68), spacing: 14)]

    var body: some View {
        Form {
            Section {
                VStack(spacing: 14) {
                    AvatarView(kind: kind, name: name, colorHex: avatarHex,
                               emoji: emoji, preset: preset, size: 96, photo: photo)

                    Picker("Avatar", selection: $kindRaw) {
                        ForEach(AvatarKind.allCases) { option in
                            Text(option.label).tag(option.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }

            switch kind {
            case .initials:  initialsSection
            case .emoji:     emojiSection
            case .preset:    presetSection
            case .photo:     photoSection
            }
        }
        .navigationTitle("Avatar")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: pickedPhoto) { _, item in
            guard let item else { return }
            Task { await load(item) }
        }
        .alert("Couldn't Use That Photo",
               isPresented: Binding(get: { photoError != nil },
                                    set: { if !$0 { photoError = nil } })) {
            Button("OK", role: .cancel) { photoError = nil }
        } message: {
            Text(photoError ?? "")
        }
    }

    // MARK: Per-kind editors

    private var initialsSection: some View {
        Section {
            colorGrid
        } header: {
            Text("Background")
        } footer: {
            Text("Your initials come from your name — \(Account.initials(from: name)).")
        }
    }

    private var emojiSection: some View {
        Group {
            Section("Background") {
                colorGrid
            }

            ForEach(Account.emojiGroups, id: \.name) { group in
                Section(group.name) {
                    LazyVGrid(columns: emojiColumns, spacing: 10) {
                        ForEach(group.emoji, id: \.self) { choice in
                            Button {
                                emoji = choice
                            } label: {
                                Text(choice)
                                    .font(.system(size: 28))
                                    .frame(width: 46, height: 46)
                                    .background(
                                        Circle().fill(choice == emoji
                                                      ? Color.accentColor.opacity(0.25)
                                                      : Color.clear))
                                    .overlay {
                                        Circle()
                                            .strokeBorder(Color.accentColor, lineWidth: 2)
                                            .opacity(choice == emoji ? 1 : 0)
                                    }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
        }
    }

    private var presetSection: some View {
        Section("Presets") {
            LazyVGrid(columns: presetColumns, spacing: 14) {
                ForEach(AvatarPreset.allCases) { option in
                    Button {
                        presetRaw = option.rawValue
                    } label: {
                        VStack(spacing: 6) {
                            AvatarView(kind: .preset, name: name, colorHex: avatarHex,
                                       preset: option, size: 64)
                                .overlay {
                                    Circle()
                                        .strokeBorder(Color.accentColor, lineWidth: 3)
                                        .opacity(option == preset ? 1 : 0)
                                }
                            Text(option.label)
                                .font(.caption2)
                                .foregroundStyle(option == preset ? Color.accentColor : .secondary)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 8)
        }
    }

    private var photoSection: some View {
        Section {
            PhotosPicker(selection: $pickedPhoto, matching: .images) {
                Label(photo == nil ? "Choose Photo" : "Change Photo",
                      systemImage: "photo.on.rectangle")
            }

            if photo != nil {
                Button(role: .destructive) {
                    AvatarStore.remove()
                    photoVersion = AvatarStore.version
                    pickedPhoto = nil
                } label: {
                    Label("Remove Photo", systemImage: "trash")
                }
            }
        } footer: {
            Text("Your photo is stored on this device only.")
        }
    }

    private var colorGrid: some View {
        LazyVGrid(columns: swatches, spacing: 14) {
            ForEach(AppTheme.accents, id: \.hex) { accent in
                Button {
                    avatarHex = accent.hex
                } label: {
                    Circle()
                        .fill(Color(hex: accent.hex))
                        .frame(width: 34, height: 34)
                        .overlay {
                            if accent.hex == avatarHex {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                        }
                        .overlay {
                            Circle()
                                .strokeBorder(Color.primary.opacity(0.4), lineWidth: 2)
                                .padding(-3)
                                .opacity(accent.hex == avatarHex ? 1 : 0)
                        }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(accent.name)
                .accessibilityAddTraits(
                    accent.hex == avatarHex ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(.vertical, 8)
    }

    private func load(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            photoError = "That photo couldn't be loaded."
            return
        }
        guard AvatarStore.save(imageData: data) else {
            photoError = "That file isn't an image we can read."
            return
        }
        // Publishing the new version redraws this view, the Account header and
        // the tab bar icon. Switching kind makes the new photo actually show.
        photoVersion = AvatarStore.version
        kindRaw = AvatarKind.photo.rawValue
    }
}
