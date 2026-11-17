import SwiftUI

struct AssignmentRow: View {
    let assignment: Assignment

    private var accentColor: Color {
        Color(hex: assignment.subject?.colorHex ?? "#8E8E93")
    }

    var body: some View {
        HStack(spacing: 12) {
            CheckBox(isOn: assignment.isDone, tint: accentColor) {
                assignment.isDone.toggle()
                // Finishing a whole assignment is the bigger moment, so it
                // always gets the fuller cue.
                return assignment.isDone
            }
            .frame(width: 28)

            VStack(alignment: .leading, spacing: 3) {
                Text(assignment.title)
                    .font(.body)
                    .strikethrough(assignment.isDone)
                    .foregroundStyle(assignment.isDone ? .secondary : .primary)

                HStack(spacing: 6) {
                    if let subject = assignment.subject {
                        Text(subject.name)
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(accentColor.opacity(0.18), in: Capsule())
                            .foregroundStyle(accentColor)
                    }

                    if !assignment.checklist.isEmpty {
                        Label("\(assignment.checklistDoneCount)/\(assignment.checklist.count)",
                              systemImage: "checklist")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    if !assignment.notes.isEmpty {
                        Label("\(assignment.notes.count)", systemImage: "note.text")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    if !assignment.images.isEmpty {
                        Label("\(assignment.images.count)", systemImage: "photo")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(assignment.dueDate, format: .dateTime.month().day())
                    .font(.subheadline)
                    .foregroundStyle(urgencyColor(for: assignment.dueDate,
                                                  isDone: assignment.isDone))
                if assignment.hasTime {
                    Text(assignment.dueDate, format: .dateTime.hour().minute())
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
