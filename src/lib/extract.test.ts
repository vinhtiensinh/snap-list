import assert from "node:assert/strict";
import test from "node:test";
import { detectSource, extractCandidates, preferredChecked } from "./extract";

test("extracts tasks and drops message chrome", () => {
  const text = [
    "Messenger",
    "Sarah Chen",
    "Active now",
    "9:41",
    "Can you pick up the brake pads before Friday?",
    "Also text Minh that the hoist is booked for 9am.",
    "Delivered",
  ].join("\n");

  assert.deepEqual(extractCandidates(text), [
    "Sarah Chen",
    "Can you pick up the brake pads before Friday?",
    "Also text Minh that the hoist is booked for 9am.",
  ]);
  assert.equal(detectSource(text), "messenger");
  assert.equal(preferredChecked("Sarah Chen"), false);
  assert.equal(preferredChecked("Can you pick up the brake pads before Friday?"), true);
});

test("reads an email subject as a task and ignores the from line by default", () => {
  const text = [
    "Inbox",
    "Subject: Quote for the workshop sign",
    "From: Ada North",
    "Friday 9:12 AM",
    "Please send the revised quote by Thursday.",
  ].join("\n");

  assert.deepEqual(extractCandidates(text), [
    "Quote for the workshop sign",
    "From: Ada North",
    "Please send the revised quote by Thursday.",
  ]);
  assert.equal(detectSource(text), "email");
  assert.equal(preferredChecked("From: Ada North"), false);
  assert.equal(preferredChecked("Quote for the workshop sign"), true);
});

test("detects an SMS screenshot", () => {
  const text = "Messages\nMinh\nPlease order the oil filter today.";
  assert.equal(detectSource(text), "sms");
});

test("joins a wrapped sentence into one task", () => {
  const text = [
    "Can you pick up the brake pads",
    "before Friday?",
    "Please send the revised quote by",
    "Thursday.",
  ].join("\n");
  assert.deepEqual(extractCandidates(text), [
    "Can you pick up the brake pads before Friday?",
    "Please send the revised quote by Thursday.",
  ]);
});

test("drops duplicate lines", () => {
  assert.deepEqual(extractCandidates("Call Minh back\nCall Minh back"), ["Call Minh back"]);
});
