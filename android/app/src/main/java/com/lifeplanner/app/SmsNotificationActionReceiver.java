package com.lifeplanner.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Broadcast receiver to handle notification dismiss or custom interactive actions
 * from background SMS notifications.
 */
public class SmsNotificationActionReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsNotifAction";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        int notificationId = intent.getIntExtra("NOTIFICATION_ID", -1);

        Log.d(TAG, "Notification action received: " + action + " for ID: " + notificationId);

        if ("com.lifeplanner.app.ACTION_DISMISS_SMS_NOTIF".equals(action)) {
            if (notificationId != -1) {
                NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager != null) {
                    manager.cancel(notificationId);
                }
            }
        }
    }
}
