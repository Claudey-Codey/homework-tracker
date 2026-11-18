import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import { ChecklistIcon, GearIcon, GraduationCapIcon, BooksIcon, PersonCardIcon, CheckIcon } from "../../ui/icons";
import { LinkRow, List, Section } from "../../ui/List";
import { Screen, useNavigation } from "../../ui/NavStack";
import { SettingsView } from "../settings/SettingsView";
import { AvatarView } from "./AvatarView";
import { EditAccountView } from "./EditAccountView";
import { SyncSection } from "./SyncSection";
import { useAccount } from "./useAccount";

/// The "you" tab: profile, a snapshot of your workload, and the way into
/// Settings and account editing.
export function AccountView() {
  const { push } = useNavigation();
  const { name, avatar } = useAccount();

  const stats = useLiveQuery(
    async () => {
      const [assignments, exams, subjects] = await Promise.all([
        db.assignments.toArray(),
        db.exams.toArray(),
        db.subjects.toArray(),
      ]);
      const now = Date.now();
      return {
        open: assignments.filter((a) => !a.isDone).length,
        done: assignments.filter((a) => a.isDone).length,
        exams: exams.filter((e) => e.date >= now).length,
        subjects: subjects.filter((s) => s.isActive).length,
      };
    },
    [],
    { open: 0, done: 0, exams: 0, subjects: 0 },
  );

  return (
    <Screen title="Account" large>
      <List>
        <Section clear>
          <div
            className="cell"
            style={{ flexDirection: "column", gap: 12, padding: "12px 0 0" }}
          >
            <AvatarView {...avatar} size={88} />
            <span dir="auto" style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.35 }}>
              {name}
            </span>
          </div>
        </Section>

        <Section header="Overview">
          <div className="cell" style={{ padding: "12px 0", gap: 0 }}>
            <StatCell value={stats.open} label="To do" icon={<ChecklistIcon size={13} strokeWidth={2.2} />} />
            <Divider />
            <StatCell value={stats.done} label="Done" icon={<CheckIcon size={13} strokeWidth={2.6} />} />
            <Divider />
            <StatCell value={stats.exams} label="Exams" icon={<GraduationCapIcon size={13} strokeWidth={2.2} />} />
            <Divider />
            <StatCell value={stats.subjects} label="Subjects" icon={<BooksIcon size={13} strokeWidth={2.2} />} />
          </div>
        </Section>

        <Section separatorInset={52}>
          <LinkRow
            icon={<PersonCardIcon size={21} />}
            label="Edit Account"
            onClick={() => push(<EditAccountView />)}
          />
          <LinkRow icon={<GearIcon size={21} />} label="Settings" onClick={() => push(<SettingsView />)} />
        </Section>

        <SyncSection />
      </List>
    </Screen>
  );
}

function Divider() {
  return <span style={{ width: 1, alignSelf: "stretch", background: "var(--separator)", transform: "scaleX(0.5)" }} />;
}

/// One number in the Overview row.
function StatCell({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  return (
    <div
      aria-label={`${value} ${label}`}
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
    >
      <span className="secondary" style={{ display: "flex" }}>{icon}</span>
      <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span className="caption2 secondary">{label}</span>
    </div>
  );
}
