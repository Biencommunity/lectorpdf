package com.biencommunity.lectorpdf;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PdfIntentPlugin.class);
        super.onCreate(savedInstanceState);
        deliver(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        deliver(intent);
    }

    private void deliver(Intent intent) {
        if (getBridge() == null || getBridge().getPlugin("PdfIntent") == null) return;
        PdfIntentPlugin p = (PdfIntentPlugin) getBridge().getPlugin("PdfIntent").getInstance();
        p.handle(intent);
    }
}
