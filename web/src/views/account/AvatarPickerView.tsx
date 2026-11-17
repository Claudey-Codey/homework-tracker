import { useState } from "react";
import {
  avatarKinds,
  avatarPresets,
  emojiGroups,
  initials,
  presetLabel,
} from "../../support/account";
import { removeAvatarPhoto, saveAvatarPhoto } from "../../support/avatarStore";
import { accents } from "../../support/theme";
import { Alert } from "../../ui/Alert";
import { PhotoStackIcon, TrashIcon } from "../../ui/icons";
import { List, Section } from "../../ui/List";
import { Screen } from "../../ui/NavStack";
import { Segmented } from "../../ui/Pickers";
import { Swatches } from "../../ui/Swatches";
import { AvatarView } from "./AvatarView";
import { useAccount } from "./useAccount";

/// The avatar editor, reached from Edit Account rather than sitting inline —
/// so opening Edit Account doesn't dump every option on screen at once.
export function AvatarPickerView() {
  const account = useAccount();
  const { name, kind, setKind, colorHex, setColorHex, emoji, setEmoji, preset, setPreset, photo, avatar } =
    account;
  const [photoError, setPhotoError] = useState<string | null>(null);

  const colorGrid = (
    <div className="cell">
      <div style={{ flex: 1 }}>
        <Swatches colors={accents} selected={colorHex} onSelect={setColorHex} />
      </div>
    </div>
  );

  const choosePhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (await saveAvatarPhoto(file)) {
        // Switching kind makes the new photo actually show.
        setKind("photo");
      } else {
        setPhotoError("That file isn't an image we can read.");
      }
    };
    input.click();
  };

  return (
    <Screen title="Avatar">
      <List>
        <Section clear>
          <div className="cell" style={{ flexDirection: "column", gap: 14, padding: "8px 0" }}>
            <AvatarView {...avatar} size={96} />
            <Segmented
              value={kind}
              options={avatarKinds.map((k) => ({ value: k.id, label: k.label }))}
              onChange={setKind}
            />
          </div>
        </Section>

        {kind === "initials" && (
          <Section header="Background" footer={`Your initials come from your name — ${initials(name)}.`}>
            {colorGrid}
          </Section>
        )}

        {kind === "emoji" && (
          <>
            <Section header="Background">{colorGrid}</Section>
            {emojiGroups.map((group) => (
              <Section key={group.name} header={group.name}>
                <div className="cell">
                  <div
                    style={{
                      flex: 1,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(46px, 1fr))",
                      gap: 10,
                      padding: "12px 0",
                      justifyItems: "center",
                    }}
                  >
                    {group.emoji.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        aria-pressed={choice === emoji}
                        onClick={() => setEmoji(choice)}
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: "50%",
                          fontSize: 28,
                          lineHeight: 1,
                          background:
                            choice === emoji
                              ? "color-mix(in srgb, var(--accent) 25%, transparent)"
                              : "transparent",
                          boxShadow: choice === emoji ? "inset 0 0 0 2px var(--accent)" : undefined,
                        }}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>
            ))}
          </>
        )}

        {kind === "preset" && (
          <Section header="Presets">
            <div className="cell">
              <div
                style={{
                  flex: 1,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))",
                  gap: 14,
                  padding: "14px 0",
                }}
              >
                {avatarPresets.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={option === preset}
                    onClick={() => setPreset(option)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        borderRadius: "50%",
                        boxShadow: option === preset ? "0 0 0 3px var(--accent)" : undefined,
                      }}
                    >
                      <AvatarView {...avatar} kind="preset" preset={option} size={64} />
                    </span>
                    <span
                      className="caption2"
                      style={{ color: option === preset ? "var(--accent)" : "var(--label-2)" }}
                    >
                      {presetLabel(option)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </Section>
        )}

        {kind === "photo" && (
          <Section footer="Your photo is stored on this device only.">
            <button type="button" className="cell tappable accent" onClick={choosePhoto}>
              <PhotoStackIcon size={21} />
              <span className="cell-label">{photo ? "Change Photo" : "Choose Photo"}</span>
            </button>
            {photo && (
              <button
                type="button"
                className="cell tappable"
                style={{ color: "var(--red)" }}
                onClick={() => void removeAvatarPhoto()}
              >
                <TrashIcon size={21} />
                <span className="cell-label">Remove Photo</span>
              </button>
            )}
          </Section>
        )}
      </List>

      <Alert title="Couldn't Use That Photo" message={photoError} onClose={() => setPhotoError(null)} />
    </Screen>
  );
}
