"use client";

import { useEffect, useRef, useState } from "react";
import { SOURCE_LABELS, type Priority, type Source, type Todo, type TodoPatch } from "@/lib/types";

const SOURCES: Source[] = ["manual", "messenger", "sms", "email", "other"];
const PRIORITIES: Priority[] = ["low", "normal", "high"];

export function TaskList({
  todos,
  editingId,
  onEdit,
  onToggle,
  onSave,
  onDelete,
}: {
  todos: Todo[];
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onToggle: (todo: Todo) => void;
  onSave: (todo: Todo, patch: TodoPatch) => Promise<void>;
  onDelete: (todo: Todo) => void;
}) {
  if (todos.length === 0) return null;
  return (
    <ul className="tasks">
      {todos.map((todo) => (
        <TaskRow
          key={todo.id}
          todo={todo}
          editing={editingId === todo.id}
          onEdit={onEdit}
          onToggle={onToggle}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function TaskRow({
  todo,
  editing,
  onEdit,
  onToggle,
  onSave,
  onDelete,
}: {
  todo: Todo;
  editing: boolean;
  onEdit: (id: string | null) => void;
  onToggle: (todo: Todo) => void;
  onSave: (todo: Todo, patch: TodoPatch) => Promise<void>;
  onDelete: (todo: Todo) => void;
}) {
  const done = todo.completedAt !== null;
  const overdue = !done && todo.dueOn !== null && isOverdue(todo.dueOn);

  return (
    <li className={done ? "task is-done" : "task"}>
      <input
        type="checkbox"
        checked={done}
        onChange={() => onToggle(todo)}
        aria-label={done ? `Mark “${todo.title}” open` : `Mark “${todo.title}” done`}
      />
      {editing ? (
        <EditForm todo={todo} onCancel={() => onEdit(null)} onSave={(patch) => onSave(todo, patch)} />
      ) : (
        <>
          <div className="task-body">
            <p className="task-title">{todo.title}</p>
            {todo.notes ? <p className="task-notes">{todo.notes}</p> : null}
            <p className="task-meta">
              <span>{SOURCE_LABELS[todo.source]}</span>
              {todo.dueOn ? (
                <span className={overdue ? "is-overdue" : undefined}>
                  {overdue ? "Overdue" : "Due"} {formatDue(todo.dueOn)}
                </span>
              ) : null}
              {todo.priority !== "normal" ? <span className={`priority priority-${todo.priority}`}>{labelPriority(todo.priority)}</span> : null}
            </p>
          </div>
          <div className="task-actions">
            <button type="button" onClick={() => onEdit(todo.id)}>
              Edit
            </button>
            <button type="button" onClick={() => onDelete(todo)}>
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}

function EditForm({
  todo,
  onCancel,
  onSave,
}: {
  todo: Todo;
  onCancel: () => void;
  onSave: (patch: TodoPatch) => Promise<void>;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(todo.title);
  const [notes, setNotes] = useState(todo.notes);
  const [source, setSource] = useState<Source>(todo.source);
  const [priority, setPriority] = useState<Priority>(todo.priority);
  const [dueOn, setDueOn] = useState(todo.dueOn ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        title,
        notes,
        source,
        priority,
        dueOn: dueOn || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="edit-form" onSubmit={submit}>
      <label>
        Task
        <input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={280} required />
      </label>
      <label>
        Note
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={4000} rows={3} />
      </label>
      <div className="edit-grid">
        <label>
          Source
          <select value={source} onChange={(event) => setSource(event.target.value as Source)}>
            {SOURCES.map((value) => (
              <option key={value} value={value}>
                {SOURCE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {labelPriority(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Due
          <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
        </label>
      </div>
      <div className="task-actions">
        <button className="stamp" type="submit" disabled={saving || title.trim() === ""}>
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function labelPriority(priority: Priority): string {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Normal";
}

function formatDue(dueOn: string): string {
  const [year, month, day] = dueOn.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function isOverdue(dueOn: string): boolean {
  const [year, month, day] = dueOn.split("-").map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}
