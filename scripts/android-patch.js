// Se ejecuta en el build, después de `npx cap add android`.
// 1) Declara que la app puede abrir PDF  2) copia el código nativo  3) pone el icono.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appDir = path.join(root, "android", "app", "src", "main");
const manifestPath = path.join(appDir, "AndroidManifest.xml");

// 1) AndroidManifest: filtro para PDF (content:// y file://)
let xml = fs.readFileSync(manifestPath, "utf8");
if (!xml.includes("application/pdf")) {
  const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="content" />
                <data android:scheme="file" />
                <data android:mimeType="application/pdf" />
            </intent-filter>
        `;
  const i = xml.indexOf("</activity>");
  if (i < 0) throw new Error("No encuentro </activity> en AndroidManifest.xml");
  xml = xml.slice(0, i) + filter + xml.slice(i);
  fs.writeFileSync(manifestPath, xml);
}

// 2) Código nativo
const javaDir = path.join(appDir, "java", "com", "biencommunity", "lectorpdf");
fs.mkdirSync(javaDir, { recursive: true });
for (const f of ["MainActivity.java", "PdfIntentPlugin.java"]) {
  fs.copyFileSync(path.join(root, "native", f), path.join(javaDir, f));
}

// 3) Icono (sustituye el adaptable por un PNG normal)
const res = path.join(appDir, "res");
const anydpi = path.join(res, "mipmap-anydpi-v26");
if (fs.existsSync(anydpi)) fs.rmSync(anydpi, { recursive: true, force: true });
for (const d of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  const dir = path.join(res, `mipmap-${d}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(root, "www", "icon-192.png"), path.join(dir, "ic_launcher.png"));
  fs.copyFileSync(path.join(root, "www", "icon-192.png"), path.join(dir, "ic_launcher_round.png"));
  fs.copyFileSync(path.join(root, "www", "icon-192.png"), path.join(dir, "ic_launcher_foreground.png"));
}
console.log("Android parcheado correctamente");
