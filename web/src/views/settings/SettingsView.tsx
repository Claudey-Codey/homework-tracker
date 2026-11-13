import { checkOn } from "../../support/feedback";
import { keys, useSetting } from "../../support/settings";
import { accents, appearances, defaultAccentHex, type ThemeAppearance } from "../../support/theme";
import { HalfCircleIcon, MoonIcon, SunIcon } from "../../ui/icons";
import { List, Section } from "../../ui/List";
import { Screen } from "../../ui/NavStack";
import { Swatches } from "../../ui/Swatches";
import { ToggleRow } from "../../ui/Toggle";

export function SettingsView() {
  const [accentHex, setAccentHex] = useSetting(keys.accent, defaultAccentHex);
  const [appearance, setAppearance] = useSetting<ThemeAppearance>(keys.appearance, "system");
  const [feedbackEnabled, setFeedbackEnabled] = useSetting(keys.feedbackEnabled, true);
  const [showTabLabels, setShowTabLabels] = useSetting(keys.showTabLabels, true);

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
      </List>
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
