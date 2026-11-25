import { requireIdentity } from "../../cursor/identity.js";
import type { Stage } from "./types";

const PRIVATE = { "cache-control": "private, no-store" };

export type AppViewer = {
  sub: string;
  name: string;
  stage: Stage;
  kind: "person" | "key";
};

export async function readViewer(request: Request): Promise<AppViewer | Response> {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) {
    const headers = new Headers(identity.headers);
    headers.set("cache-control", "private, no-store");
    return new Response(identity.body, { status: identity.status, headers });
  }
  return {
    sub: identity.sub,
    name: identity.name ?? "",
    stage: identity.stage === "preview" ? "preview" : "production",
    kind: identity.kind === "key" ? "key" : "person",
  };
}

export function rejectCrossSite(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return Response.json({ error: "Cross-site request refused." }, { status: 403, headers: PRIVATE });
  }
  return null;
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE });
}

export async function readJson(request: Request): Promise<unknown | Response> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 100_000) {
    return json({ error: "That request is too large." }, 413);
  }
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    return json({ error: "Send JSON." }, 415);
  }
  try {
    return await request.json();
  } catch {
    return json({ error: "Send JSON." }, 400);
  }
}
