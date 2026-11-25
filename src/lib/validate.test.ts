import assert from "node:assert/strict";
import test from "node:test";
import { parseCreateBody, parsePatch } from "./validate";

test("parses a single task and a batch", () => {
  assert.deepEqual(parseCreateBody({ title: "  Call   Minh  ", priority: "high" }), [
    {
      title: "Call Minh",
      notes: "",
      source: "manual",
      priority: "high",
      dueOn: null,
      completed: false,
    },
  ]);

  const batch = parseCreateBody({
    items: [
      { title: "Order filters", source: "sms", dueOn: "2026-11-28" },
      { title: "Reply to Ada", source: "email", notes: "Colour options" },
    ],
  });
  assert.equal(Array.isArray(batch), true);
  if (!Array.isArray(batch)) return;
  assert.equal(batch[0]?.dueOn, "2026-11-28");
  assert.equal(batch[1]?.source, "email");
  assert.equal(batch[1]?.notes, "Colour options");
});

test("rejects empty titles, bad dates, and oversized batches", () => {
  assert.equal(parseCreateBody({ title: "   " }), "Each task needs a title.");
  assert.equal(parseCreateBody({ title: "Call", dueOn: "2026-02-31" }), "Due date must be a real calendar date.");
  assert.equal(parseCreateBody({ title: "Call", source: "slack" }), "Unknown source.");
  assert.equal(
    parseCreateBody({ items: Array.from({ length: 41 }, () => ({ title: "Task" })) }),
    "Add up to 40 tasks at a time.",
  );
});

test("parses a partial update", () => {
  assert.deepEqual(parsePatch({ completed: true }), { completed: true });
  assert.equal(parsePatch({}), "Nothing to update.");
  assert.equal(parsePatch({ notes: 12 }), "Notes are too long.");
  assert.deepEqual(parsePatch({ dueOn: "" }), { dueOn: null });
});
