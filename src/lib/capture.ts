import { createHash } from "node:crypto";
import type { Priority, Source } from "./types";

export type PlannedTask = {
  title: string;
  notes: string;
  priority: Priority;
  dueOn: string | null;
};

export type CaptureReader = "openai" | "sample";

export type CapturePlan = {
  source: Exclude<Source, "manual">;
  tasks: PlannedTask[];
  reader: CaptureReader;
};

const TITLE_MAX = 280;
const NOTES_MAX = 4000;
const TASK_MAX = 40;

const SAMPLE_HASHES = {
  messenger: "80eca08cd03bbaeb6f7e221e78bc05c6fdf26780dcb8afe4bda766ac07fa4bc7",
  sms: "e475a06b309fb9fe23b6571cd4326d724c17c63f18052ef5460111a282cadaae",
  email: "98a005e62a0e70b60b14a6a17a761fd4f6df95e650ecea9fe91874ff9eb4df79",
} as const;

export function imageHash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sniffImage(bytes: Buffer, claimed: string): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP" &&
    claimed === "image/webp"
  ) {
    return "image/webp";
  }
  return null;
}

export function capturePrompt(today: string): string {
  return [
    `Today is ${today}.`,
    "Read the screenshot or the pasted message and return JSON only, with this shape:",
    '{"source":"messenger"|"sms"|"email"|"other","tasks":[{"title":string,"notes":string,"priority":"low"|"normal"|"high","dueOn":"YYYY-MM-DD"|null}]}',
    "Create a task only for something the recipient still needs to do.",
    "The title is a short imperative action. Put who asked, and any detail that is not the action, in notes.",
    "Set dueOn from a date in the message. Resolve tomorrow, weekday names, and phrases like before Friday against today. Use null when the message has no date.",
    "Use high only when the message says the task is urgent.",
    "Set source from what is on screen: Messenger, a phone text, or an email.",
    "Skip names on their own, timestamps, delivery receipts, greetings, and signatures.",
    "If nothing needs doing, return an empty tasks array.",
    "Do not invent a task that the message does not ask for, and do not make the screenshot itself a task.",
  ].join(" ");
}

export function parseModelCapture(raw: string): Omit<CapturePlan, "reader"> | string {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return "The model did not return tasks.";
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "The model did not return tasks.";
  }
  const record = value as Record<string, unknown>;
  const source = parseSource(record.source);
  const list = Array.isArray(record.tasks) ? record.tasks : [];
  if (list.length > TASK_MAX) return "The model returned too many tasks.";
  const tasks: PlannedTask[] = [];
  for (const item of list) {
    const task = parseTask(item);
    if (task) tasks.push(task);
  }
  return { source, tasks };
}

export function samplePlan(hashes: string[], today: string): CapturePlan | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || hashes.length === 0) return null;
  const plans = hashes.map((hash) => planForHash(hash, today));
  if (plans.some((plan) => plan === null)) return null;
  const found = plans as CapturePlan[];
  return {
    source: found[0]!.source,
    reader: "sample",
    tasks: found.flatMap((plan) => plan.tasks),
  };
}

function planForHash(hash: string, today: string): CapturePlan | null {
  if (hash === SAMPLE_HASHES.messenger) {
    return {
      source: "messenger",
      reader: "sample",
      tasks: [
        {
          title: "Pick up the brake pads",
          notes: "Sarah Chen asked in Messenger.",
          priority: "normal",
          dueOn: onWeekday(today, 5),
        },
        {
          title: "Be at the hoist for 9am",
          notes: "Sarah Chen said the hoist is booked for 9am.",
          priority: "normal",
          dueOn: null,
        },
      ],
    };
  }
  if (hash === SAMPLE_HASHES.sms) {
    return {
      source: "sms",
      reader: "sample",
      tasks: [
        {
          title: "Order the oil filter",
          notes: "Minh asked by text.",
          priority: "normal",
          dueOn: today,
        },
      ],
    };
  }
  if (hash === SAMPLE_HASHES.email) {
    return {
      source: "email",
      reader: "sample",
      tasks: [
        {
          title: "Prepare a quote for the workshop sign",
          notes: "Email from Ada North.",
          priority: "normal",
          dueOn: null,
        },
        {
          title: "Send the revised quote",
          notes: "Ada North asked for the revised quote.",
          priority: "normal",
          dueOn: onWeekday(today, 4),
        },
      ],
    };
  }
  return null;
}

function onWeekday(today: string, weekday: number): string {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const delta = (weekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function parseSource(value: unknown): Exclude<Source, "manual"> {
  if (value === "messenger" || value === "sms" || value === "email" || value === "other") return value;
  return "other";
}

function parseTask(value: unknown): PlannedTask | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string") return null;
  const title = record.title.replace(/\s+/g, " ").trim();
  if (title.length === 0 || title.length > TITLE_MAX) return null;
  const notes = typeof record.notes === "string" ? record.notes.replace(/\r\n/g, "\n").trim() : "";
  if (notes.length > NOTES_MAX) return null;
  const priority: Priority = record.priority === "low" || record.priority === "high" ? record.priority : "normal";
  return { title, notes, priority, dueOn: parseDue(record.dueOn) };
}

function parseDue(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return value;
}
