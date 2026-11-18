import SwiftUI
import SwiftData

struct ExamsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Exam.date, order: .forward) private var exams: [Exam]

    @State private var showingAdd = false
    @State private var editing: Exam?

    var body: some View {
        NavigationStack {
            Group {
                if exams.isEmpty {
                    ContentUnavailableView {
                        Label("No Exams", systemImage: "graduationcap")
                    } description: {
                        Text("Tap + to add an exam, its date, and what to study.")
                    }
                } else {
                    List {
                        ForEach(exams) { exam in
                            ExamRow(exam: exam)
                                .contentShape(Rectangle())
                                .onTapGesture { editing = exam }
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        delete(exam)
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                        }
                    }
                }
            }
            .navigationTitle("Exams")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showingAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showingAdd) { ExamFormView() }
            .sheet(item: $editing) { ExamFormView(exam: $0) }
        }
    }

    private func delete(_ exam: Exam) {
        NotificationManager.shared.cancel(ids: exam.notificationIDs)
        context.delete(exam)
    }
}

private struct ExamRow: View {
    let exam: Exam

    private var accentColor: Color {
        Color(hex: exam.subject?.colorHex ?? "#8E8E93")
    }

    private var displayTitle: String {
        exam.title.isEmpty ? (exam.subject?.name ?? "Exam") : exam.title
    }

    var body: some View {
        HStack(spacing: 12) {
            Capsule()
                .fill(accentColor)
                .frame(width: 5, height: 40)

            VStack(alignment: .leading, spacing: 4) {
                Text(displayTitle)
                    .font(.headline)

                if let subject = exam.subject, !exam.title.isEmpty {
                    Text(subject.name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if !exam.notes.isEmpty {
                    Label(exam.sortedNotes.map { NoteText.title(of: $0.text) }
                            .joined(separator: " · "),
                          systemImage: "note.text")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                } else if !exam.studyMaterial.isEmpty {
                    Text(exam.studyMaterial)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                let pdfCount = exam.images.filter(\.isPDF).count
                let imageCount = exam.images.count - pdfCount
                if imageCount > 0 {
                    Label(imageCount == 1 ? "1 image" : "\(imageCount) images",
                          systemImage: "photo")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if pdfCount > 0 {
                    Label(pdfCount == 1 ? "1 PDF" : "\(pdfCount) PDFs",
                          systemImage: "doc.richtext")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(exam.date, format: .dateTime.month().day())
                    .font(.subheadline).fontWeight(.semibold)
                    .foregroundStyle(urgencyColor(for: exam.date, isDone: false))
                if exam.hasTime {
                    Text(exam.date, format: .dateTime.hour().minute())
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
