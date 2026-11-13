import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type Assignment } from "../../db";
import { dueSection, dueSections } from "../../support/due";
import { ContentUnavailable } from "../../ui/ContentUnavailable";
import { GlassButton } from "../../ui/GlassButton";
import { CheckIcon, ChecklistIcon, emptyIconProps, PlusIcon, TrashIcon, UndoIcon } from "../../ui/icons";
import { List, Section } from "../../ui/List";
import { Screen } from "../../ui/NavStack";
import { Sheet } from "../../ui/Sheet";
import { SwipeRow } from "../../ui/SwipeRow";
import { useSubjectMap } from "../useSubjects";
import { AssignmentForm } from "./AssignmentForm";
import { AssignmentRow } from "./AssignmentRow";

/// The assignments dashboard: everything you have to hand in, grouped by urgency.
export function AssignmentsView() {
  const assignments = useLiveQuery(() => db.assignments.orderBy("dueDate").toArray(), [], undefined);
  const subjects = useSubjectMap();
  const [showingAdd, setShowingAdd] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [search, setSearch] = useState("");

  const query = search.trim().toLocaleLowerCase();
  const filtered = (assignments ?? []).filter((assignment) => {
    if (!query) return true;
    const subjectName = assignment.subjectId ? subjects.get(assignment.subjectId)?.name ?? "" : "";
    return (
      assignment.title.toLocaleLowerCase().includes(query) ||
      subjectName.toLocaleLowerCase().includes(query)
    );
  });

  const isEmpty = assignments !== undefined && assignments.length === 0;

  return (
    <Screen
      title="Assignments"
      large
      plain={isEmpty}
      search={isEmpty ? undefined : { value: search, onChange: setSearch }}
      trailing={
        <GlassButton onClick={() => setShowingAdd(true)} label="Add Assignment">
          <PlusIcon size={24} strokeWidth={2} />
        </GlassButton>
      }
      overlay={
        isEmpty && (
          <ContentUnavailable
            icon={<ChecklistIcon {...emptyIconProps} />}
            title="No Assignments"
            description="Tap + to add your first assignment."
          />
        )
      }
    >
      <List>
        {dueSections.map((section) => {
          const items = filtered.filter((assignment) => dueSection(assignment) === section.id);
          if (items.length === 0) return null;
          return (
            <Section key={section.id} header={section.title} separatorInset={56}>
              {items.map((assignment) => (
                <SwipeRow
                  key={assignment.id}
                  onClick={() => setEditing(assignment)}
                  leading={[
                    {
                      label: assignment.isDone ? "Undo" : "Done",
                      icon: assignment.isDone ? <UndoIcon size={20} /> : <CheckIcon size={22} />,
                      color: assignment.isDone ? "var(--gray)" : "var(--green)",
                      onAction: () => void db.assignments.update(assignment.id, { isDone: !assignment.isDone }),
                    },
                  ]}
                  trailing={[
                    {
                      label: "Delete",
                      icon: <TrashIcon size={20} />,
                      color: "var(--red)",
                      onAction: () => void db.assignments.delete(assignment.id),
                    },
                  ]}
                >
                  <AssignmentRow
                    assignment={assignment}
                    subject={assignment.subjectId ? subjects.get(assignment.subjectId) : undefined}
                  />
                </SwipeRow>
              ))}
            </Section>
          );
        })}
      </List>

      <Sheet item={showingAdd} onClose={() => setShowingAdd(false)}>
        {() => <AssignmentForm />}
      </Sheet>
      <Sheet item={editing} onClose={() => setEditing(null)}>
        {(assignment) => <AssignmentForm assignment={assignment} />}
      </Sheet>
    </Screen>
  );
}
