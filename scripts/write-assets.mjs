import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const names = (await readdir(join(here, "asset-parts"))).filter((name) => name.endsWith(".txt")).sort();
const packed = (await Promise.all(names.map((name) => readFile(join(here, "asset-parts", name), "utf8")))).join("");
const files = JSON.parse(packed);
const root = process.cwd();

for (const [path, data] of Object.entries(files)) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(data, "base64"));
}
