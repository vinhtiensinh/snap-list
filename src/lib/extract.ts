import type { Source } from "./types";

const NOISE = [
  /^(delivered|read|seen|sent|active now|typing\.{0,3}|online|edited|message|messages|messenger|inbox|chats|search|type a message|write a message|text message|imessage)$/i,
  /^\d{1,2}:\d{2}(\s*[ap]m)?$/i,
  /^(today|yesterday|just now|now)$/i,
  /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?$/i,
  /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*[,]?\s+\d{1,2}:\d{2}(\s*[ap]m)?$/i,
  /^[\d\W_]+$/,
  /^\+?\d[\d\s()-]{6,}$/,
];

const HANGING_WORD = /\b(a|an|the|to|for|of|and|or|is|by|that|with|on|in|at|from)$/i;

export function extractCandidates(text: string): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

  for (const line of mergeContinuations(lines).map(tidyLine)) {
    if (line.length < 3 || line.length > 280) continue;
    if (NOISE.some((pattern) => pattern.test(line))) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(line);
  }
  return candidates;
}

function mergeContinuations(lines: string[]): string[] {
  const merged: string[] = [];
  for (const line of lines) {
    const previous = merged.at(-1);
    if (previous && continues(previous, line)) {
      merged[merged.length - 1] = `${previous} ${line}`;
    } else {
      merged.push(line);
    }
  }
  return merged;
}

function continues(previous: string, next: string): boolean {
  if (/[.?!]["']?$/.test(previous)) return false;
  if (/^[a-z]/.test(next)) return true;
  return HANGING_WORD.test(previous);
}

export function preferredChecked(line: string): boolean {
  if (/^(from|to|cc|bcc|sent|date)\s*:/i.test(line)) return false;
  return line.split(" ").filter(Boolean).length >= 4;
}

export function detectSource(text: string): Exclude<Source, "manual"> {
  const haystack = text.toLowerCase();
  if (/\b(messenger|facebook|active now)\b/.test(haystack)) return "messenger";
  if (/\b(gmail|outlook|subject:|unsubscribe)\b/.test(haystack) || /\binbox\b/.test(haystack)) {
    return "email";
  }
  if (/\b(imessage|sms|text message|messages)\b/.test(haystack)) return "sms";
  return "other";
}

function tidyLine(raw: string): string {
  return raw.replace(/^subject:\s*/i, "").trim();
}
