import SwiftUI

/// A tappable checkbox that pops, bounces, clicks and taps back when you use it.
/// Used both for whole assignments and for individual to-do items.
struct CheckBox: View {
    let isOn: Bool
    var tint: Color = .accentColor
    var size: Font = .title3
    /// Called inside the animation. Return true if this tick completed the very
    /// last outstanding item, which upgrades the feedback to the "all done" cue.
    let toggle: () -> Bool

    @State private var pop: CGFloat = 1

    var body: some View {
        Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
            .font(size)
            .foregroundStyle(isOn ? Color.green : tint)
            .symbolEffect(.bounce, value: isOn)
            .scaleEffect(pop)
            .contentShape(Circle())
            // High priority so the row's own "tap to edit" gesture doesn't
            // swallow taps aimed at the box.
            .highPriorityGesture(TapGesture().onEnded { tapped() })
            .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }

    private func tapped() {
        let turningOn = !isOn
        var finishedEverything = false

        withAnimation(.spring(response: 0.28, dampingFraction: 0.45)) {
            finishedEverything = toggle()
            pop = 1.35
        }
        // Settle back down a beat later so the overshoot is visible.
        withAnimation(.spring(response: 0.34, dampingFraction: 0.6).delay(0.09)) {
            pop = 1
        }

        if turningOn {
            finishedEverything ? Feedback.completedAll() : Feedback.checkOn()
        } else {
            Feedback.checkOff()
        }
    }
}
