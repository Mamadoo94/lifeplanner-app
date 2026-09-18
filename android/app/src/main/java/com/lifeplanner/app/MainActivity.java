package com.lifeplanner.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static MainActivity instance;
    private static JSONObject pendingRegisterAction = null;

    public static MainActivity getInstance() {
        return instance;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.d(TAG, "Incoming intent action: " + action);

        if (SmsReceiver.ACTION_REGISTER_SMS.equals(action)) {
            try {
                String body = intent.getStringExtra("EXTRA_SMS_BODY");
                String bankName = intent.getStringExtra("EXTRA_BANK_NAME");
                long amount = intent.getLongExtra("EXTRA_AMOUNT", 0);
                String txType = intent.getStringExtra("EXTRA_TX_TYPE");

                JSONObject payload = new JSONObject();
                payload.put("action", "register_sms");
                payload.put("body", body != null ? body : "");
                payload.put("bankName", bankName != null ? bankName : "");
                payload.put("amount", amount);
                payload.put("type", txType != null ? txType : "expense");
                payload.put("timestamp", System.currentTimeMillis());

                pendingRegisterAction = payload;
                dispatchActionToWeb(payload);
            } catch (Exception e) {
                Log.e(TAG, "Failed to parse SMS action extras", e);
            }
        }
    }

    /**
     * Dispatches intercepted SMS event to Capacitor WebView JavaScript runtime
     */
    public void dispatchSmsToWeb(final String sender, final String body, final long timestamp) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONObject payload = new JSONObject();
                    payload.put("sender", sender);
                    payload.put("body", body);
                    payload.put("timestamp", timestamp);

                    String escaped = payload.toString().replace("'", "\\'");
                    String js = "window.dispatchEvent(new CustomEvent('nativeSmsReceived', { detail: " + escaped + " }));";
                    
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error in dispatchSmsToWeb", e);
                }
            }
        });
    }

    /**
     * Dispatches notification click action (e.g. [ثبت سریع]) to WebView
     */
    public void dispatchActionToWeb(final JSONObject payload) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    String escaped = payload.toString().replace("'", "\\'");
                    String js = "window.dispatchEvent(new CustomEvent('nativeSmsActionRegister', { detail: " + escaped + " }));";

                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error in dispatchActionToWeb", e);
                }
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        if (pendingRegisterAction != null) {
            dispatchActionToWeb(pendingRegisterAction);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (instance == this) {
            instance = null;
        }
    }
}
