import type { Priority, Source, TodoInput, TodoPatch } from "./types";
import { PRIORITIES, SOURCES } from "./types";

const TITLE_MAX = 280;
const NOTES_MAX = 4000;
export const BATCH_MAX = 40;

export function parseCreateBody(value: unknown): TodoInput[] | string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "Each task needs a title.";
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items)) {
    if (record.items.length === 0) return "Choose at least one task.";
    if (record.items.length > BATCH_MAX) return `Add up to ${BATCH_MAX} tasks at a time.`;
    const items: TodoInput[] = [];
    for (const item of record.items) {
      const parsed = parseTodoInput(item);
      if (typeof parsed === "string") return parsed;
      items.push(parsed);
    }
    return items;
  }
  const one = parseTodoInput(record);
  return typeof one === "string" ? one : [one];
}

export function parsePatch(value: unknown): TodoPatch | string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "Nothing to update.";
  }
  const record = value as Record<string, unknown>;
  const patch: TodoPatch = {};
  if ("title" in record) {
    const title = cleanTitle(record.title);
    if (title === null || title === "") return "Each task needs a title.";
    patch.title = title;
  }
  if ("notes" in record) {
    const notes = cleanNotes(record.notes);
    if (notes === null) return "Notes are too long.";
    patch.notes = notes;
  }
  if ("source" in record) {
    const source = parseSource(record.source);
    if (source === null) return "Unknown source.";
    patch.source = source;
  }
  if ("priority" in record) {
    const priority = parsePriority(record.priority);
    if (priority === null) return "Unknown priority.";
    patch.priority = priority;
  }
  if ("dueOn" in record) {
    const due = parseDue(record.dueOn);
    if (typeof due === "string" && due.startsWith("invalid:")) return "Due date must be a real calendar date.";
    patch.dueOn = due;
  }
  if ("completed" in record) {
    if (typeof record.completed !== "boolean") return "Completed must be true or false.";
    patch.completed = record.completed;
  }
  if (Object.keys(patch).length === 0) return "Nothing to update.";
  return patch;
}

function parseTodoInput(value: unknown): TodoInput | string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "Each task needs a title.";
  }
  const record = value as Record<string, unknown>;
  const title = cleanTitle(record.title);
  if (title === null || title === "") return "Each task needs a title.";
  const notes = cleanNotes(record.notes ?? "");
  if (notes === null) return "Notes are too long.";
  if ("source" in record && record.source !== undefined && parseSource(record.source) === null) {
    return "Unknown source.";
  }
  if ("priority" in record && record.priority !== undefined && parsePriority(record.priority) === null) {
    return "Unknown priority.";
  }
  const due = parseDue(record.dueOn ?? null);
  if (typeof due === "string" && due.startsWith("invalid:")) return "Due date must be a real calendar date.";
  let completed = false;
  if ("completed" in record && record.completed !== undefined) {
    if (typeof record.completed !== "boolean") return "Completed must be true or false.";
    completed = record.completed;
  }
  return {
    title,
    notes,
    source: parseSource(record.source) ?? "manual",
    priority: parsePriority(record.priority) ?? "normal",
    dueOn: due,
    completed,
  };
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length > TITLE_MAX) return null;
  return trimmed;
}

function cleanNotes(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  if (trimmed.length > NOTES_MAX) return null;
  return trimmed;
}

function parseSource(value: unknown): Source | null {
  if (value === undefined || value === null || value === "") return "manual";
  return typeof value === "string" && (SOURCES as readonly string[]).includes(value)
    ? (value as Source)
    : null;
}

function parsePriority(value: unknown): Priority | null {
  if (value === undefined || value === null || value === "") return "normal";
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value)
    ? (value as Priority)
    : null;
}

function parseDue(value: unknown): string | null | `invalid:${string}` {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "invalid:format";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "invalid:date";
  }
  return value;
}
