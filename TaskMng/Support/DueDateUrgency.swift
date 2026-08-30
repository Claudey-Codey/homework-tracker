import SwiftUI

/// Sections the Assignments dashboard groups items into.
enum DueSection: Int, CaseIterable, Identifiable {
    case overdue, thisWeek, later, done

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .overdue:  return "Overdue"
        case .thisWeek: return "This Week"
        case .later:    return "Later"
        case .done:     return "Completed"
        }
    }
}

func dueSection(for assignment: Assignment, now: Date = Date()) -> DueSection {
    if assignment.isDone { return .done }
    if assignment.dueDate < now { return .overdue }
    if let weekEnd = Calendar.current.date(byAdding: .day, value: 7, to: now),
       assignment.dueDate <= weekEnd {
        return .thisWeek
    }
    return .later
}

/// Red when overdue, orange when due within two days, muted otherwise.
func urgencyColor(for date: Date, isDone: Bool, now: Date = Date()) -> Color {
    if isDone { return .secondary }
    if date < now { return .red }
    if let soon = Calendar.current.date(byAdding: .day, value: 2, to: now), date <= soon {
        return .orange
    }
    return .primary
}
