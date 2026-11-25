import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packed =
  (await readFile(join(here, "asset-parts", "a.txt"), "utf8")) +
  (await readFile(join(here, "asset-parts", "b.txt"), "utf8"));
const start = packed.indexOf("const files = ") + "const files = ".length;
const end = packed.indexOf(";\nconst root");
const files = JSON.parse(packed.slice(start, end));
const root = process.cwd();

for (const [path, data] of Object.entries(files)) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(data, "base64"));
}
