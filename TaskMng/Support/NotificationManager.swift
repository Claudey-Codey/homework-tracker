import Foundation
import UserNotifications

/// Time unit for a reminder lead time. Paired with a count, so a reminder is
/// always "<count> <unit> before" — e.g. 2 hours before, 3 days before.
enum ReminderUnit: String, CaseIterable, Identifiable {
    case minutes, hours, days, weeks

    var id: String { rawValue }

    /// How many counts the wheel offers for this unit. Keeps the choices
    /// sensible: 59 weeks is noise, 59 minutes isn't.
    var maxCount: Int {
        switch self {
        case .minutes: return 59
        case .hours:   return 23
        case .days:    return 30
        case .weeks:   return 8
        }
    }

    var seconds: TimeInterval {
        switch self {
        case .minutes: return 60
        case .hours:   return 3_600
        case .days:    return 86_400
        case .weeks:   return 604_800
        }
    }

    var singular: String {
        switch self {
        case .minutes: return "minute"
        case .hours:   return "hour"
        case .days:    return "day"
        case .weeks:   return "week"
        }
    }

    var plural: String { singular + "s" }

    func name(for count: Int) -> String { count == 1 ? singular : plural }

    /// Lead time in seconds for a given count.
    func offset(count: Int) -> TimeInterval {
        TimeInterval(max(1, count)) * seconds
    }

    /// Full sentence for the current setting, e.g. "2 hours before it's due".
    func summary(count: Int) -> String {
        let n = max(1, count)
        return "\(n) \(name(for: n)) before it's due"
    }
}

/// Central place to request permission and schedule/cancel local reminders.
@MainActor
final class NotificationManager {
    static let shared = NotificationManager()
    private init() {}

    func requestAuthorizationIfNeeded() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
        }
    }

    /// Schedules a one-off notification at `fireDate`. Returns the identifier,
    /// or nil if the fire date is already in the past.
    @discardableResult
    func schedule(title: String,
                  body: String,
                  at fireDate: Date,
                  id: String = UUID().uuidString) async -> String? {
        guard fireDate > Date() else { return nil }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let comps = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute], from: fireDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)

        do {
            try await UNUserNotificationCenter.current().add(request)
            return id
        } catch {
            return nil
        }
    }

    func cancel(ids: [String]) {
        guard !ids.isEmpty else { return }
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: ids)
    }

    func cancel(id: String?) {
        guard let id else { return }
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: [id])
    }
}
