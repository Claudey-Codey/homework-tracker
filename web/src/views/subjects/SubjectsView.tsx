import { useState } from "react";
import { db, deleteSubject, type Subject } from "../../db";
import { newId } from "../../support/id";
import { subjectPalette } from "../../support/theme";
import { ContentUnavailable } from "../../ui/ContentUnavailable";
import { GlassButton } from "../../ui/GlassButton";
import { BooksIcon, emptyIconProps, PlusIcon, TrashIcon } from "../../ui/icons";
import { List, Row, Section } from "../../ui/List";
import { Screen } from "../../ui/NavStack";
import { Sheet, SheetBody, SheetNav, useDismiss } from "../../ui/Sheet";
import { Swatches } from "../../ui/Swatches";
import { SwipeRow } from "../../ui/SwipeRow";
import { Toggle, ToggleRow } from "../../ui/Toggle";
import { useSubjects } from "../useSubjects";

export function SubjectsView() {
  const subjects = useSubjects();
  const [showingAdd, setShowingAdd] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [editMode, setEditMode] = useState(false);
  /// In edit mode, the row whose red minus was tapped and now shows Delete.
  const [confirming, setConfirming] = useState<string | null>(null);

  const isEmpty = subjects.length === 0;

  return (
    <Screen
      title="Subjects"
      large
      plain={isEmpty}
      leading={
        !isEmpty && (
          <GlassButton
            prominent={editMode}
            onClick={() => {
              setEditMode(!editMode);
              setConfirming(null);
            }}
          >
            {editMode ? "Done" : "Edit"}
          </GlassButton>
        )
      }
      trailing={
        <GlassButton onClick={() => setShowingAdd(true)} label="Add Subject">
          <PlusIcon size={24} strokeWidth={2} />
        </GlassButton>
      }
      overlay={
        isEmpty && (
          <ContentUnavailable
            icon={<BooksIcon {...emptyIconProps} />}
            title="No Subjects"
            description="Add the subjects you're taking. They'll show up when you create assignments and exams."
            action={{ label: "Add Subject", onClick: () => setShowingAdd(true) }}
          />
        )
      }
    >
      {!isEmpty && (
        <List>
          <Section
            separatorInset={editMode ? 82 : 42}
            footer="Turn a subject off to hide it from the pickers without deleting its assignments."
          >
            {subjects.map((subject) =>
              editMode ? (
                <Row key={subject.id}>
                  <button
                    type="button"
                    aria-label={`Delete ${subject.name}`}
                    onClick={() => setConfirming(confirming === subject.id ? null : subject.id)}
                    style={{ display: "flex" }}
                  >
                    <MinusCircle rotated={confirming === subject.id} />
                  </button>
                  <SubjectRowContent subject={subject} />
                  {confirming === subject.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                        void deleteSubject(subject.id);
                      }}
                      style={{
                        alignSelf: "stretch",
                        margin: "0 -16px 0 0",
                        padding: "0 18px",
                        background: "var(--red)",
                        color: "#fff",
                      }}
                    >
                      Delete
                    </button>
                  )}
                </Row>
              ) : (
                <SwipeRow
                  key={subject.id}
                  onClick={() => setEditing(subject)}
                  trailing={[
                    {
                      label: "Delete",
                      icon: <TrashIcon size={20} />,
                      color: "var(--red)",
                      onAction: () => void deleteSubject(subject.id),
                    },
                  ]}
                >
                  <SubjectRowContent subject={subject} />
                  <Toggle
                    label={`Taking ${subject.name}`}
                    isOn={subject.isActive}
                    onChange={(isActive) => void db.subjects.update(subject.id, { isActive })}
                  />
                </SwipeRow>
              ),
            )}
          </Section>
        </List>
      )}

      <Sheet item={showingAdd} onClose={() => setShowingAdd(false)}>
        {() => <SubjectForm />}
      </Sheet>
      <Sheet item={editing} onClose={() => setEditing(null)}>
        {(subject) => <SubjectForm subject={subject} />}
      </Sheet>
    </Screen>
  );
}

function SubjectRowContent({ subject }: { subject: Subject }) {
  return (
    <>
      <span
        style={{ width: 14, height: 14, borderRadius: "50%", background: subject.colorHex, flexShrink: 0 }}
      />
      <span
        className="cell-label"
        dir="auto"
        style={{ color: subject.isActive ? undefined : "var(--label-2)", padding: "15px 0" }}
      >
        {subject.name}
      </span>
    </>
  );
}

function MinusCircle({ rotated }: { rotated: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      aria-hidden="true"
      style={{ transform: rotated ? "rotate(-90deg)" : undefined, transition: "transform 0.25s" }}
    >
      <circle cx="11" cy="11" r="11" fill="var(--red)" />
      <rect x="5.5" y="10" width="11" height="2" rx="1" fill="#fff" />
    </svg>
  );
}

/// Add or edit a subject (name, color, active state).
function SubjectForm({ subject }: { subject?: Subject }) {
  const dismiss = useDismiss();
  const [name, setName] = useState(subject?.name ?? "");
  const [colorHex, setColorHex] = useState(subject?.colorHex ?? subjectPalette[0]!);
  const [isActive, setIsActive] = useState(subject?.isActive ?? true);

  const trimmedName = name.trim();

  const save = async () => {
    await db.subjects.put({
      id: subject?.id ?? newId(),
      name: trimmedName,
      colorHex,
      isActive,
      createdAt: subject?.createdAt ?? Date.now(),
    });
    dismiss();
  };

  return (
    <>
      <SheetNav
        title={subject ? "Edit Subject" : "New Subject"}
        leading={<GlassButton onClick={dismiss}>Cancel</GlassButton>}
        trailing={
          <GlassButton prominent disabled={trimmedName === ""} onClick={save}>
            Save
          </GlassButton>
        }
      />
      <SheetBody>
        <List>
          <Section header="Name">
            <Row>
              <input
                className="field"
                placeholder="e.g. Mathematics"
                value={name}
                dir="auto"
                onChange={(event) => setName(event.target.value)}
                enterKeyHint="done"
              />
            </Row>
          </Section>

          <Section header="Color">
            <Row>
              <div style={{ flex: 1 }}>
                <Swatches
                  colors={subjectPalette.map((hex) => ({ hex }))}
                  selected={colorHex}
                  onSelect={setColorHex}
                />
              </div>
            </Row>
          </Section>

          <Section>
            <ToggleRow label="I'm taking this subject" isOn={isActive} onChange={setIsActive} />
          </Section>
        </List>
      </SheetBody>
    </>
  );
}
