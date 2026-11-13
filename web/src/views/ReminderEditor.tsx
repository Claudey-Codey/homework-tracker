import { useState } from "react";
import type { Reminder } from "../db";
import { newId } from "../support/id";
import {
  maxCount,
  reminderLabel,
  reminderOffset,
  reminderSummary,
  reminderUnits,
  unitName,
  unitSeconds,
  type ReminderUnit,
} from "../support/reminders";
import { GlassButton } from "../ui/GlassButton";
import { BellFillIcon, ChevronRightIcon, PlusCircleFillIcon, TrashIcon } from "../ui/icons";
import { Section } from "../ui/List";
import { Sheet, SheetBody, SheetNav, useDismiss } from "../ui/Sheet";
import { SwipeRow } from "../ui/SwipeRow";
import { Wheel } from "../ui/Wheel";

/// Form rows for an item's reminders — as many as you like. Each is a lead
/// time ("1 week before"); tapping one, or "Add Reminder", opens the two-wheel
/// picker in a sheet. Keeping the wheels out of the list is what makes several
/// reminders fit on screen at once.

type EditTarget = { kind: "new" } | { kind: "existing"; reminder: Reminder };

const offsetOf = (reminder: Reminder) => reminderOffset(reminder.count, reminder.unit);

export function ReminderSection({
  reminders,
  onChange,
}: {
  reminders: Reminder[];
  onChange: (reminders: Reminder[]) => void;
}) {
  const [editing, setEditing] = useState<EditTarget | null>(null);

  /// Something already there? Offer a shorter lead time than the closest one,
  /// since a second reminder is usually a nearer nudge.
  const suggestion = (): Reminder => {
    if (reminders.length === 0) return { id: newId(), count: 1, unit: "days" };
    const closest = Math.min(...reminders.map(offsetOf)) / 1000;
    if (closest > unitSeconds("days")) return { id: newId(), count: 1, unit: "days" };
    if (closest > unitSeconds("hours")) return { id: newId(), count: 1, unit: "hours" };
    return { id: newId(), count: 30, unit: "minutes" };
  };

  const commit = (draft: Reminder, target: EditTarget) => {
    let updated = reminders;
    if (target.kind === "existing") {
      updated = updated.filter((reminder) => reminder.id !== target.reminder.id);
    }
    // Two reminders at the same lead time would just fire twice.
    updated = updated.filter((reminder) => offsetOf(reminder) !== offsetOf(draft));
    // Soonest to fire first, which is the furthest ahead of the due date.
    onChange([...updated, draft].sort((a, b) => offsetOf(b) - offsetOf(a)));
  };

  const remove = (id: string) => onChange(reminders.filter((reminder) => reminder.id !== id));

  return (
    <Section
      header="Reminders"
      footer={
        reminders.length === 0
          ? "Optional. Add as many as you like — a week before, a day before, an hour before."
          : "Tap one to change it, swipe to delete."
      }
    >
      {reminders.map((reminder) => (
        <SwipeRow
          key={reminder.id}
          onClick={() => setEditing({ kind: "existing", reminder })}
          trailing={[
            {
              label: "Delete",
              icon: <TrashIcon size={20} />,
              color: "var(--red)",
              onAction: () => remove(reminder.id),
            },
          ]}
        >
          <span style={{ color: "var(--accent)", display: "flex" }}>
            <BellFillIcon size={15} />
          </span>
          <span className="cell-label">{reminderLabel(reminder.count, reminder.unit)}</span>
          <ChevronRightIcon size={15} strokeWidth={2.6} className="tertiary" />
        </SwipeRow>
      ))}
      <button type="button" className="cell tappable accent" onClick={() => setEditing({ kind: "new" })}>
        <PlusCircleFillIcon size={22} />
        <span className="cell-label">Add Reminder</span>
      </button>

      <Sheet
        item={editing}
        onClose={() => setEditing(null)}
        height={editing?.kind === "existing" ? 430 : 340}
      >
        {(target) => (
          <ReminderPickerSheet
            initial={target.kind === "existing" ? target.reminder : suggestion()}
            isNew={target.kind === "new"}
            onSave={(draft) => commit(draft, target)}
            onDelete={target.kind === "existing" ? () => remove(target.reminder.id) : undefined}
          />
        )}
      </Sheet>
    </Section>
  );
}

/// The two-wheel picker (count + unit) in the style of the Clock app's timer.
function ReminderPickerSheet({
  initial,
  isNew,
  onSave,
  onDelete,
}: {
  initial: Reminder;
  isNew: boolean;
  onSave: (reminder: Reminder) => void;
  onDelete?: () => void;
}) {
  const dismiss = useDismiss();
  const [count, setCount] = useState(initial.count);
  const [unit, setUnit] = useState<ReminderUnit>(initial.unit);

  const counts = Array.from({ length: maxCount[unit] }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const units = reminderUnits.map((u) => ({ value: u, label: unitName(u, count) }));

  return (
    <>
      <SheetNav
        title={isNew ? "Add Reminder" : "Edit Reminder"}
        leading={<GlassButton onClick={dismiss}>Cancel</GlassButton>}
        trailing={
          <GlassButton
            prominent
            onClick={() => {
              onSave({ id: isNew ? initial.id : newId(), count, unit });
              dismiss();
            }}
          >
            {isNew ? "Add" : "Done"}
          </GlassButton>
        }
      />
      <SheetBody>
        <div className="list">
          <Section
            clear
            footer={<div style={{ textAlign: "center" }}>{reminderSummary(count, unit)}</div>}
          >
            <div className="wheels">
              <Wheel label="Amount" items={counts} value={count} onChange={setCount} />
              <Wheel
                label="Unit"
                items={units}
                value={unit}
                onChange={(next) => {
                  setUnit(next);
                  // Switching to a coarser unit can leave the count out of
                  // range (45 minutes -> weeks, which only offers 1...8).
                  setCount((current) => Math.min(current, maxCount[next]));
                }}
              />
            </div>
          </Section>
          {onDelete && (
            <Section>
              <button
                type="button"
                className="cell tappable destructive"
                onClick={() => {
                  onDelete();
                  dismiss();
                }}
              >
                Delete Reminder
              </button>
            </Section>
          )}
        </div>
      </SheetBody>
    </>
  );
}
