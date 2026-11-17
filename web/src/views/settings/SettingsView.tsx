import { useState } from "react";
import { pickBackupFile, restoreBackup, shareBackup } from "../../support/backup";
import { checkOn } from "../../support/feedback";
import { keys, useSetting } from "../../support/settings";
import { accents, appearances, defaultAccentHex, type ThemeAppearance } from "../../support/theme";
import { Alert } from "../../ui/Alert";
import { HalfCircleIcon, ImportIcon, MoonIcon, ShareIcon, SunIcon } from "../../ui/icons";
import { ButtonRow, List, Section } from "../../ui/List";
import { Screen } from "../../ui/NavStack";
import { Swatches } from "../../ui/Swatches";
import { ToggleRow } from "../../ui/Toggle";

export function SettingsView() {
  const [accentHex, setAccentHex] = useSetting(keys.accent, defaultAccentHex);
  const [appearance, setAppearance] = useSetting<ThemeAppearance>(keys.appearance, "system");
  const [feedbackEnabled, setFeedbackEnabled] = useSetting(keys.feedbackEnabled, true);
  const [showTabLabels, setShowTabLabels] = useSetting(keys.showTabLabels, true);
  const [backupMessage, setBackupMessage] = useState<{ title: string; message: string } | null>(null);

  const backUp = () =>
    shareBackup().catch(() =>
      setBackupMessage({ title: "Couldn't Back Up", message: "Something went wrong making the backup. Try again." }),
    );

  const restore = () =>
    pickBackupFile(async (file) => {
      try {
        const summary = await restoreBackup(file);
        const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
        setBackupMessage({
          title: "Backup Restored",
          message: `Added ${count(summary.assignments, "assignment")}, ${count(summary.exams, "exam")} and ${count(summary.subjects, "subject")}.`,
        });
      } catch (error) {
        setBackupMessage({ title: "Couldn't Restore", message: (error as Error).message });
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

        <Section
          header="Backup"
          footer="Everything lives on this iPhone, inside the Home Screen app. Removing the app from the Home Screen deletes it, so back up first. Restoring adds the backup's items back and leaves anything already here alone."
        >
          <ButtonRow icon={<ShareIcon size={20} />} label="Back Up Data…" onClick={() => void backUp()} />
          <ButtonRow icon={<ImportIcon size={20} />} label="Restore from Backup…" onClick={restore} />
        </Section>
      </List>

      <Alert
        title={backupMessage?.title ?? ""}
        message={backupMessage?.message ?? null}
        onClose={() => setBackupMessage(null)}
      />
    </Screen>
  );
}

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
