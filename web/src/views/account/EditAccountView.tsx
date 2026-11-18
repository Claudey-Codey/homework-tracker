import { useState } from "react";
import { avatarKinds } from "../../support/account";
import { deleteAccount, useAccountSession } from "../../support/sync/account";
import { Alert, Confirm } from "../../ui/Alert";
import { KeyIcon } from "../../ui/icons";
import { List, Row, Section } from "../../ui/List";
import { Screen, useNavigation } from "../../ui/NavStack";
import { AvatarPickerView } from "./AvatarPickerView";
import { AvatarView } from "./AvatarView";
import { useAccount } from "./useAccount";
import { TextField } from "../../ui/TextField";

/// Edit the profile: name, and a way into the avatar editor. Signed in, it
/// also shows how you sign in and lets you delete the account.
export function EditAccountView() {
  const { push } = useNavigation();
  const { name, setName, kind, avatar } = useAccount();
  const { account } = useAccountSession();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setDeleting(false);
    }
  };

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
            <TextField
              placeholder="Full name"
              value={name}
              autoCapitalize="words"
              autoCorrect="off"
              onChange={(event) => setName(event.target.value)}
            />
          </Row>
        </Section>

        {account && (
          <>
            <Section
              header="Sign-In"
              separatorInset={52}
              footer="Your passkey is in your iCloud Keychain, so your other Apple devices can sign in with it too."
            >
              <Row>
                <span className="row-icon"><KeyIcon size={21} /></span>
                <span className="cell-label">Passkey</span>
                <span className="cell-value">Face ID or Touch ID</span>
              </Row>
            </Section>

            <Section>
              <button
                type="button"
                className="cell tappable destructive"
                onClick={() => !deleting && setConfirmingDelete(true)}
              >
                {deleting ? "Deleting Account…" : "Delete Account"}
              </button>
            </Section>
          </>
        )}
      </List>

      <Confirm
        isPresented={confirmingDelete}
        title="Delete Account?"
        message="Your account and everything in it are deleted from the cloud for good. What’s on this device stays here."
        actionLabel="Delete"
        destructive
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => void removeAccount()}
      />
      <Alert title="Couldn’t Delete Account" message={error} onClose={() => setError(null)} />
    </Screen>
  );
}
