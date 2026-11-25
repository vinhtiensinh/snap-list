import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packed = (await readFile(join(here, "asset-parts", "a.txt"), "utf8")) + (await readFile(join(here, "asset-parts", "b.txt"), "utf8"));
const files = JSON.parse(packed);
const root = process.cwd();

for (const [path, data] of Object.entries(files)) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(data, "base64"));
}
