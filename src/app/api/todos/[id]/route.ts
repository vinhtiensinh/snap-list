import { deleteTodo, updateTodo } from "@/lib/todos";
import { json, readJson, readViewer, rejectCrossSite } from "@/lib/viewer";
import { parsePatch } from "@/lib/validate";

export const dynamic = "force-dynamic";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const viewer = await readViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await context.params;
  if (!ID.test(id)) return json({ error: "That task was not found." }, 404);
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const patch = parsePatch(body);
  if (typeof patch === "string") return json({ error: patch }, 400);
  try {
    const todo = await updateTodo(viewer.sub, viewer.stage, id, patch);
    if (!todo) return json({ error: "That task was not found." }, 404);
    return json({ todo });
  } catch (error) {
    return failed(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const viewer = await readViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await context.params;
  if (!ID.test(id)) return json({ error: "That task was not found." }, 404);
  try {
    const deleted = await deleteTodo(viewer.sub, viewer.stage, id);
    if (!deleted) return json({ error: "That task was not found." }, 404);
    return json({ deleted: true });
  } catch (error) {
    return failed(error);
  }
}

function failed(error: unknown): Response {
  console.error(error instanceof Error ? error.message : "todo request failed");
  return json({ error: "Something went wrong with that task." }, 500);
}
