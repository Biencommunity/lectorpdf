package com.biencommunity.lectorpdf;

import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Recibe los PDF que el sistema entrega a la app (abrir con / predeterminada),
 * los copia a la caché y avisa a la web con el evento "pdfOpened".
 */
@CapacitorPlugin(name = "PdfIntent")
public class PdfIntentPlugin extends Plugin {

    public void handle(Intent intent) {
        if (intent == null) return;
        if (!Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null) return;

        try {
            Context ctx = getContext();
            File dir = ctx.getCacheDir();
            File[] old = dir.listFiles();
            if (old != null) {
                for (File f : old) {
                    if (f.getName().startsWith("incoming-")) f.delete();
                }
            }
            File out = new File(dir, "incoming-" + System.currentTimeMillis() + ".pdf");

            try (InputStream in = ctx.getContentResolver().openInputStream(uri);
                 OutputStream os = new FileOutputStream(out)) {
                if (in == null) return;
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
            }

            String name = displayName(ctx, uri);
            JSObject data = new JSObject();
            data.put("path", out.getAbsolutePath());
            data.put("name", name);
            // true = si la web aún no ha registrado el listener, el evento se guarda hasta que lo haga
            notifyListeners("pdfOpened", data, true);
        } catch (Exception e) {
            JSObject err = new JSObject();
            err.put("message", String.valueOf(e.getMessage()));
            notifyListeners("pdfError", err, true);
        }
    }

    private String displayName(Context ctx, Uri uri) {
        String name = null;
        if ("content".equals(uri.getScheme())) {
            try (Cursor c = ctx.getContentResolver().query(uri, null, null, null, null)) {
                if (c != null && c.moveToFirst()) {
                    int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (i >= 0) name = c.getString(i);
                }
            } catch (Exception ignored) { }
        }
        if (name == null) name = uri.getLastPathSegment();
        if (name == null) name = "documento.pdf";
        return name;
    }
}
