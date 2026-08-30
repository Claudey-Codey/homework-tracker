import AVFoundation
import UIKit

/// Sound + haptics for ticking things off, behind a single "Sounds & Haptics"
/// switch in Settings (defaulting to on).
///
/// Sounds are bundled `.wav` files played through `AVAudioPlayer` rather than
/// `AudioServicesPlaySystemSound`: the crisp system IDs are keyboard clicks,
/// which iOS refuses to play for anything that isn't a keyboard input view.
@MainActor
enum Feedback {
    static let enabledKey = "feedbackEnabled"

    private static var isEnabled: Bool {
        // `object(forKey:)` so an unset default reads as true, not false.
        UserDefaults.standard.object(forKey: enabledKey) as? Bool ?? true
    }

    // Retained and kept warm. A freshly constructed generator usually no-ops
    // on its first call because the Taptic engine hasn't spun up yet.
    private static let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private static let rigidImpact = UIImpactFeedbackGenerator(style: .rigid)
    private static let notification = UINotificationFeedbackGenerator()

    private static let tickPlayer = player(named: "tick")
    private static let completePlayer = player(named: "complete")

    private static func player(named name: String) -> AVAudioPlayer? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "wav"),
              let player = try? AVAudioPlayer(contentsOf: url) else { return nil }
        player.volume = 0.55
        player.prepareToPlay()
        return player
    }

    /// Called once at launch. `.ambient` keeps the app respectful — it honours
    /// the silent switch and won't interrupt music already playing.
    static func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try? session.setActive(true)
        prepareHaptics()
    }

    static func prepareHaptics() {
        guard isEnabled else { return }
        lightImpact.prepare()
        rigidImpact.prepare()
    }

    static func checkOn() {
        guard isEnabled else { return }
        play(tickPlayer)
        lightImpact.impactOccurred()
        lightImpact.prepare()      // stay warm for the next tap
    }

    static func checkOff() {
        guard isEnabled else { return }
        rigidImpact.impactOccurred(intensity: 0.6)
        rigidImpact.prepare()
    }

    /// Clearing the last item in a to-do list earns a bit more fanfare.
    static func completedAll() {
        guard isEnabled else { return }
        play(completePlayer)
        notification.notificationOccurred(.success)
    }

    private static func play(_ player: AVAudioPlayer?) {
        guard let player else { return }
        player.currentTime = 0     // restart if it's still ringing out
        player.play()
    }
}
