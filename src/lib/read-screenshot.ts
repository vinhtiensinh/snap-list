import { capturePrompt, imageHash, parseModelCapture, samplePlan, type CapturePlan } from "./capture";

const MODEL_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

export class CaptureError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function readScreenshot(input: {
  images: { bytes: Buffer; mediaType: string }[];
  text: string;
  today: string;
}): Promise<CapturePlan> {
  const key = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!key) {
    const sample = samplePlan(
      input.images.map((image) => imageHash(image.bytes)),
      input.today,
    );
    if (sample && input.text.trim() === "") return sample;
    throw new CaptureError(
      "Snaplist needs an OpenAI key before it can read that screenshot into tasks.",
      503,
    );
  }

  const content: Array<Record<string, unknown>> = [{ type: "text", text: capturePrompt(input.today) }];
  if (input.text.trim()) content.push({ type: "text", text: input.text.trim().slice(0, 20_000) });
  for (const image of input.images) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${image.mediaType};base64,${image.bytes.toString("base64")}`,
        detail: "high",
      },
    });
  }

  let response: Response;
  try {
    response = await fetch(MODEL_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: modelName(),
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "You turn messages into a to-do list. Reply with JSON only.",
          },
          { role: "user", content },
        ],
      }),
    });
  } catch {
    throw new CaptureError("The model could not be reached. Try the screenshot again.", 502);
  }

  if (!response.ok) {
    throw new CaptureError("The model could not read that screenshot. Try again.", 502);
  }

  const body = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: unknown } }[];
  } | null;
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new CaptureError("The model did not return tasks.", 502);
  }
  const plan = parseModelCapture(text);
  if (typeof plan === "string") throw new CaptureError(plan, 502);
  return { ...plan, reader: "openai" };
}

function modelName(): string {
  const configured = process.env.OPENAI_MODEL?.trim() ?? "";
  return /^[A-Za-z0-9._-]{1,64}$/.test(configured) ? configured : DEFAULT_MODEL;
}
