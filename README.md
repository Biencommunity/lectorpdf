# Lector PDF

Lector de PDF para Android hecho con pdf.js. Funciona sin conexión; los archivos no salen del móvil.

## Funciones
- Se puede poner como app **predeterminada** para abrir PDF (también con "Abrir con" desde WhatsApp, Gmail, Archivos…)
- Scroll continuo, zoom con pellizco, doble toque (ajustar al ancho / 200 %)
- Ir a una página, anterior y siguiente
- Búsqueda de texto, índice, enlaces, PDF con contraseña
- Recientes con última página y zoom recordados
- Modo oscuro

## Generar el APK (gratis, en GitHub)
1. Crea un repositorio nuevo en GitHub y sube todo el contenido de esta carpeta, incluida `.github` (en el repositorio debe existir `.github/workflows/apk.yml`).
2. Pestaña **Actions** → **Generar APK** → **Run workflow**.
3. En 5-8 minutos aparece el artefacto **lector-pdf-apk**. Descárgalo, descomprímelo y pasa `app-debug.apk` al móvil.
4. Instálalo (Android pedirá permitir instalar apps desconocidas desde la app que uses para abrir el archivo).

## Ponerlo como predeterminado
Abre un PDF desde el gestor de archivos → "Abrir con" → Lector PDF → **Siempre**.
Si ya tenías otro lector fijado: Ajustes → Apps → (ese lector) → Abrir de forma predeterminada → Borrar valores predeterminados.

## Probar en el ordenador
`npm install` y después `npm run serve`, y abre http://localhost:8080.
