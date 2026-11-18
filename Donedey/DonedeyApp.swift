import SwiftUI
import SwiftData

@main
struct DonedeyApp: App {
    var body: some Scene {
        WindowGroup {
            RootTabView()
        }
        .modelContainer(for: [Subject.self, Assignment.self, Exam.self,
                              ChecklistItem.self, StudyNote.self, Reminder.self,
                              ImageAttachment.self])
    }
}
