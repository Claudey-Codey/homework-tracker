import { useEffect, useState } from "react";
import { accountsAvailable } from "../../support/sync/api";
import {
  createAccount,
  finishSyncing,
  PasskeyCancelled,
  signIn,
  signOut,
  useAccountSession,
  useSyncStatus,
} from "../../support/sync/account";
import { syncNow, type SyncStatus } from "../../support/sync/engine";
import { Alert, Confirm, Prompt } from "../../ui/Alert";
import { CloudAlertIcon, CloudIcon, CloudOffIcon, KeyIcon, PersonAddIcon, SyncIcon } from "../../ui/icons";
import { ButtonRow, Row, Section } from "../../ui/List";
import { useAccount } from "./useAccount";

/// The Account tab's sign-in and sync rows. Signed out, it offers Create
/// Account and Sign In; signed in, it shows how syncing is going and a way
/// to sign out. Hidden when the app was built without an API.
export function SyncSection() {
  const { account, expired } = useAccountSession();
  const { name } = useAccount();
  const status = useSyncStatus();
  const [busy, setBusy] = useState<"create" | "signIn" | "signOut" | null>(null);
  const [askingName, setAskingName] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"signOut" | "signOutUnsynced" | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  if (!accountsAvailable) return null;

  const run = async (kind: NonNullable<typeof busy>, title: string, action: () => Promise<void>) => {
    setBusy(kind);
    try {
      await action();
    } catch (caught) {
      if (!(caught instanceof PasskeyCancelled)) setError({ title, message: (caught as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const startSignOut = () =>
    void run("signOut", "Couldn’t Sign Out", async () => {
      setConfirm((await finishSyncing()) ? "signOut" : "signOutUnsynced");
    });

  const alerts = (
    <>
      <Prompt
        title="Create Account"
        message="Your passkey is saved under this name."
        actionLabel="Continue"
        initialValue={askingName}
        onClose={() => setAskingName(null)}
        onSave={(value) => void run("create", "Couldn’t Create Account", () => createAccount(value))}
      />
      <Confirm
        isPresented={confirm === "signOut"}
        title="Sign Out?"
        message="Your assignments, exams and subjects stay in your account and are removed from this device."
        actionLabel="Sign Out"
        destructive
        onClose={() => setConfirm(null)}
        onConfirm={() => void run("signOut", "Couldn’t Sign Out", signOut)}
      />
      <Confirm
        isPresented={confirm === "signOutUnsynced"}
        title="Some Changes Haven’t Synced"
        message="They can’t reach your account right now. If you sign out, they’ll be lost."
        actionLabel="Sign Out Anyway"
        destructive
        onClose={() => setConfirm(null)}
        onConfirm={() => void run("signOut", "Couldn’t Sign Out", signOut)}
      />
      <Alert title={error?.title ?? ""} message={error?.message ?? null} onClose={() => setError(null)} />
    </>
  );

  if (!account) {
    return (
      <>
        <Section
          separatorInset={52}
          footer={
            expired
              ? "You were signed out. Sign in again to keep syncing."
              : "Keep your assignments, exams and subjects in an account and use them on your other devices. You sign in with a passkey: Face ID or Touch ID, no password."
          }
        >
          {!expired && (
            <ButtonRow
              icon={<PersonAddIcon size={21} />}
              label={busy === "create" ? "Creating Account…" : "Create Account…"}
              onClick={() => busy === null && setAskingName(name)}
            />
          )}
          <ButtonRow
            icon={<KeyIcon size={21} />}
            label={busy === "signIn" ? "Signing In…" : "Sign In with Passkey"}
            onClick={() => busy === null && void run("signIn", "Couldn’t Sign In", signIn)}
          />
        </Section>
        {alerts}
      </>
    );
  }

  return (
    <>
      <Section
        separatorInset={52}
        header="Sync"
        footer={status.state === "error" ? status.message : `Signed in as ${name}. Changes sync on their own.`}
      >
        <Row onClick={() => void syncNow()}>
          <span className="row-icon">{statusIcon(status)}</span>
          <span className="cell-label">{statusLabel(status)}</span>
          <span className="cell-value">
            <LastSynced status={status} />
          </span>
        </Row>
      </Section>
      <Section>
        <button type="button" className="cell tappable destructive" onClick={() => busy === null && startSignOut()}>
          {busy === "signOut" ? "Signing Out…" : "Sign Out"}
        </button>
      </Section>
      {alerts}
    </>
  );
}

function statusIcon(status: SyncStatus) {
  if (status.state === "syncing") return <SyncIcon size={21} className="spinning" />;
  if (status.state === "offline") return <CloudOffIcon size={21} />;
  if (status.state === "error") return <CloudAlertIcon size={21} style={{ color: "var(--red)" }} />;
  return <CloudIcon size={21} />;
}

function statusLabel(status: SyncStatus) {
  if (status.state === "syncing") return "Syncing…";
  if (status.state === "offline") return "Offline";
  if (status.state === "error") return "Couldn’t Sync";
  return status.lastSynced ? "Synced" : "Not Synced Yet";
}

/// "Just now", "5 min ago", or a time — kept current while it's on screen.
function LastSynced({ status }: { status: SyncStatus }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!status.lastSynced || status.state === "syncing") return null;
  const minutes = Math.floor((now - status.lastSynced) / 60_000);
  if (minutes < 1) return <>Just now</>;
  if (minutes < 60) return <>{minutes} min ago</>;
  const date = new Date(status.lastSynced);
  const today = new Date(now).toDateString() === date.toDateString();
  return (
    <>
      {today
        ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
        : date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
    </>
  );
}
