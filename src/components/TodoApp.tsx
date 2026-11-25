"use client";

import { useEffect, useMemo, useState } from "react";
import { createTasks, requestJson } from "@/components/client-api";
import { CapturePanel } from "@/components/CapturePanel";
import { Composer } from "@/components/Composer";
import { TaskList } from "@/components/TaskList";
import { SOURCE_LABELS, type Source, type Todo, type TodoInput, type TodoPatch } from "@/lib/types";

type Filter = "open" | "done" | "all";
type SourceFilter = "all" | Source;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

export function TodoApp({
  initialTodos,
  viewerName,
  loadError,
}: {
  initialTodos: Todo[];
  viewerName: string;
  loadError: boolean;
}) {
  const [todos, setTodos] = useState(initialTodos);
  const [filter, setFilter] = useState<Filter>("open");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(loadError ? "The list didn’t load. Refresh and try again." : "");
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<Todo | null>(null);
  const [armClear, setArmClear] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("shared") === "1" || params.get("shared") === "missed") {
      setCaptureOpen(true);
    }
    if (params.get("shared") === "missed") {
      setError("That share didn’t stay on this device. Install Snaplist, or drop the screenshot here.");
    }
  }, []);

  const openCount = todos.filter((todo) => todo.completedAt === null).length;
  const doneCount = todos.length - openCount;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return todos.filter((todo) => {
      if (filter === "open" && todo.completedAt !== null) return false;
      if (filter === "done" && todo.completedAt === null) return false;
      if (sourceFilter !== "all" && todo.source !== sourceFilter) return false;
      if (!needle) return true;
      return `${todo.title}\n${todo.notes}`.toLowerCase().includes(needle);
    });
  }, [todos, filter, sourceFilter, query]);

  async function addItems(items: TodoInput[], announce = true): Promise<void> {
    setBusy(true);
    setError("");
    try {
      const result = await createTasks(items);
      setTodos((current) => [...result.todos, ...current]);
      if (announce) {
        setFilter("open");
        setMessage(result.todos.length === 1 ? "Task added." : `${result.todos.length} tasks added.`);
        if (narrow) setCaptureOpen(false);
      }
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "Couldn’t add that task.";
      setError(text);
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  async function toggle(todo: Todo) {
    const completed = todo.completedAt === null;
    setTodos((current) =>
      current.map((item) =>
        item.id === todo.id ? { ...item, completedAt: completed ? new Date().toISOString() : null } : item,
      ),
    );
    try {
      const result = await requestJson<{ todo: Todo }>(`/api/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
      setTodos((current) => current.map((item) => (item.id === todo.id ? result.todo : item)));
    } catch (caught) {
      setTodos((current) => current.map((item) => (item.id === todo.id ? todo : item)));
      setError(caught instanceof Error ? caught.message : "Couldn’t update that task.");
    }
  }

  async function save(todo: Todo, patch: TodoPatch) {
    try {
      const result = await requestJson<{ todo: Todo }>(`/api/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setTodos((current) => current.map((item) => (item.id === todo.id ? result.todo : item)));
      setEditingId(null);
      setMessage("Task updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t update that task.");
      throw caught;
    }
  }

  async function remove(todo: Todo) {
    setTodos((current) => current.filter((item) => item.id !== todo.id));
    setEditingId((current) => (current === todo.id ? null : current));
    try {
      await requestJson(`/api/todos/${todo.id}`, { method: "DELETE" });
      setUndo(todo);
      setMessage("Task deleted.");
    } catch (caught) {
      setTodos((current) => [todo, ...current]);
      setError(caught instanceof Error ? caught.message : "Couldn’t delete that task.");
    }
  }

  async function restore() {
    if (!undo) return;
    const todo = undo;
    setUndo(null);
    try {
      await addItems(
        [
          {
            title: todo.title,
            notes: todo.notes,
            source: todo.source,
            priority: todo.priority,
            dueOn: todo.dueOn,
            completed: todo.completedAt !== null,
          },
        ],
        false,
      );
      setFilter(todo.completedAt ? "done" : "open");
      setMessage("Task restored.");
    } catch {
      setError("Couldn’t restore that task.");
    }
  }

  async function clearDone() {
    if (!armClear) {
      setArmClear(true);
      window.setTimeout(() => setArmClear(false), 4000);
      return;
    }
    setArmClear(false);
    const remaining = todos.filter((todo) => todo.completedAt === null);
    setTodos(remaining);
    try {
      await requestJson("/api/todos?status=completed", { method: "DELETE" });
      setMessage("Done tasks cleared.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t clear done tasks.");
      setTodos(todos);
    }
  }

  const sheet = narrow && captureOpen;
  const emptyCopy =
    todos.length === 0
      ? "Nothing on the list yet. Type a task, or clip one from a screenshot."
      : filter === "open" && openCount === 0
        ? "You’re clear. Done tasks are still here if you need them."
        : "No tasks match that.";

  return (
    <div className="shell">
      <a className="skip" href="#tasks">
        Skip to tasks
      </a>
      <header className="topbar">
        <div>
          <p className="wordmark">
            <span className="mark" aria-hidden="true" />
            Snaplist
          </p>
          <p className="tagline">Type a task, or take one from a screenshot of a message.</p>
        </div>
        <p className="who">
          <span>{viewerName}</span>
          <span>
            {openCount} open
          </span>
        </p>
      </header>
      <div className="workspace">
        <main className="list-pane" id="tasks" inert={sheet ? true : undefined}>
          <Composer disabled={busy} onAdd={async (item) => addItems([item])} />
          <div className="filters">
            <div className="tabs" role="group" aria-label="Task status">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                  <span className="count">{item.id === "open" ? openCount : item.id === "done" ? doneCount : todos.length}</span>
                </button>
              ))}
            </div>
            <label className="source-filter">
              <span className="sr-only">Source</span>
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}>
                <option value="all">All sources</option>
                {(Object.keys(SOURCE_LABELS) as Source[]).map((source) => (
                  <option key={source} value={source}>
                    {SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>
            </label>
            <label className="search">
              <span className="sr-only">Search tasks</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                type="search"
              />
            </label>
            {doneCount > 0 ? (
              <button type="button" className="text-button" onClick={() => void clearDone()}>
                {armClear ? `Clear ${doneCount} done` : "Clear done"}
              </button>
            ) : null}
          </div>
          <div aria-live="polite" className="live">
            {error ? <p className="status is-error">{error}</p> : null}
            {message && !error ? <p className="status">{message}</p> : null}
          </div>
          {visible.length === 0 ? <p className="empty">{emptyCopy}</p> : null}
          <TaskList
            todos={visible}
            editingId={editingId}
            onEdit={setEditingId}
            onToggle={(todo) => void toggle(todo)}
            onSave={save}
            onDelete={(todo) => void remove(todo)}
          />
        </main>
        <aside
          className={captureOpen ? "capture-dock is-open" : "capture-dock"}
          role={sheet ? "dialog" : undefined}
          aria-modal={sheet ? true : undefined}
          aria-label={sheet ? "Add from a screenshot" : undefined}
        >
          <CapturePanel onClose={sheet ? () => setCaptureOpen(false) : undefined} onAdd={addItems} />
        </aside>
      </div>
      <button
        type="button"
        className={captureOpen ? "capture-launch stamp is-hidden" : "capture-launch stamp"}
        onClick={() => setCaptureOpen(true)}
      >
        From a screenshot
      </button>
      {undo ? (
        <div className="undo">
          <span>Task deleted.</span>
          <button type="button" onClick={() => void restore()}>
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}
