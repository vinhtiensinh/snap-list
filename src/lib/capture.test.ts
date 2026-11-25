import assert from "node:assert/strict";
import test from "node:test";
import { parseModelCapture, samplePlan } from "./capture";

test("keeps actionable tasks and drops a task with no title", () => {
  const plan = parseModelCapture(
    JSON.stringify({
      source: "messenger",
      tasks: [
        { title: "Pick up the brake pads", notes: "Sarah Chen", priority: "normal", dueOn: "2026-11-27" },
        { title: "   ", notes: "", priority: "high", dueOn: null },
        { title: "Be at the hoist for 9am", notes: "", priority: "urgent", dueOn: "Friday" },
      ],
    }),
  );
  assert.equal(typeof plan, "object");
  if (typeof plan === "string") return;
  assert.equal(plan.source, "messenger");
  assert.deepEqual(plan.tasks, [
    { title: "Pick up the brake pads", notes: "Sarah Chen", priority: "normal", dueOn: "2026-11-27" },
    { title: "Be at the hoist for 9am", notes: "", priority: "normal", dueOn: null },
  ]);
});

test("reads a fenced model reply and ignores an unknown source", () => {
  const plan = parseModelCapture('```json\n{"source":"chat","tasks":[{"title":"Order the oil filter"}]}\n```');
  assert.equal(typeof plan, "object");
  if (typeof plan === "string") return;
  assert.equal(plan.source, "other");
  assert.equal(plan.tasks[0]?.title, "Order the oil filter");
  assert.equal(plan.tasks[0]?.dueOn, null);
});

test("rejects a reply that is not task JSON", () => {
  assert.equal(parseModelCapture("no tasks here"), "The model did not return tasks.");
});

test("sample screenshots become dated tasks without a model", () => {
  const messenger = "80eca08cd03bbaeb6f7e221e78bc05c6fdf26780dcb8afe4bda766ac07fa4bc7";
  const plan = samplePlan([messenger], "2026-11-25");
  assert.equal(plan?.reader, "sample");
  assert.equal(plan?.source, "messenger");
  assert.equal(plan?.tasks[0]?.title, "Pick up the brake pads");
  assert.equal(plan?.tasks[0]?.dueOn, "2026-11-27");
  assert.equal(samplePlan(["abc"], "2026-11-25"), null);
});
