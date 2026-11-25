"use client";

import { useEffect, useId, useRef, useState } from "react";
import { detectSource, extractCandidates, preferredChecked } from "@/lib/extract";
import { recognizeImages } from "@/lib/ocr";
import { SOURCE_LABELS, type Source, type TodoInput } from "@/lib/types";

const CAPTURE_SOURCES: Exclude<Source, "manual">[] = ["messenger", "sms", "email", "other"];
const MAX_IMAGES = 5;
const MAX_BYTES = 8 * 1024 * 1024;

type Draft = { id: string; text: string; checked: boolean };

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
  const [rawText, setRawText] = useState("");
  const [asOne, setAsOne] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pasted, setPasted] = useState("");
  const sourceTouchedRef = useRef(false);

  useEffect(() => {
    sourceTouchedRef.current = sourceTouched;
  }, [sourceTouched]);

  async function readFiles(files: File[]) {
    setError("");
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      setError("That file isn’t a screenshot. Choose an image.");
      return;
    }
    if (images.length > MAX_IMAGES) {
      setError(`Add up to ${MAX_IMAGES} screenshots at a time.`);
      return;
    }
    if (images.some((file) => file.size > MAX_BYTES)) {
      setError("Each screenshot needs to be under 8 MB.");
      return;
    }
    setReading("Reading the screenshot…");
    try {
      const text = await recognizeImages(images, (done, total, ratio) => {
        const percent = Math.round(ratio * 100);
        const which = total > 1 ? ` ${Math.min(done + 1, total)} of ${total}` : "";
        setReading(`Reading screenshot${which}… ${percent}%`);
      });
      applyText(text, { replace: true });
    } catch {
      setError("Couldn’t read that screenshot. Try a clearer image, or paste the message.");
    } finally {
      setReading("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function applyText(text: string, options: { replace: boolean }) {
    const next = extractCandidates(text).map((line) => ({
      id: crypto.randomUUID(),
      text: line,
      checked: preferredChecked(line),
    }));
    setRawText(text.trim());
    setDrafts((current) => (options.replace ? next : [...current, ...next]));
    if (!sourceTouchedRef.current) setSource(detectSource(text));
    if (next.length === 0) {
      setError("No task text turned up in that screenshot. Paste the message instead.");
    }
  }

  function applyShare(text: string, images: Blob[]) {
    if (images.length > 0) {
      const files = images.map(
        (blob, index) => new File([blob], `share-${index}.png`, { type: blob.type || "image/png" }),
      );
      void readFiles(files);
      return;
    }
    if (text.trim()) applyText(text, { replace: true });
  }

  useShareIntake(applyShare);

  async function loadSample(name: string) {
    setError("");
    try {
      const response = await fetch(`/samples/${name}.png`);
      if (!response.ok) throw new Error("missing sample");
      const blob = await response.blob();
      await readFiles([new File([blob], `${name}.png`, { type: "image/png" })]);
    } catch {
      setError("The sample screenshot didn’t load.");
    }
  }

  async function addSelected() {
    const chosen = drafts.filter((draft) => draft.checked && draft.text.trim());
    if (chosen.length === 0) return;
    const items: TodoInput[] = asOne
      ? [
          {
            title: chosen[0]!.text.trim(),
            notes: chosen.slice(1).map((draft) => draft.text.trim()).join("\n"),
            source,
            priority: "normal",
            dueOn: null,
            completed: false,
          },
        ]
      : chosen.map((draft) => ({
          title: draft.text.trim(),
          notes: "",
          source,
          priority: "normal",
          dueOn: null,
          completed: false,
        }));
    setSaving(true);
    setError("");
    try {
      await onAdd(items);
      setDrafts([]);
      setRawText("");
      setAsOne(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t add those tasks.");
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = drafts.filter((draft) => draft.checked && draft.text.trim()).length;

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
        Share a shot of a Messenger chat, a text, or an email. The image is read on this device and is not uploaded.
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
          void readFiles(Array.from(event.dataTransfer.files));
        }}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files);
          if (files.length > 0) {
            event.preventDefault();
            void readFiles(files);
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
            void readFiles(Array.from(event.target.files ?? []));
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
          placeholder="Paste a message if the screenshot is hard to read."
          onChange={(event) => setPasted(event.target.value)}
        />
        <button
          type="button"
          disabled={pasted.trim() === ""}
          onClick={() => applyText(pasted, { replace: true })}
        >
          Read pasted text
        </button>
      </div>
      {drafts.length > 0 ? (
        <div className="review">
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
                  onChange={() =>
                    setDrafts((current) =>
                      current.map((item) => (item.id === draft.id ? { ...item, checked: !item.checked } : item)),
                    )
                  }
                  aria-label={`Include “${draft.text}”`}
                />
                <input
                  value={draft.text}
                  maxLength={280}
                  aria-label="Task from the screenshot"
                  onChange={(event) =>
                    setDrafts((current) =>
                      current.map((item) => (item.id === draft.id ? { ...item, text: event.target.value } : item)),
                    )
                  }
                />
              </li>
            ))}
          </ul>
          <label className="check-line">
            <input type="checkbox" checked={asOne} onChange={(event) => setAsOne(event.target.checked)} />
            Add the ticked lines as one task
          </label>
          <button className="stamp" type="button" disabled={saving || selectedCount === 0} onClick={() => void addSelected()}>
            {saving ? "Adding…" : asOne ? "Add 1 task" : `Add ${selectedCount} ${selectedCount === 1 ? "task" : "tasks"}`}
          </button>
          {rawText ? (
            <details>
              <summary>Text read from the image</summary>
              <pre>{rawText}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
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
