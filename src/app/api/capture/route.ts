import { sniffImage } from "@/lib/capture";
import { CaptureError, readScreenshot } from "@/lib/read-screenshot";
import { json, readViewer, rejectCrossSite } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 4_000_000;
const MAX_BODY_BYTES = 12_000_000;

export async function POST(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const viewer = await readViewer(request);
  if (viewer instanceof Response) return viewer;

  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return json({ error: "That screenshot is too large." }, 413);
  }

  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "Send the screenshot as a form." }, 400);

  const today = form.get("today");
  if (typeof today !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return json({ error: "Send today’s date with the screenshot." }, 400);
  }
  const textValue = form.get("text");
  const text = typeof textValue === "string" ? textValue : "";
  const images: { bytes: Buffer; mediaType: string }[] = [];

  for (const entry of form.getAll("image")) {
    if (!(entry instanceof File)) return json({ error: "That file isn’t a screenshot." }, 400);
    if (images.length >= MAX_IMAGES) return json({ error: `Add up to ${MAX_IMAGES} screenshots at a time.` }, 400);
    if (entry.size > MAX_IMAGE_BYTES) return json({ error: "Each screenshot needs to be under 4 MB." }, 413);
    const bytes = Buffer.from(await entry.arrayBuffer());
    const mediaType = sniffImage(bytes, entry.type);
    if (!mediaType) return json({ error: "That file isn’t a screenshot. Choose an image." }, 400);
    images.push({ bytes, mediaType });
  }

  if (images.length === 0 && text.trim() === "") {
    return json({ error: "Add a screenshot or paste the message." }, 400);
  }

  try {
    const plan = await readScreenshot({ images, text, today });
    return json({ source: plan.source, tasks: plan.tasks, reader: plan.reader });
  } catch (error) {
    if (error instanceof CaptureError) return json({ error: error.message }, error.status);
    console.error("capture failed");
    return json({ error: "The model could not read that screenshot. Try again." }, 500);
  }
}
