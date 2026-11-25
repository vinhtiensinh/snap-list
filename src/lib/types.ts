export const SOURCES = ["manual", "messenger", "sms", "email", "other"] as const;
export type Source = (typeof SOURCES)[number];

export const PRIORITIES = ["low", "normal", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type Stage = "production" | "preview";

export type Todo = {
  id: string;
  title: string;
  notes: string;
  source: Source;
  priority: Priority;
  dueOn: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TodoInput = {
  title: string;
  notes: string;
  source: Source;
  priority: Priority;
  dueOn: string | null;
  completed: boolean;
};

export type TodoPatch = {
  title?: string;
  notes?: string;
  source?: Source;
  priority?: Priority;
  dueOn?: string | null;
  completed?: boolean;
};

export const SOURCE_LABELS: Record<Source, string> = {
  manual: "Typed",
  messenger: "Messenger",
  sms: "SMS",
  email: "Email",
  other: "Other",
};
