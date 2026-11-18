import UIKit

/// Shows or hides the tab bar's titles on the live `UITabBar`.
///
/// Two things this deliberately avoids:
///
/// * **Rebuilding the TabView** (e.g. `.id(showLabels)`) works, but tears down
///   every tab's `NavigationStack` — toggling the setting from inside Settings
///   would throw you back out to the tab's root.
/// * **A `UIViewControllerRepresentable` inside a tab.** Embedding one anywhere
///   in a tab's subtree makes SwiftUI drop that tab's title entirely, labels-on
///   or not. So the bar is found from the window instead, touching nothing in
///   the view hierarchy.
///
/// Clearing the *title* rather than hiding the text also matters: transparent
/// text (or a `titlePositionAdjustment` nudge) still occupies its line, so the
/// icon stays laid out high as though a label were beneath it. A nil title
/// leaves layout entirely and UIKit centres the icon itself.
@MainActor
enum TabBarLabels {
    private static var savedTitles: [String]?

    static func apply(hidden: Bool, retriesLeft: Int = 8) {
        // Nothing to show and nothing to restore: don't touch the bar at all.
        // Any contact with it costs the SwiftUI-set titles.
        if !hidden && savedTitles == nil { return }

        guard let bar = findTabBar() else {
            // The bar doesn't exist yet on the first pass after launch.
            guard retriesLeft > 0 else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                apply(hidden: hidden, retriesLeft: retriesLeft - 1)
            }
            return
        }
        configure(bar, hidden: hidden)
    }

    private static func configure(_ bar: UITabBar, hidden: Bool) {
        let items = bar.items ?? []
        guard !items.isEmpty else { return }

        if hidden {
            // Only capture while the titles are actually present, so a second
            // pass doesn't record a row of nils.
            if savedTitles?.count != items.count {
                let current = items.compactMap(\.title)
                if current.count == items.count { savedTitles = current }
            }
            for item in items where item.title != nil { item.title = nil }
        } else if let titles = savedTitles, titles.count == items.count {
            for (item, title) in zip(items, titles) { item.title = title }
            savedTitles = nil
        }
        bar.setNeedsLayout()
    }

    private static func findTabBar() -> UITabBar? {
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            for window in windowScene.windows {
                if let bar = firstTabBar(in: window) { return bar }
            }
        }
        return nil
    }

    private static func firstTabBar(in view: UIView) -> UITabBar? {
        if let bar = view as? UITabBar { return bar }
        for subview in view.subviews {
            if let found = firstTabBar(in: subview) { return found }
        }
        return nil
    }
}
