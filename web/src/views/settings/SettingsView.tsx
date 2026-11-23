import { useEffect, useState } from "react";
import { pickBackupFile, restoreBackup, shareBackup } from "../../support/backup";
import { checkOn } from "../../support/feedback";
import { notificationStatus, sendTestNotification, type NotificationStatus } from "../../support/notifications";
import { keys, useSetting } from "../../support/settings";
import { accents, appearances, defaultAccentHex, type ThemeAppearance } from "../../support/theme";
import { Alert } from "../../ui/Alert";
import { BellFillIcon, HalfCircleIcon, ImportIcon, MoonIcon, ShareIcon, SunIcon } from "../../ui/icons";
import { ButtonRow, List, Section } from "../../ui/List";
import { Screen } from "../../ui/NavStack";
import { Swatches } from "../../ui/Swatches";
import { ToggleRow } from "../../ui/Toggle";

export function SettingsView() {
  const [accentHex, setAccentHex] = useSetting(keys.accent, defaultAccentHex);
  const [appearance, setAppearance] = useSetting<ThemeAppearance>(keys.appearance, "system");
  const [feedbackEnabled, setFeedbackEnabled] = useSetting(keys.feedbackEnabled, true);
  const [showTabLabels, setShowTabLabels] = useSetting(keys.showTabLabels, true);
  const [alertMessage, setAlertMessage] = useState<{ title: string; message: string } | null>(null);
  const [notifications, setNotifications] = useState<NotificationStatus>(notificationStatus);

  // Pick up a change made in the iPhone's Settings while the app was in the
  // background.
  useEffect(() => {
    const refresh = () => setNotifications(notificationStatus());
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  const testNotification = async () => {
    const result = await sendTestNotification();
    setNotifications(notificationStatus());
    if (result === "unsupported") {
      setAlertMessage({ title: "Notifications Not Available", message: notificationFooters.unsupported });
    } else if (result === "denied") {
      setAlertMessage({ title: "Notifications Are Off", message: notificationFooters.denied });
    } else if (result === "failed") {
      setAlertMessage({ title: "Couldn't Send", message: "Something went wrong showing the notification. Try again." });
    }
  };

  const backUp = () =>
    shareBackup().catch(() =>
      setAlertMessage({ title: "Couldn't Back Up", message: "Something went wrong making the backup. Try again." }),
    );

  const restore = () =>
    pickBackupFile(async (file) => {
      try {
        const summary = await restoreBackup(file);
        const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
        setAlertMessage({
          title: "Backup Restored",
          message: `Added ${count(summary.assignments, "assignment")}, ${count(summary.exams, "exam")} and ${count(summary.subjects, "subject")}.`,
        });
      } catch (error) {
        setAlertMessage({ title: "Couldn't Restore", message: (error as Error).message });
      }
    });

  return (
    <Screen title="Settings" large>
      <List>
        <Section header="Appearance">
          <div className="cell" style={{ padding: "8px 16px" }}>
            <AppearancePicker selection={appearance} onChange={setAppearance} />
          </div>
        </Section>

        <Section footer="Turn off to show just the icons along the bottom.">
          <ToggleRow label="Tab Bar Labels" isOn={showTabLabels} onChange={setShowTabLabels} />
        </Section>

        <Section header="Accent Color">
          <div className="cell">
            <div style={{ flex: 1 }}>
              <Swatches colors={accents} selected={accentHex} onSelect={setAccentHex} />
            </div>
          </div>
        </Section>

        <Section footer="Play a click and a tap when you check something off.">
          <ToggleRow
            label="Sounds & Haptics"
            isOn={feedbackEnabled}
            onChange={(enabled) => {
              setFeedbackEnabled(enabled);
              // Play the cue as you switch it on, so it's obvious what you
              // just turned on.
              if (enabled) checkOn();
            }}
          />
        </Section>

        <Section header="Notifications" footer={notificationFooters[notifications]}>
          <ButtonRow
            icon={<BellFillIcon size={20} />}
            label="Send Test Notification"
            onClick={() => void testNotification()}
          />
        </Section>

        <Section
          header="Backup"
          footer="Everything lives on this iPhone, inside the Home Screen app. Removing the app from the Home Screen deletes it, so back up first. Restoring adds the backup's items back and leaves anything already here alone."
        >
          <ButtonRow icon={<ShareIcon size={20} />} label="Back Up Data…" onClick={() => void backUp()} />
          <ButtonRow icon={<ImportIcon size={20} />} label="Restore from Backup…" onClick={restore} />
        </Section>

        <div className="caption secondary" style={{ textAlign: "center", padding: "0 16px 8px" }}>
          Version {__BUILD_COMMIT__} ·{" "}
          {new Date(__BUILD_TIME__).toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </List>

      <Alert
        title={alertMessage?.title ?? ""}
        message={alertMessage?.message ?? null}
        onClose={() => setAlertMessage(null)}
      />
    </Screen>
  );
}

/// What the test does, or why it can't, for each permission state. The
/// unsupported and denied texts double as the alert's message.
const notificationFooters: Record<NotificationStatus, string> = {
  default:
    "Shows a notification on this iPhone right away. The first time, you'll be asked to allow notifications from TaskMng.",
  granted: "Shows a notification on this iPhone right away, to check that TaskMng can send them.",
  denied: "Notifications are turned off for TaskMng. Turn them on in the iPhone's Settings app, under Notifications, then TaskMng.",
  unsupported:
    "Notifications only work in the Home Screen app, on iOS 16.4 or later. In Safari, tap Share, then Add to Home Screen, and open TaskMng from there.",
};

const symbols: Record<ThemeAppearance, React.ReactNode> = {
  system: <HalfCircleIcon size={14} />,
  light: <SunIcon size={14} strokeWidth={2.4} />,
  dark: <MoonIcon size={14} strokeWidth={2.4} fill="currentColor" />,
};

/// A compact pill-shaped light/dark/system switcher — one row tall, with a
/// glass capsule that slides and swells between options.
function AppearancePicker({
  selection,
  onChange,
}: {
  selection: ThemeAppearance;
  onChange: (value: ThemeAppearance) => void;
}) {
  const index = Math.max(0, appearances.findIndex((option) => option.id === selection));
  return (
    <div className="appearance-picker" role="radiogroup" aria-label="Appearance">
      <span className="appearance-slot" style={{ transform: `translateX(${index * 100}%)` }}>
        {/* Keyed by index so the swell replays on every move. */}
        <span key={index} className="appearance-indicator glass" />
      </span>
      {appearances.map((option) => {
        const isSelected = option.id === selection;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={isSelected ? "selected" : ""}
            onClick={() => onChange(option.id)}
          >
            {symbols[option.id]}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
