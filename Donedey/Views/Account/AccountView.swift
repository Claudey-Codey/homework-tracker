import SwiftUI
import SwiftData

/// The "you" tab: profile, a snapshot of your workload, and the way into
/// Settings and account editing.
struct AccountView: View {
    @AppStorage(Account.nameKey) private var name = Account.defaultName
    @AppStorage(Account.avatarHexKey) private var avatarHex = Account.defaultAvatarHex
    @AppStorage(Account.avatarKindKey) private var kindRaw = AvatarKind.initials.rawValue
    @AppStorage(Account.avatarEmojiKey) private var emoji = Account.defaultEmoji
    @AppStorage(Account.avatarPresetKey) private var presetRaw = AvatarPreset.aurora.rawValue
    @AppStorage(Account.photoVersionKey) private var photoVersion = 0

    private var kind: AvatarKind { AvatarKind(rawValue: kindRaw) ?? .initials }
    private var preset: AvatarPreset { AvatarPreset(rawValue: presetRaw) ?? .aurora }
    private var photo: UIImage? { _ = photoVersion; return AvatarStore.photo }

    @Query private var assignments: [Assignment]
    @Query private var exams: [Exam]
    @Query private var subjects: [Subject]

    private var openCount: Int { assignments.count { !$0.isDone } }
    private var doneCount: Int { assignments.count { $0.isDone } }
    private var upcomingExams: Int { exams.count { $0.date >= Date() } }
    private var activeSubjects: Int { subjects.count { $0.isActive } }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(spacing: 12) {
                        AvatarView(kind: kind, name: name, colorHex: avatarHex,
                                   emoji: emoji, preset: preset, size: 88, photo: photo)
                        Text(name)
                            .font(.title2.bold())
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }

                Section("Overview") {
                    HStack(spacing: 0) {
                        StatCell(value: openCount, label: "To do", symbol: "checklist")
                        Divider()
                        StatCell(value: doneCount, label: "Done", symbol: "checkmark.circle")
                        Divider()
                        StatCell(value: upcomingExams, label: "Exams", symbol: "graduationcap")
                        Divider()
                        StatCell(value: activeSubjects, label: "Subjects", symbol: "books.vertical")
                    }
                    .padding(.vertical, 4)
                }

                Section {
                    NavigationLink {
                        EditAccountView()
                    } label: {
                        Label("Edit Account", systemImage: "person.text.rectangle")
                    }

                    NavigationLink {
                        SettingsView()
                    } label: {
                        Label("Settings", systemImage: "gearshape")
                    }
                }
            }
            .navigationTitle("Account")
        }
    }
}

/// One number in the Overview row.
private struct StatCell: View {
    let value: Int
    let label: String
    let symbol: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: symbol)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("\(value)")
                .font(.title3.bold())
                .monospacedDigit()
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value) \(label)")
    }
}
