import SwiftUI
import SwiftData

struct SubjectsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Subject.name) private var subjects: [Subject]

    @State private var showingAdd = false

    var body: some View {
        NavigationStack {
            Group {
                if subjects.isEmpty {
                    ContentUnavailableView {
                        Label("No Subjects", systemImage: "books.vertical")
                    } description: {
                        Text("Add the subjects you're taking. They'll show up when you create assignments and exams.")
                    } actions: {
                        Button("Add Subject") { showingAdd = true }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    List {
                        Section {
                            ForEach(subjects) { subject in
                                SubjectRow(subject: subject)
                            }
                            .onDelete(perform: deleteSubjects)
                        } footer: {
                            Text("Turn a subject off to hide it from the pickers without deleting its assignments.")
                        }
                    }
                }
            }
            .navigationTitle("Subjects")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showingAdd = true } label: { Image(systemName: "plus") }
                }
                if !subjects.isEmpty {
                    ToolbarItem(placement: .topBarLeading) { EditButton() }
                }
            }
            .sheet(isPresented: $showingAdd) { SubjectFormView() }
        }
    }

    private func deleteSubjects(_ offsets: IndexSet) {
        for index in offsets {
            context.delete(subjects[index])
        }
    }
}

private struct SubjectRow: View {
    @Bindable var subject: Subject
    @State private var editing = false

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color(hex: subject.colorHex))
                .frame(width: 14, height: 14)

            Text(subject.name)
                .foregroundStyle(subject.isActive ? .primary : .secondary)

            Spacer()

            Toggle("", isOn: $subject.isActive)
                .labelsHidden()
        }
        .contentShape(Rectangle())
        .onTapGesture { editing = true }
        .sheet(isPresented: $editing) {
            SubjectFormView(subject: subject)
        }
    }
}

/// Add or edit a subject (name, color, active state).
private struct SubjectFormView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    private let existing: Subject?

    @State private var name: String
    @State private var colorHex: String
    @State private var isActive: Bool

    init(subject: Subject? = nil) {
        self.existing = subject
        _name = State(initialValue: subject?.name ?? "")
        _colorHex = State(initialValue: subject?.colorHex ?? SubjectPalette.colors.first!)
        _isActive = State(initialValue: subject?.isActive ?? true)
    }

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("e.g. Mathematics", text: $name)
                }

                Section("Color") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: 12) {
                        ForEach(SubjectPalette.colors, id: \.self) { hex in
                            Circle()
                                .fill(Color(hex: hex))
                                .frame(width: 34, height: 34)
                                .overlay {
                                    if hex == colorHex {
                                        Image(systemName: "checkmark")
                                            .font(.headline)
                                            .foregroundStyle(.white)
                                    }
                                }
                                .onTapGesture { colorHex = hex }
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section {
                    Toggle("I'm taking this subject", isOn: $isActive)
                }
            }
            .navigationTitle(existing == nil ? "New Subject" : "Edit Subject")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.disabled(trimmedName.isEmpty)
                }
            }
        }
    }

    private func save() {
        if let existing {
            existing.name = trimmedName
            existing.colorHex = colorHex
            existing.isActive = isActive
        } else {
            context.insert(Subject(name: trimmedName, isActive: isActive, colorHex: colorHex))
        }
        // Save now so the new subject gets its permanent persistentModelID
        // immediately. The pickers tag rows with the Subject itself, and a
        // model's hash comes from that ID — letting it change later (at
        // autosave) breaks SwiftUI's dictionary and traps at runtime.
        try? context.save()
        dismiss()
    }
}
