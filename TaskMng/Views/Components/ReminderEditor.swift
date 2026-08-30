import SwiftUI

/// Form rows for an item's reminders — as many as you like. Each is a lead
/// time ("1 week before"); tapping one, or "Add Reminder", opens the two-wheel
/// picker in a sheet. The wheels are 150pt tall, so keeping them out of the
/// list is what makes several reminders fit on screen at once.
/// Drop it inside a `Section`.
struct ReminderEditor: View {
    @Binding var reminders: [DraftReminder]

    @State private var editing: EditTarget?

    /// Which reminder the sheet is editing, if any.
    private enum EditTarget: Identifiable {
        case new
        case existing(DraftReminder)

        var id: String {
            switch self {
            case .new: return "new"
            case .existing(let reminder): return reminder.id.uuidString
            }
        }

        var isNew: Bool {
            if case .new = self { return true }
            return false
        }
    }

    var body: some View {
        ForEach(reminders) { reminder in
            Button {
                editing = .existing(reminder)
            } label: {
                HStack {
                    Image(systemName: "bell.fill")
                        .font(.caption)
                        .foregroundStyle(.tint)
                    Text(reminder.label)
                        .foregroundStyle(.primary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                // Without this the row reads as one big link: a Form button
                // tints its whole label, overriding the primary text above.
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .onDelete { offsets in
            withAnimation { reminders.remove(atOffsets: offsets) }
        }

        Button {
            editing = .new
        } label: {
            Label("Add Reminder", systemImage: "plus.circle.fill")
        }

        .sheet(item: $editing) { target in
            ReminderPickerSheet(
                initial: initialDraft(for: target),
                isNew: target.isNew,
                onSave: { draft in commit(draft, replacing: target) },
                onDelete: target.isNew ? nil : { remove(target) })
        }
    }

    // MARK: Editing

    private func initialDraft(for target: EditTarget) -> DraftReminder {
        switch target {
        case .new:
            // Something already there? Offer a shorter lead time than the
            // closest one, since a second reminder is usually a nearer nudge.
            return suggestion()
        case .existing(let reminder):
            return reminder
        }
    }

    private func suggestion() -> DraftReminder {
        guard let closest = reminders.map(\.offset).min() else {
            return DraftReminder(count: 1, unit: .days)
        }
        if closest > ReminderUnit.days.seconds { return DraftReminder(count: 1, unit: .days) }
        if closest > ReminderUnit.hours.seconds { return DraftReminder(count: 1, unit: .hours) }
        return DraftReminder(count: 30, unit: .minutes)
    }

    private func commit(_ draft: DraftReminder, replacing target: EditTarget) {
        var updated = reminders
        if case .existing(let old) = target {
            updated.removeAll { $0.id == old.id }
        }
        // Two reminders at the same lead time would just fire twice.
        updated.removeAll { $0.offset == draft.offset }
        updated.append(draft)
        // Soonest to fire first, which is the furthest ahead of the due date.
        updated.sort { $0.offset > $1.offset }
        withAnimation { reminders = updated }
    }

    private func remove(_ target: EditTarget) {
        guard case .existing(let reminder) = target else { return }
        withAnimation { reminders.removeAll { $0.id == reminder.id } }
    }
}

/// The two-wheel picker (count + unit) in the style of the Clock app's timer.
private struct ReminderPickerSheet: View {
    @Environment(\.dismiss) private var dismiss

    let initial: DraftReminder
    let isNew: Bool
    let onSave: (DraftReminder) -> Void
    let onDelete: (() -> Void)?

    @State private var count: Int
    @State private var unit: ReminderUnit

    init(initial: DraftReminder,
         isNew: Bool,
         onSave: @escaping (DraftReminder) -> Void,
         onDelete: (() -> Void)?) {
        self.initial = initial
        self.isNew = isNew
        self.onSave = onSave
        self.onDelete = onDelete
        _count = State(initialValue: initial.count)
        _unit = State(initialValue: initial.unit)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 0) {
                        Picker("Amount", selection: $count) {
                            ForEach(1...unit.maxCount, id: \.self) { n in
                                Text("\(n)").tag(n)
                            }
                        }
                        .pickerStyle(.wheel)
                        .frame(maxWidth: .infinity)
                        .clipped()

                        Picker("Unit", selection: $unit) {
                            ForEach(ReminderUnit.allCases) { unit in
                                Text(unit.name(for: count)).tag(unit)
                            }
                        }
                        .pickerStyle(.wheel)
                        .frame(maxWidth: .infinity)
                        .clipped()
                    }
                    .labelsHidden()
                    .frame(height: 150)
                    // Switching to a coarser unit can leave the count out of
                    // range (45 minutes -> weeks, which only offers 1...8).
                    .onChange(of: unit) { _, newUnit in
                        count = min(count, newUnit.maxCount)
                    }
                    .listRowBackground(Color.clear)
                } footer: {
                    Text(unit.summary(count: count))
                        .frame(maxWidth: .infinity, alignment: .center)
                }

                if let onDelete {
                    Section {
                        Button(role: .destructive) {
                            onDelete()
                            dismiss()
                        } label: {
                            Text("Delete Reminder")
                                .frame(maxWidth: .infinity, alignment: .center)
                        }
                    }
                }
            }
            .navigationTitle(isNew ? "Add Reminder" : "Edit Reminder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isNew ? "Add" : "Done") {
                        onSave(DraftReminder(count: count, unit: unit))
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.height(isNew ? 330 : 420), .large])
    }
}
