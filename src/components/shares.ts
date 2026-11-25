const DB = "snaplist";
const STORE = "shares";

export type PendingShare = {
  id: "pending";
  title: string;
  text: string;
  url: string;
  images: Blob[];
  at: number;
};

export function openShareDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function takePendingShare(): Promise<PendingShare | null> {
  const db = await openShareDb();
  try {
    const row = await new Promise<PendingShare | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const get = store.get("pending");
      get.onsuccess = () => {
        store.delete("pending");
        resolve(get.result as PendingShare | undefined);
      };
      get.onerror = () => reject(get.error);
    });
    return row ?? null;
  } finally {
    db.close();
  }
}
