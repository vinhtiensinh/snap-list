import { json, readJson, readViewer, rejectCrossSite } from "@/lib/viewer";
import { clearCompleted, createTodos, listTodos } from "@/lib/todos";
import { parseCreateBody } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await readViewer(request);
  if (viewer instanceof Response) return viewer;
  try {
    const todos = await listTodos(viewer.sub, viewer.stage);
    return json({ todos });
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const viewer = await readViewer(request);
  if (viewer instanceof Response) return viewer;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const items = parseCreateBody(body);
  if (typeof items === "string") return json({ error: items }, 400);
  try {
    const todos = await createTodos(viewer.sub, viewer.stage, items);
    return json({ todos }, 201);
  } catch (error) {
    return failed(error);
  }
}

export async function DELETE(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const viewer = await readViewer(request);
  if (viewer instanceof Response) return viewer;
  const status = new URL(request.url).searchParams.get("status");
  if (status !== "completed") return json({ error: "Nothing to clear." }, 400);
  try {
    const deleted = await clearCompleted(viewer.sub, viewer.stage);
    return json({ deleted });
  } catch (error) {
    return failed(error);
  }
}

function failed(error: unknown): Response {
  console.error(error instanceof Error ? error.message : "todo request failed");
  return json({ error: "Something went wrong with that task." }, 500);
}
