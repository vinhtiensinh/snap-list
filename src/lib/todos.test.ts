import assert from "node:assert/strict";
import test from "node:test";

test("todos stay with their owner and stage", async () => {
  delete process.env.DATABASE_URL;
  const { createTodos, listTodos, updateTodo, deleteTodo, clearCompleted } = await import("./todos");

  const created = await createTodos("user:one", "production", [
    {
      title: "Order the oil filter",
      notes: "From Minh",
      source: "sms",
      priority: "high",
      dueOn: "2026-11-28",
      completed: false,
    },
  ]);
  assert.equal(created.length, 1);
  assert.equal(created[0]?.source, "sms");
  assert.equal(created[0]?.dueOn, "2026-11-28");

  await createTodos("user:two", "production", [
    {
      title: "Someone else's task",
      notes: "",
      source: "manual",
      priority: "normal",
      dueOn: null,
      completed: false,
    },
  ]);
  await createTodos("user:one", "preview", [
    {
      title: "Preview only",
      notes: "",
      source: "email",
      priority: "low",
      dueOn: null,
      completed: false,
    },
  ]);

  const mine = await listTodos("user:one", "production");
  assert.deepEqual(
    mine.map((todo) => todo.title),
    ["Order the oil filter"],
  );

  const updated = await updateTodo("user:one", "production", created[0]!.id, { completed: true });
  assert.ok(updated?.completedAt);
  const hidden = await updateTodo("user:two", "production", created[0]!.id, { title: "Stolen" });
  assert.equal(hidden, null);

  assert.equal(await clearCompleted("user:one", "production"), 1);
  assert.equal((await listTodos("user:one", "production")).length, 0);
  assert.equal((await listTodos("user:one", "preview")).length, 1);

  const leftover = await createTodos("user:one", "production", [
    {
      title: "Call the workshop",
      notes: "",
      source: "manual",
      priority: "normal",
      dueOn: null,
      completed: false,
    },
  ]);
  assert.equal(await deleteTodo("user:two", "production", leftover[0]!.id), false);
  assert.equal(await deleteTodo("user:one", "production", leftover[0]!.id), true);
});
