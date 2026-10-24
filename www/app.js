import * as pdfjsLib from "./lib/pdf.min.mjs";
globalThis.pdfjsLib = pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdf.worker.min.mjs";
const { EventBus, PDFViewer, PDFLinkService, PDFFindController } = await import("./lib/pdf_viewer.mjs");

const $ = (id) => document.getElementById(id);
const els = {
  home: $("home"), reader: $("reader"), fileInput: $("fileInput"), recents: $("recents"), noRecents: $("noRecents"),
  docTitle: $("docTitle"), container: $("viewerContainer"), viewer: $("viewer"),
  pageInput: $("pageInput"), pageTotal: $("pageTotal"), loading: $("loading"), toast: $("toast"),
  searchBar: $("searchBar"), searchInput: $("searchInput"), searchCount: $("searchCount"),
  outline: $("outline"), outlineList: $("outlineList"),
};

/* ---------- Almacenamiento local (IndexedDB) ---------- */
const DB_NAME = "lector-pdf", STORE = "docs", MAX_RECENTS = 15;
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open(DB_NAME, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
  const db = await dbp;
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && "result" in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
};
const dbAll = () => tx("readonly", (s) => s.getAll());
const dbGet = (id) => tx("readonly", (s) => s.get(id));
const dbPut = (doc) => tx("readwrite", (s) => s.put(doc));
const dbDel = (id) => tx("readwrite", (s) => s.delete(id));

/* ---------- Visor ---------- */
const eventBus = new EventBus();
const linkService = new PDFLinkService({ eventBus });
const findController = new PDFFindController({ eventBus, linkService });
const pdfViewer = new PDFViewer({
  container: els.container, viewer: els.viewer, eventBus, linkService, findController,
  textLayerMode: 1, removePageBorders: true,
});
linkService.setViewer(pdfViewer);

let current = null;       // { id, name, pdf }
let saveTimer = null;

const toast = (msg) => {
  els.toast.textContent = msg; els.toast.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (els.toast.hidden = true), 2200);
};
const showLoading = (v) => (els.loading.hidden = !v);

async function fileId(file) {
  const head = await file.slice(0, 65536).arrayBuffer();
  const h = await crypto.subtle.digest("SHA-256", head);
  const hex = [...new Uint8Array(h)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex}-${file.size}`;
}

async function openBlob(blob, name, id) {
  showLoading(true);
  try {
    const data = new Uint8Array(await blob.arrayBuffer());
    const task = pdfjsLib.getDocument({
      data, cMapUrl: "./lib/cmaps/", cMapPacked: true,
      standardFontDataUrl: "./lib/standard_fonts/", wasmUrl: "./lib/wasm/", iccUrl: "./lib/iccs/",
    });
    task.onPassword = (update, reason) => {
      const msg = reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD ? "Contraseña incorrecta. Inténtalo de nuevo:" : "Este PDF está protegido. Escribe la contraseña:";
      const pw = prompt(msg);
      if (pw === null) task.destroy(); else update(pw);
    };
    const pdf = await task.promise;
    if (current?.pdf) current.pdf.destroy();
    current = { id, name, pdf };

    const saved = await dbGet(id);
    await dbPut({
      id, name, size: blob.size, blob, pages: pdf.numPages,
      lastPage: saved?.lastPage || 1, scale: saved?.scale || "page-width", opened: Date.now(),
    });
    await pruneRecents();

    els.home.hidden = true; els.reader.hidden = false;
    history.pushState({ reader: true }, "");
    els.docTitle.textContent = name.replace(/\.pdf$/i, "");
    document.title = name;
    pdfViewer.setDocument(pdf);
    linkService.setDocument(pdf, null);
    els.pageTotal.textContent = `/ ${pdf.numPages}`;
    els.pageInput.max = pdf.numPages;

    pdfViewer.firstPagePromise.then(() => {
      pdfViewer.currentScaleValue = saved?.scale || "page-width";
      if (saved?.lastPage > 1) pdfViewer.currentPageNumber = saved.lastPage;
    });
    loadOutline(pdf);
  } catch (e) {
    console.error(e);
    toast(e?.name === "PasswordException" ? "Falta la contraseña" : "No se pudo abrir este PDF");
  } finally { showLoading(false); }
}

async function pruneRecents() {
  const all = (await dbAll()).sort((a, b) => b.opened - a.opened);
  for (const d of all.slice(MAX_RECENTS)) await dbDel(d.id);
}

function persistProgress() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!current) return;
    const d = await dbGet(current.id);
    if (!d) return;
    d.lastPage = pdfViewer.currentPageNumber;
    d.scale = pdfViewer.currentScaleValue;
    await dbPut(d);
  }, 400);
}

eventBus.on("pagechanging", (e) => { els.pageInput.value = e.pageNumber; persistProgress(); });
eventBus.on("scalechanging", persistProgress);

/* ---------- Pantalla de inicio ---------- */
async function renderRecents() {
  const all = (await dbAll()).sort((a, b) => b.opened - a.opened);
  els.recents.innerHTML = "";
  els.noRecents.hidden = all.length > 0;
  for (const d of all) {
    const li = document.createElement("li");
    const mb = (d.size / 1048576).toFixed(1);
    li.innerHTML = `<div class="info"><div class="name"></div><div class="meta">Pág. ${d.lastPage} de ${d.pages} · ${mb} MB</div></div><button class="del" aria-label="Quitar de recientes">✕</button>`;
    li.querySelector(".name").textContent = d.name;
    li.querySelector(".info").onclick = () => openBlob(d.blob, d.name, d.id);
    li.querySelector(".del").onclick = async (ev) => { ev.stopPropagation(); await dbDel(d.id); renderRecents(); };
    els.recents.append(li);
  }
}

els.fileInput.addEventListener("change", async () => {
  const f = els.fileInput.files[0];
  els.fileInput.value = "";
  if (!f) return;
  openBlob(f, f.name, await fileId(f));
});

function closeReader() {
  els.reader.hidden = true; els.home.hidden = false;
  els.outline.hidden = true; els.searchBar.hidden = true;
  document.title = "Lector PDF";
  renderRecents();
}
$("btnBack").onclick = () => history.back();
window.addEventListener("popstate", () => { if (!els.reader.hidden) closeReader(); });

/* ---------- Controles ---------- */
$("zoomIn").onclick = () => pdfViewer.increaseScale({ steps: 2 });
$("zoomOut").onclick = () => pdfViewer.decreaseScale({ steps: 2 });
$("zoomFit").onclick = () => { pdfViewer.currentScaleValue = "page-width"; };
$("prevPage").onclick = () => pdfViewer.previousPage();
$("nextPage").onclick = () => pdfViewer.nextPage();
els.pageInput.addEventListener("change", () => {
  const n = Math.min(Math.max(parseInt(els.pageInput.value, 10) || 1, 1), pdfViewer.pagesCount);
  pdfViewer.currentPageNumber = n; els.pageInput.value = n;
});
$("btnTheme").onclick = () => {
  document.body.classList.toggle("dark");
  try { localStorage.setItem("dark", document.body.classList.contains("dark") ? "1" : "0"); } catch {}
};
try { if (localStorage.getItem("dark") === "1") document.body.classList.add("dark"); } catch {}

/* Doble toque: alterna entre ajustar al ancho y 200 % */
let lastTap = 0;
els.container.addEventListener("touchend", (e) => {
  if (e.touches.length || e.changedTouches.length !== 1) return;
  const now = Date.now();
  if (now - lastTap < 300) {
    pdfViewer.currentScaleValue = pdfViewer.currentScaleValue === "page-width" ? "2" : "page-width";
    e.preventDefault();
  }
  lastTap = now;
});

/* Pellizcar para hacer zoom */
let pinch = null;
const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
els.container.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) pinch = { d: dist(e.touches), s: pdfViewer.currentScale, raf: 0 };
}, { passive: true });
els.container.addEventListener("touchmove", (e) => {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  const ratio = dist(e.touches) / pinch.d;
  if (pinch.raf) return;
  pinch.raf = requestAnimationFrame(() => {
    if (!pinch) return;
    pdfViewer.currentScale = Math.min(Math.max(pinch.s * ratio, 0.25), 5);
    pinch.raf = 0;
  });
}, { passive: false });
els.container.addEventListener("touchend", (e) => { if (e.touches.length < 2) pinch = null; }, { passive: true });

/* ---------- Búsqueda ---------- */
function doFind(type = "") {
  const q = els.searchInput.value;
  if (!q) { els.searchCount.textContent = ""; return; }
  eventBus.dispatch("find", { source: window, type, query: q, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: type === "again" ? false : undefined });
}
$("btnSearch").onclick = () => {
  els.searchBar.hidden = !els.searchBar.hidden;
  if (!els.searchBar.hidden) els.searchInput.focus();
};
els.searchInput.addEventListener("input", () => doFind());
els.searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") eventBus.dispatch("find", { source: window, type: "again", query: els.searchInput.value, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: e.shiftKey }); });
$("searchNext").onclick = () => eventBus.dispatch("find", { source: window, type: "again", query: els.searchInput.value, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: false });
$("searchPrev").onclick = () => eventBus.dispatch("find", { source: window, type: "again", query: els.searchInput.value, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: true });
$("searchClose").onclick = () => {
  els.searchBar.hidden = true; els.searchInput.value = ""; els.searchCount.textContent = "";
  eventBus.dispatch("findbarclose", { source: window });
};
const showCount = ({ matchesCount, state }) => {
  if (!els.searchInput.value) return;
  els.searchCount.textContent = matchesCount.total
    ? `${matchesCount.current}/${matchesCount.total}`
    : state === pdfjsLib.FindState?.NOT_FOUND || state === 1 ? "Sin resultados" : "";
};
eventBus.on("updatefindmatchescount", (e) => showCount({ matchesCount: e.matchesCount, state: 0 }));
eventBus.on("updatefindcontrolstate", (e) => showCount(e));

/* ---------- Índice ---------- */
async function loadOutline(pdf) {
  els.outlineList.innerHTML = "";
  const items = await pdf.getOutline();
  if (!items?.length) { els.outlineList.innerHTML = '<p class="muted" style="padding:12px 16px">Este PDF no tiene índice.</p>'; return; }
  const walk = (list, lvl) => {
    for (const it of list) {
      const a = document.createElement("a");
      a.href = "#"; a.textContent = it.title; a.className = `lvl${Math.min(lvl, 3)}`;
      a.onclick = (ev) => { ev.preventDefault(); els.outline.hidden = true; if (it.dest) linkService.goToDestination(it.dest); };
      els.outlineList.append(a);
      if (it.items?.length) walk(it.items, lvl + 1);
    }
  };
  walk(items, 0);
}
$("btnOutline").onclick = () => (els.outline.hidden = !els.outline.hidden);
$("outlineClose").onclick = () => (els.outline.hidden = true);

/* ---------- PDF recibidos desde Android (abrir con / predeterminada) ---------- */
const native = globalThis.Capacitor?.Plugins?.PdfIntent;
if (native) {
  native.addListener("pdfOpened", async ({ path, name }) => {
    try {
      showLoading(true);
      const res = await fetch(globalThis.Capacitor.convertFileSrc("file://" + path));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const file = new File([blob], name || "documento.pdf", { type: "application/pdf" });
      await openBlob(file, file.name, await fileId(file));
    } catch (e) {
      console.error(e); showLoading(false); toast("No se pudo abrir el PDF recibido");
    }
  });
  native.addListener("pdfError", () => toast("No se pudo leer el archivo"));
}

/* ---------- Arranque ---------- */
renderRecents();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
globalThis.__lector = { pdfViewer, openBlob, eventBus }; // para pruebas
