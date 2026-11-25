"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PRIORITIES, SOURCE_LABELS, type Priority, type Source, type TodoInput } from "@/lib/types";

const CAPTURE_SOURCES: Exclude<Source, "manual">[] = ["messenger", "sms", "email", "other"];
const MAX_IMAGES = 3;
const MAX_BYTES = 4 * 1024 * 1024;

type Draft = {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  dueOn: string;
  checked: boolean;
};

type CaptureResponse = {
  source: Exclude<Source, "manual">;
  reader: "openai" | "sample";
  tasks: { title: string; notes: string; priority: Priority; dueOn: string | null }[];
};

export function CapturePanel({
  onClose,
  onAdd,
}: {
  onClose?: () => void;
  onAdd: (items: TodoInput[]) => Promise<void>;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Exclude<Source, "manual">>("other");
  const [sourceTouched, setSourceTouched] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sample, setSample] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pasted, setPasted] = useState("");
  const sourceTouchedRef = useRef(false);

  useEffect(() => {
    sourceTouchedRef.current = sourceTouched;
  }, [sourceTouched]);

  async function readCapture(payload: { images?: File[]; text?: string }) {
    setError("");
    const images = payload.images ?? [];
    if (images.some((file) => !file.type.startsWith("image/"))) {
      setError("That file isn’t a screenshot. Choose an image.");
      return;
    }
    if (images.length > MAX_IMAGES) {
      setError(`Add up to ${MAX_IMAGES} screenshots at a time.`);
      return;
    }
    if (images.some((file) => file.size > MAX_BYTES)) {
      setError("Each screenshot needs to be under 4 MB.");
      return;
    }
    setReading("Reading the screenshot into tasks…");
    try {
      const body = new FormData();
      body.append("today", localDate());
      for (const image of images) body.append("image", image);
      if (payload.text?.trim()) body.append("text", payload.text.trim());
      const response = await fetch("/api/capture", { method: "POST", body });
      const payloadBody = (await response.json().catch(() => ({}))) as CaptureResponse & { error?: unknown };
      if (!response.ok) {
        throw new Error(typeof payloadBody.error === "string" ? payloadBody.error : "Couldn’t read that screenshot.");
      }
      const next = (payloadBody.tasks ?? []).map((task) => {
        const priority: Priority = task.priority === "low" || task.priority === "high" ? task.priority : "normal";
        return {
          id: crypto.randomUUID(),
          title: task.title,
          notes: task.notes ?? "",
          priority,
          dueOn: task.dueOn ?? "",
          checked: true,
        };
      });
      setDrafts(next);
      setSample(payloadBody.reader === "sample");
      if (!sourceTouchedRef.current && payloadBody.source) setSource(payloadBody.source);
      if (next.length === 0) setError("The model didn’t find a task in that screenshot.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t read that screenshot.");
    } finally {
      setReading("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function applyShare(text: string, images: Blob[]) {
    if (images.length > 0) {
      const files = images.map(
        (blob, index) => new File([blob], `share-${index}.png`, { type: blob.type || "image/png" }),
      );
      void readCapture({ images: files, text });
      return;
    }
    if (text.trim()) void readCapture({ text });
  }

  useShareIntake(applyShare);

  async function loadSample(name: string) {
    setError("");
    try {
      const response = await fetch(`/samples/${name}.png`);
      if (!response.ok) throw new Error("missing sample");
      const blob = await response.blob();
      await readCapture({ images: [new File([blob], `${name}.png`, { type: "image/png" })] });
    } catch {
      setError("The sample screenshot didn’t load.");
    }
  }

  async function addSelected() {
    const chosen = drafts.filter((draft) => draft.checked && draft.title.trim());
    if (chosen.length === 0) return;
    const items: TodoInput[] = chosen.map((draft) => ({
      title: draft.title.trim(),
      notes: draft.notes.trim(),
      source,
      priority: draft.priority,
      dueOn: draft.dueOn || null,
      completed: false,
    }));
    setSaving(true);
    setError("");
    try {
      await onAdd(items);
      setDrafts([]);
      setSample(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t add those tasks.");
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  const selectedCount = drafts.filter((draft) => draft.checked && draft.title.trim()).length;

  return (
    <section className="capture" aria-label="Add tasks from a screenshot">
      <div className="capture-head">
        <h2>From a screenshot</h2>
        {onClose ? (
          <button type="button" className="text-button" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
      <p className="lede">
        Share a shot of a Messenger chat, a text, or an email. A model reads it and turns the requests into tasks. The
        image is not saved.
      </p>
      <div
        className={dragging ? "dropzone is-dragging" : "dropzone"}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void readCapture({ images: Array.from(event.dataTransfer.files) });
        }}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files);
          if (files.length > 0) {
            event.preventDefault();
            void readCapture({ images: files });
          }
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            void readCapture({ images: Array.from(event.target.files ?? []) });
          }}
        />
        <label className="stamp" htmlFor={inputId}>
          Choose screenshot
        </label>
        <p>or drop it here, or paste from the clipboard.</p>
        <div className="sample-row">
          <span>Try a sample</span>
          <button type="button" onClick={() => void loadSample("messenger")}>
            Messenger
          </button>
          <button type="button" onClick={() => void loadSample("sms")}>
            SMS
          </button>
          <button type="button" onClick={() => void loadSample("email")}>
            Email
          </button>
        </div>
      </div>
      <p className="hint">
        On Android and desktop, install Snaplist and share a screenshot into it. On iPhone, save the shot and add it here.
      </p>
      {reading ? <p className="status">{reading}</p> : null}
      {error ? <p className="status is-error">{error}</p> : null}
      <div className="paste-label">
        <label htmlFor="pasted-message">Or paste the message</label>
        <textarea
          id="pasted-message"
          rows={3}
          value={pasted}
          placeholder="Paste a message if you don’t have the screenshot."
          onChange={(event) => setPasted(event.target.value)}
        />
        <button type="button" disabled={pasted.trim() === ""} onClick={() => void readCapture({ text: pasted })}>
          Turn pasted text into tasks
        </button>
      </div>
      {drafts.length > 0 ? (
        <div className="review">
          {sample ? (
            <p className="hint">
              This sample is filled in here. Your own screenshots are sent to the model and are not saved.
            </p>
          ) : null}
          <div className="source-picker" role="group" aria-label="Where this came from">
            {CAPTURE_SOURCES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={source === value}
                onClick={() => {
                  setSourceTouched(true);
                  setSource(value);
                }}
              >
                {SOURCE_LABELS[value]}
              </button>
            ))}
          </div>
          <ul className="drafts">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <input
                  type="checkbox"
                  checked={draft.checked}
                  onChange={() => updateDraft(draft.id, { checked: !draft.checked })}
                  aria-label={`Include “${draft.title}”`}
                />
                <div className="draft-fields">
                  <input
                    value={draft.title}
                    maxLength={280}
                    aria-label="Task from the screenshot"
                    onChange={(event) => updateDraft(draft.id, { title: event.target.value })}
                  />
                  <div className="draft-meta">
                    <input
                      type="date"
                      value={draft.dueOn}
                      aria-label="Due date"
                      onChange={(event) => updateDraft(draft.id, { dueOn: event.target.value })}
                    />
                    <select
                      value={draft.priority}
                      aria-label="Priority"
                      onChange={(event) => updateDraft(draft.id, { priority: event.target.value as Priority })}
                    >
                      {PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    value={draft.notes}
                    maxLength={4000}
                    aria-label="Notes"
                    placeholder="Notes"
                    onChange={(event) => updateDraft(draft.id, { notes: event.target.value })}
                  />
                </div>
              </li>
            ))}
          </ul>
          <button className="stamp" type="button" disabled={saving || selectedCount === 0} onClick={() => void addSelected()}>
            {saving ? "Adding…" : `Add ${selectedCount} ${selectedCount === 1 ? "task" : "tasks"}`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${String(day)}`;
}

function useShareIntake(onShare: (text: string, images: Blob[]) => void) {
  const onShareRef = useRef(onShare);
  onShareRef.current = onShare;
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("shared") !== "1") return;
    params.delete("shared");
    const next = params.toString();
    window.history.replaceState(null, "", next ? `/?${next}` : "/");
    void (async () => {
      const { takePendingShare } = await import("./shares");
      const pending = await takePendingShare();
      if (!pending) return;
      const text = [pending.title, pending.text, pending.url].filter(Boolean).join("\n");
      onShareRef.current(text, pending.images);
    })();
  }, []);
}
