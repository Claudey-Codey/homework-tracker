import SwiftUI
import SwiftData

/// The assignments dashboard: everything you have to hand in, grouped by urgency.
struct AssignmentsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Assignment.dueDate, order: .forward) private var assignments: [Assignment]

    @State private var showingAdd = false
    @State private var editing: Assignment?
    @State private var search = ""

    private var filtered: [Assignment] {
        guard !search.isEmpty else { return assignments }
        return assignments.filter {
            $0.title.localizedCaseInsensitiveContains(search) ||
            ($0.subject?.name.localizedCaseInsensitiveContains(search) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if assignments.isEmpty {
                    ContentUnavailableView {
                        Label("No Assignments", systemImage: "checklist")
                    } description: {
                        Text("Tap + to add your first assignment.")
                    }
                } else {
                    List {
                        ForEach(DueSection.allCases) { section in
                            let items = filtered.filter { dueSection(for: $0) == section }
                            if !items.isEmpty {
                                Section(section.title) {
                                    ForEach(items) { assignment in
                                        AssignmentRow(assignment: assignment)
                                            .contentShape(Rectangle())
                                            .onTapGesture { editing = assignment }
                                            .swipeActions(edge: .trailing) {
                                                Button(role: .destructive) {
                                                    delete(assignment)
                                                } label: {
                                                    Label("Delete", systemImage: "trash")
                                                }
                                            }
                                            .swipeActions(edge: .leading) {
                                                Button {
                                                    assignment.isDone.toggle()
                                                } label: {
                                                    Label(assignment.isDone ? "Undo" : "Done",
                                                          systemImage: assignment.isDone
                                                            ? "arrow.uturn.backward" : "checkmark")
                                                }
                                                .tint(assignment.isDone ? .gray : .green)
                                            }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Assignments")
            .searchable(text: $search, prompt: "Search")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showingAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showingAdd) {
                AssignmentFormView()
            }
            .sheet(item: $editing) { assignment in
                AssignmentFormView(assignment: assignment)
            }
        }
    }

    private func delete(_ assignment: Assignment) {
        NotificationManager.shared.cancel(ids: assignment.notificationIDs)
        context.delete(assignment)
    }
}
