import { getIdentity } from "../../cursor/identity.js";
import { TodoApp } from "@/components/TodoApp";
import { listTodos } from "@/lib/todos";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const identity = await getIdentity(await headers());
  if (!identity.verified) {
    return (
      <main className="signed-out">
        <p className="wordmark">
          <span className="mark" aria-hidden="true" />
          Snaplist
        </p>
        <h1>Sign in to open your list.</h1>
        <p>Snaplist keeps each person’s tasks separate.</p>
      </main>
    );
  }

  const stage = identity.stage === "preview" ? "preview" : "production";
  let todos: Awaited<ReturnType<typeof listTodos>> = [];
  let loadError = false;
  try {
    todos = await listTodos(identity.sub, stage);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "todo list failed");
    loadError = true;
  }

  const viewerName = identity.name.trim() || (identity.kind === "key" ? "API key" : "Your list");
  return <TodoApp initialTodos={todos} viewerName={viewerName} loadError={loadError} />;
}
