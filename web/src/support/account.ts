/// The signed-in user — except there is no signing in yet, so this is a single
/// local profile stored alongside the app's other preferences.

export type AvatarKind = "initials" | "emoji" | "preset" | "photo";

export const avatarKinds: { id: AvatarKind; label: string }[] = [
  { id: "initials", label: "Initials" },
  { id: "emoji", label: "Emoji" },
  { id: "preset", label: "Preset" },
  { id: "photo", label: "Photo" },
];

/// The built-in avatar images, under `public/avatars`.
export const avatarPresets = [
  "aurora", "cat", "sunset", "ocean", "mint", "confetti", "violet",
  "nebula", "galaxy", "lava", "forest", "bubbles", "peach",
  "citrus", "candy", "blueprint", "slate",
] as const;

export type AvatarPreset = (typeof avatarPresets)[number];

export const presetURL = (preset: string) => `./avatars/avatar-${preset}.png`;
export const presetLabel = (preset: string) => preset.charAt(0).toUpperCase() + preset.slice(1);

export const defaultName = "Simcha Gora";
/// Indigo, from `accents`.
export const defaultAvatarHex = "#5856D6";
export const defaultEmoji = "📚";

/// First letters of the first two words — "Simcha Gora" → "SG".
export function initials(name: string): string {
  const letters = name
    .split(" ")
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]!.toUpperCase())
    .join("");
  return letters === "" ? "?" : letters;
}

/// Grouped rather than one long wall — enough choice to feel personal
/// without dragging in the full emoji keyboard.
export const emojiGroups: { name: string; emoji: string[] }[] = [
  { name: "Smileys", emoji: [
    "😀", "😄", "😅", "🤣", "🙂", "😊", "😇", "🙃",
    "😉", "😌", "😍", "🤩", "😘", "😜", "🤪", "🤔",
    "🤨", "😐", "😴", "🥱", "😎", "🥳", "🤯", "🥹",
    "😤", "😭", "🤓", "🫠", "🫡", "🤗",
  ] },
  { name: "People", emoji: [
    "👋", "🤙", "✌️", "🤞", "👍", "👏", "🙌", "💪",
    "🧠", "👀", "🦾", "🕺", "💃", "🧑‍🎓", "🧑‍🏫", "🧑‍💻",
  ] },
  { name: "Animals", emoji: [
    "🐱", "🐶", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁",
    "🐸", "🐵", "🐧", "🐦", "🦆", "🦉", "🦄", "🐝",
    "🦋", "🐢", "🐙", "🦕", "🐳", "🐬", "🦈", "🐺",
  ] },
  { name: "School", emoji: [
    "📚", "🎓", "✏️", "📝", "📖", "📐", "📏", "🔬",
    "🔭", "🧪", "🧮", "🖇️", "📎", "📌", "🗂️", "💼",
    "🎒", "🖊️", "🖍️", "📅",
  ] },
  { name: "Sports & Hobbies", emoji: [
    "⚽️", "🏀", "🏈", "⚾️", "🎾", "🏐", "🏓", "🏸",
    "🥊", "🛹", "🏂", "⛷️", "🏊", "🚴", "🎮", "🎲",
    "🎸", "🎹", "🥁", "🎤", "🎧", "🎨", "🎬", "♟️",
  ] },
  { name: "Food", emoji: [
    "🍕", "🍔", "🌮", "🍣", "🍜", "🍩", "🍪", "🎂",
    "🍦", "🍫", "🍓", "🍉", "🍎", "🥑", "🥐", "☕️",
    "🧋", "🥤", "🍿", "🧁",
  ] },
  { name: "Nature", emoji: [
    "🌵", "🌻", "🌸", "🌺", "🍀", "🌴", "🌲", "🍁",
    "🌊", "🔥", "⚡️", "❄️", "🌈", "☀️", "🌙", "⭐️",
    "🌟", "☁️", "🌍", "🌋",
  ] },
  { name: "Symbols", emoji: [
    "🚀", "💡", "💎", "🏆", "🥇", "🎯", "🧩", "🔑",
    "🧿", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤",
    "✨", "💥", "💫", "♾️",
  ] },
];
