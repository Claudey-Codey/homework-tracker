import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { db, type Assignment, type ChecklistItem, type Reminder } from "../../db";
import { defaultDueDate, endOfDay } from "../../support/dates";
import { newId } from "../../support/id";
import { commitImages, type DraftImage } from "../../support/images";
import { CheckBox } from "../../ui/CheckBox";
import { GlassButton } from "../../ui/GlassButton";
import { PlusCircleFillIcon, TrashIcon } from "../../ui/icons";
import { List, Row, Section } from "../../ui/List";
import { DateRow, MenuPickerRow, TimeRow } from "../../ui/Pickers";
import { SheetBody, SheetNav, useDismiss } from "../../ui/Sheet";
import { SwipeRow } from "../../ui/SwipeRow";
import { ToggleRow } from "../../ui/Toggle";
import { finalizeNotes, NotesSection, type DraftNote } from "../NotesSection";
import { ReminderSection } from "../ReminderEditor";
import { subjectOptions, useSubjects } from "../useSubjects";

const isBlank = (text: string) => text.trim() === "";

/// Add or edit an assignment. Presented as a sheet.
///
/// Everything is held as drafts in local state and only written on Save, so
/// Cancel really cancels.
export function AssignmentForm({ assignment }: { assignment?: Assignment }) {
  const dismiss = useDismiss();
  const subjects = useSubjects();

  const [title, setTitle] = useState(assignment?.title ?? "");
  const [dueDate, setDueDate] = useState(() =>
    assignment ? new Date(assignment.dueDate) : defaultDueDate(),
  );
  const [hasTime, setHasTime] = useState(assignment?.hasTime ?? false);
  const [subjectId, setSubjectId] = useState(assignment?.subjectId ?? "");
  const [reminders, setReminders] = useState<Reminder[]>(assignment?.reminders ?? []);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(assignment?.checklist ?? []);
  const [newStep, setNewStep] = useState("");
  const [notes, setNotes] = useState<DraftNote[]>(assignment?.notes ?? []);
  const [images, setImages] = useState<DraftImage[]>(assignment?.images ?? []);

  /// Step inputs by id, so Return can move the cursor down the list.
  const stepInputs = useRef(new Map<string, HTMLInputElement>());
  const newStepInput = useRef<HTMLInputElement>(null);

  const trimmedTitle = title.trim();

  /// Blank rows are scratch space while typing — they never count or save.
  const filledSteps = checklist.filter((item) => !isBlank(item.text));

  /// Applies a checklist change and moves the cursor into step `id` in the
  /// same tick. The change is flushed first so a newly inserted row exists to
  /// receive focus, and focusing synchronously — still inside the key press —
  /// is what lets iOS keep the keyboard up rather than closing it.
  const changeAndFocus = (change: (items: ChecklistItem[]) => ChecklistItem[], id: string) => {
    flushSync(() => setChecklist(change));
    stepInputs.current.get(id)?.focus();
  };

  const updateStep = (id: string, change: Partial<ChecklistItem>) => {
    setChecklist((items) => items.map((item) => (item.id === id ? { ...item, ...change } : item)));
  };

  /// Return inside a step drops the cursor into a fresh step below it, so a
  /// whole list can be typed straight through. Return on a blank step ends
  /// the run and clears the leftover row — the way Reminders behaves.
  const advance = (id: string) => {
    const index = checklist.findIndex((item) => item.id === id);
    if (index < 0) return;

    if (isBlank(checklist[index]!.text)) {
      stepInputs.current.get(id)?.blur();
      setChecklist((items) => items.filter((item) => item.id !== id));
      return;
    }

    // Don't stack blank rows if one is already waiting below.
    const below = checklist[index + 1];
    if (below && isBlank(below.text)) {
      stepInputs.current.get(below.id)?.focus();
      return;
    }

    const next: ChecklistItem = { id: newId(), text: "", isDone: false };
    changeAndFocus((items) => [...items.slice(0, index + 1), next, ...items.slice(index + 1)], next.id);
  };

  /// Commits whatever is in "Add a step". Returns the list with it added.
  const withNewStep = (items: ChecklistItem[]) => {
    const text = newStep.trim();
    return text ? [...items, { id: newId(), text, isDone: false }] : items;
  };

  /// Return in the "add a step" field commits it and hands the cursor to a
  /// blank step, so typing can continue without tapping the field again.
  const addStepAndContinue = () => {
    if (isBlank(newStep)) {
      newStepInput.current?.blur();
      return;
    }
    const next: ChecklistItem = { id: newId(), text: "", isDone: false };
    setNewStep("");
    changeAndFocus((items) => [...withNewStep(items), next], next.id);
  };

  const save = async () => {
    // Anything still sitting in the "add a step" field counts as added.
    const steps = withNewStep(checklist)
      .map((item) => ({ ...item, text: item.text.trim() }))
      .filter((item) => item.text !== "");
    const finalDate = hasTime ? dueDate : endOfDay(dueDate);

    const savedImages = await commitImages(images, assignment?.images);
    await db.assignments.put({
      id: assignment?.id ?? newId(),
      title: trimmedTitle,
      dueDate: finalDate.getTime(),
      hasTime,
      isDone: assignment?.isDone ?? false,
      subjectId: subjectId || null,
      checklist: steps,
      notes: finalizeNotes(notes, assignment?.notes),
      images: savedImages,
      reminders,
      createdAt: assignment?.createdAt ?? Date.now(),
    });
    dismiss();
  };

  return (
    <>
      <SheetNav
        title={assignment ? "Edit Assignment" : "New Assignment"}
        leading={<GlassButton onClick={dismiss}>Cancel</GlassButton>}
        trailing={
          <GlassButton prominent disabled={trimmedTitle === ""} onClick={save}>
            Save
          </GlassButton>
        }
      />
      <SheetBody>
        <List>
          <Section header="Details">
            <Row>
              <input
                className="field"
                placeholder="Assignment name"
                value={title}
                dir="auto"
                onChange={(event) => setTitle(event.target.value)}
                enterKeyHint="done"
              />
            </Row>
          </Section>

          <Section header="Subject">
            {subjects.some((subject) => subject.isActive) || subjectId ? (
              <MenuPickerRow
                label="Subject"
                value={subjectId}
                options={subjectOptions(subjects, subjectId)}
                onChange={setSubjectId}
              />
            ) : (
              <Row className="disabled">No subjects yet. Add them in the Subjects tab.</Row>
            )}
          </Section>

          <NotesSection
            header="Content"
            emptyFooter="Optional. Write down what the assignment asks for, or anything you need to remember."
            notes={notes}
            onChange={setNotes}
            images={images}
            onImagesChange={setImages}
          />

          <Section
            header="To-do list"
            separatorInset={54}
            footer={
              filledSteps.length === 0
                ? "Optional. Break the assignment into steps and tick them off."
                : `${filledSteps.filter((item) => item.isDone).length} of ${filledSteps.length} done. Return starts the next step; swipe to delete.`
            }
          >
            {checklist.map((item) => (
              <SwipeRow
                key={item.id}
                trailing={[
                  {
                    label: "Delete",
                    icon: <TrashIcon size={20} />,
                    color: "var(--red)",
                    onAction: () => setChecklist((items) => items.filter((step) => step.id !== item.id)),
                  },
                ]}
              >
                <CheckBox
                  isOn={item.isDone}
                  size={24}
                  toggle={() => {
                    const turningOn = !item.isDone;
                    updateStep(item.id, { isDone: turningOn });
                    // Was this the last one outstanding?
                    return turningOn && checklist.every((step) => step.id === item.id || step.isDone);
                  }}
                />
                <input
                  className="field"
                  placeholder="Step"
                  value={item.text}
                  dir="auto"
                  ref={(el) => {
                    if (el) stepInputs.current.set(item.id, el);
                    else stepInputs.current.delete(item.id);
                  }}
                  enterKeyHint="next"
                  onChange={(event) => updateStep(item.id, { text: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      advance(item.id);
                    }
                  }}
                  style={{
                    textDecoration: item.isDone ? "line-through" : undefined,
                    color: item.isDone ? "var(--label-2)" : undefined,
                  }}
                />
              </SwipeRow>
            ))}
            <Row>
              <span style={{ color: "var(--green)", display: "flex", width: 26, justifyContent: "center" }}>
                <PlusCircleFillIcon size={22} />
              </span>
              <input
                ref={newStepInput}
                className="field"
                placeholder="Add a step"
                value={newStep}
                dir="auto"
                enterKeyHint="next"
                onChange={(event) => setNewStep(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    addStepAndContinue();
                  }
                }}
              />
            </Row>
          </Section>

          <Section header="Due">
            <DateRow label="Due date" value={dueDate} onChange={setDueDate} />
            <ToggleRow label="Set a time" isOn={hasTime} onChange={setHasTime} />
            {hasTime && <TimeRow label="Time" value={dueDate} onChange={setDueDate} />}
          </Section>

          <ReminderSection reminders={reminders} onChange={setReminders} />
        </List>
      </SheetBody>
    </>
  );
}
