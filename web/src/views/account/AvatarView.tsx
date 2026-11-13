import { initials, presetURL, type AvatarKind } from "../../support/account";

/// The account avatar in whichever form the user picked: initials, an emoji on
/// a coloured circle, one of the bundled presets, or their own photo.
///
/// All inputs are passed in rather than read from storage, so the same view
/// can be used for the tab bar, the profile header and the preset grid.
export function AvatarView({
  kind,
  name,
  colorHex,
  emoji,
  preset,
  photo,
  size = 80,
}: {
  kind: AvatarKind;
  name: string;
  colorHex: string;
  emoji: string;
  preset: string;
  photo: string | null;
  size?: number;
}) {
  const frame: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: colorHex,
  };

  const image = (src: string) => (
    <img src={src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  );

  const text = (content: string, scale: number, rounded: boolean) => (
    <span
      style={{
        fontSize: size * scale,
        fontWeight: rounded ? 600 : undefined,
        fontFamily: rounded ? "var(--font-rounded)" : undefined,
        color: "#fff",
        lineHeight: 1,
        letterSpacing: 0,
      }}
    >
      {content}
    </span>
  );

  let content: React.ReactNode;
  if (kind === "emoji") content = text(emoji, 0.52, false);
  else if (kind === "preset") content = image(presetURL(preset));
  // No photo chosen yet — fall back rather than showing a hole.
  else if (kind === "photo" && photo) content = image(photo);
  else content = text(initials(name), 0.4, true);

  return (
    <span style={frame} role="img" aria-label={`Avatar for ${name}`}>
      {content}
    </span>
  );
}
