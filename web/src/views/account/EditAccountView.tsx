import { avatarKinds } from "../../support/account";
import { LockIcon } from "../../ui/icons";
import { List, Row, Section } from "../../ui/List";
import { Screen, useNavigation } from "../../ui/NavStack";
import { AvatarPickerView } from "./AvatarPickerView";
import { AvatarView } from "./AvatarView";
import { useAccount } from "./useAccount";

/// Edit the local profile: name, and a way into the avatar editor.
/// Password is shown for shape only — there is no sign-in yet.
export function EditAccountView() {
  const { push } = useNavigation();
  const { name, setName, kind, avatar } = useAccount();

  return (
    <Screen title="Edit Account">
      <List>
        <Section
          clear
          footer={
            <div style={{ textAlign: "center" }}>
              Currently: {avatarKinds.find((k) => k.id === kind)?.label}
            </div>
          }
        >
          <div className="cell" style={{ flexDirection: "column", gap: 12, padding: "10px 0" }}>
            <AvatarView {...avatar} size={96} />
            <button
              type="button"
              className="subheadline"
              style={{ color: "var(--accent)", fontWeight: 500 }}
              onClick={() => push(<AvatarPickerView />)}
            >
              Edit Avatar
            </button>
          </div>
        </Section>

        <Section header="Name">
          <Row>
            <input
              className="field"
              placeholder="Full name"
              value={name}
              dir="auto"
              autoCapitalize="words"
              autoCorrect="off"
              onChange={(event) => setName(event.target.value)}
            />
          </Row>
        </Section>

        <Section footer="There's no sign-in yet, so the password can't be changed.">
          <Row className="disabled">
            <span className="cell-label">Password</span>
            <span>••••••••</span>
            <LockIcon size={13} strokeWidth={2.4} />
          </Row>
        </Section>
      </List>
    </Screen>
  );
}
