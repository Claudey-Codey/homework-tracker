import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db, type Subject } from "../db";

/// Every subject, sorted by name — `@Query(sort: \Subject.name)`.
export function useSubjects(): Subject[] {
  return useLiveQuery(() => db.subjects.orderBy("name").toArray(), [], []);
}

export function useSubjectMap(): Map<string, Subject> {
  const subjects = useSubjects();
  return useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
}

/// Options for a form's subject picker: "None", then the active subjects.
/// A subject that's since been switched off stays listed while it's the
/// current choice, so editing an old item doesn't show a blank picker.
export function subjectOptions(subjects: Subject[], currentId: string) {
  return [
    { value: "", label: "None" },
    ...subjects
      .filter((subject) => subject.isActive || subject.id === currentId)
      .map((subject) => ({ value: subject.id, label: subject.name })),
  ];
}
