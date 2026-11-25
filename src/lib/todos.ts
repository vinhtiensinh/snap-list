import { sql } from "./db";
import type { Todo, TodoInput, TodoPatch } from "./types";

type Row = {
  id: string;
  title: string;
  notes: string;
  source: Todo["source"];
  priority: Todo["priority"];
  due_on: unknown;
  completed_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

const RETURNING = `id, title, notes, source, priority, due_on, completed_at, created_at, updated_at`;

export async function listTodos(owner: string, stage: string): Promise<Todo[]> {
  const rows = await sql<Row>(
    `select ${RETURNING}
     from todos
     where owner = $1 and stage = $2
     order by created_at desc
     limit 500`,
    [owner, stage],
  );
  return rows.map(mapTodo);
}

export async function createTodos(owner: string, stage: string, items: TodoInput[]): Promise<Todo[]> {
  const ids = items.map(() => crypto.randomUUID());
  const params: unknown[] = [];
  const values = items.map((item, index) => {
    const base = index * 9;
    params.push(
      ids[index],
      owner,
      stage,
      item.title,
      item.notes,
      item.source,
      item.priority,
      item.dueOn,
      item.completed ? new Date().toISOString() : null,
    );
    const n = base + 1;
    return `($${n}, $${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5}, $${n + 6}, $${n + 7}, $${n + 8})`;
  });
  const rows = await sql<Row>(
    `insert into todos (id, owner, stage, title, notes, source, priority, due_on, completed_at)
     values ${values.join(", ")}
     returning ${RETURNING}`,
    params,
  );
  const byId = new Map(rows.map((row) => [row.id, mapTodo(row)]));
  return ids.map((id) => byId.get(id)).filter((todo): todo is Todo => todo !== undefined);
}

export async function updateTodo(
  owner: string,
  stage: string,
  id: string,
  patch: TodoPatch,
): Promise<Todo | null> {
  const current = await sql<Row>(
    `select ${RETURNING} from todos where id = $1 and owner = $2 and stage = $3`,
    [id, owner, stage],
  );
  const existing = current[0] ? mapTodo(current[0]) : null;
  if (!existing) return null;

  const completedAt =
    patch.completed === true
      ? existing.completedAt ?? new Date().toISOString()
      : patch.completed === false
        ? null
        : existing.completedAt;

  const rows = await sql<Row>(
    `update todos
     set title = $4,
         notes = $5,
         source = $6,
         priority = $7,
         due_on = $8,
         completed_at = $9,
         updated_at = now()
     where id = $1 and owner = $2 and stage = $3
     returning ${RETURNING}`,
    [
      id,
      owner,
      stage,
      patch.title ?? existing.title,
      patch.notes ?? existing.notes,
      patch.source ?? existing.source,
      patch.priority ?? existing.priority,
      patch.dueOn === undefined ? existing.dueOn : patch.dueOn,
      completedAt,
    ],
  );
  return rows[0] ? mapTodo(rows[0]) : null;
}

export async function deleteTodo(owner: string, stage: string, id: string): Promise<boolean> {
  const rows = await sql<{ id: string }>(
    `delete from todos where id = $1 and owner = $2 and stage = $3 returning id`,
    [id, owner, stage],
  );
  return rows.length > 0;
}

export async function clearCompleted(owner: string, stage: string): Promise<number> {
  const rows = await sql<{ id: string }>(
    `delete from todos where owner = $1 and stage = $2 and completed_at is not null returning id`,
    [owner, stage],
  );
  return rows.length;
}

function mapTodo(row: Row): Todo {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    source: row.source,
    priority: row.priority,
    dueOn: dateOnly(row.due_on),
    completedAt: timestamp(row.completed_at),
    createdAt: timestamp(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: timestamp(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function dateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return match ? match[1] : null;
}

function timestamp(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
