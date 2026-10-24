// Copia los ficheros de pdf.js desde node_modules a www/lib (así no hay que subirlos al repositorio).
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "node_modules", "pdfjs-dist");
const dst = path.join(root, "www", "lib");
if (!fs.existsSync(src)) throw new Error("Falta pdfjs-dist: ejecuta npm install");

fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });

const files = [
  ["build/pdf.min.mjs", "pdf.min.mjs"],
  ["build/pdf.worker.min.mjs", "pdf.worker.min.mjs"],
  ["web/pdf_viewer.mjs", "pdf_viewer.mjs"],
  ["web/pdf_viewer.css", "pdf_viewer.css"],
];
for (const [from, to] of files) fs.copyFileSync(path.join(src, from), path.join(dst, to));
for (const dir of [["web/images", "images"], ["cmaps", "cmaps"], ["standard_fonts", "standard_fonts"], ["wasm", "wasm"], ["iccs", "iccs"]]) {
  fs.cpSync(path.join(src, dir[0]), path.join(dst, dir[1]), { recursive: true });
}
console.log("pdf.js copiado a www/lib");
