/// Light / dark / follow-system appearance choice.
export type ThemeAppearance = "system" | "light" | "dark";

export const appearances: { id: ThemeAppearance; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export const defaultAccentHex = "#007AFF";

/// Selectable accent colors. The first one is the default.
export const accents: { name: string; hex: string }[] = [
  { name: "Blue", hex: "#007AFF" },
  { name: "Indigo", hex: "#5856D6" },
  { name: "Purple", hex: "#AF52DE" },
  { name: "Pink", hex: "#FF2D55" },
  { name: "Red", hex: "#FF3B30" },
  { name: "Orange", hex: "#FF9500" },
  { name: "Yellow", hex: "#FFCC00" },
  { name: "Green", hex: "#34C759" },
  { name: "Teal", hex: "#00C7BE" },
  { name: "Brown", hex: "#A2845E" },
];

/// A small, iOS-native palette for tagging subjects with a color.
export const subjectPalette = [
  "#FF3B30", "#FF9500", "#FFCC00", "#34C759",
  "#00C7BE", "#007AFF", "#5856D6", "#AF52DE",
  "#FF2D55", "#A2845E", "#8E8E93",
];

/// Grey used for items with no subject.
export const noSubjectHex = "#8E8E93";

/// "#RRGGBB" plus an alpha, for tinted backgrounds like the subject capsule.
export function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(value)) return `rgba(0, 122, 255, ${alpha})`;
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
