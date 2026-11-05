// La landing no tiene componentes de cliente: no hay nada que hidratar.
// Quito del HTML exportado el runtime de Next/React (~460 KB de JS) y el payload RSC en línea.
// Solo sobrevive el JSON-LD, que es un dato y no código.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL(process.env.OUT_DIR ?? "../out", import.meta.url));

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (name.endsWith(".html")) yield p;
  }
}

for (const file of htmlFiles(OUT)) {
  const before = readFileSync(file, "utf8");
  const after = before
    .replace(/<script(?![^>]*ld\+json)[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<link rel="preload" as="script"[^>]*\/>/g, "");
  writeFileSync(file, after);
  console.log(`strip-js: ${file.slice(OUT.length + 1)} ${before.length} -> ${after.length} bytes`);
}
