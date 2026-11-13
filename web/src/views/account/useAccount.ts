import {
  defaultAvatarHex,
  defaultEmoji,
  defaultName,
  type AvatarKind,
  type AvatarPreset,
} from "../../support/account";
import { useAvatarPhoto } from "../../support/avatarStore";
import { keys, useSetting } from "../../support/settings";

/// The local profile, read from storage in one go.
export function useAccount() {
  const [name, setName] = useSetting(keys.accountName, defaultName);
  const [colorHex, setColorHex] = useSetting(keys.avatarHex, defaultAvatarHex);
  const [kind, setKind] = useSetting<AvatarKind>(keys.avatarKind, "initials");
  const [emoji, setEmoji] = useSetting(keys.avatarEmoji, defaultEmoji);
  const [preset, setPreset] = useSetting<AvatarPreset>(keys.avatarPreset, "aurora");
  const photo = useAvatarPhoto();

  return {
    name, setName,
    colorHex, setColorHex,
    kind, setKind,
    emoji, setEmoji,
    preset, setPreset,
    photo,
    /// Everything `AvatarView` needs.
    avatar: { kind, name, colorHex, emoji, preset, photo },
  };
}
