export async function recognizeImages(
  images: Blob[],
  onProgress: (done: number, total: number, ratio: number) => void,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  let current = 0;
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress(current, images.length, message.progress ?? 0);
      }
    },
  });
  try {
    const pages: string[] = [];
    for (let index = 0; index < images.length; index += 1) {
      current = index;
      onProgress(index, images.length, 0);
      const result = await worker.recognize(images[index]!);
      pages.push(result.data.text ?? "");
    }
    onProgress(images.length, images.length, 1);
    return pages.join("\n");
  } finally {
    await worker.terminate();
  }
}
