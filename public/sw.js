self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== "/share") return;
  event.respondWith(handleShare(event.request));
});

async function handleShare(request) {
  try {
    const form = await request.formData();
    const images = form
      .getAll("images")
      .filter((value) => typeof value === "object" && value !== null && "arrayBuffer" in value && value.size > 0);
    const record = {
      id: "pending",
      title: textField(form.get("title")),
      text: textField(form.get("text")),
      url: textField(form.get("url")),
      images,
      at: Date.now(),
    };
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("shares", "readwrite");
      tx.objectStore("shares").put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return Response.redirect(new URL("/?shared=1", request.url), 303);
  } catch {
    return Response.redirect(new URL("/?shared=missed", request.url), 303);
  }
}

function textField(value) {
  return typeof value === "string" ? value.slice(0, 4000) : "";
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("snaplist", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("shares")) db.createObjectStore("shares", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
