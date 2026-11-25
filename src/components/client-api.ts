import type { Todo, TodoInput } from "@/lib/types";

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");
  if (init?.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "That didn't work. Try again.");
  }
  return body as T;
}

export function createTasks(items: TodoInput[]): Promise<{ todos: Todo[] }> {
  return requestJson("/api/todos", { method: "POST", body: JSON.stringify({ items }) });
}
