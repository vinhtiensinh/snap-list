"use client";

import { useState } from "react";
import type { Priority, TodoInput } from "@/lib/types";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

export function Composer({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (item: TodoInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.replace(/\s+/g, " ").trim();
    if (!trimmed) return;
    try {
      await onAdd({
        title: trimmed,
        notes: "",
        source: "manual",
        priority,
        dueOn: dueOn || null,
        completed: false,
      });
    } catch {
      return;
    }
    setTitle("");
    setDueOn("");
    setPriority("normal");
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-row">
        <label className="sr-only" htmlFor="task-title">
          Task
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs doing?"
          maxLength={280}
          autoComplete="off"
          required
        />
        <button className="stamp" type="submit" disabled={disabled || title.trim() === ""}>
          Add
        </button>
      </div>
      <div className="composer-meta">
        <label>
          Due
          <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
        </label>
        <label>
          Priority
          <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </form>
  );
}
