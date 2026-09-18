package com.lifeplanner.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.text.DecimalFormat;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Native Android SMS BroadcastReceiver for LifePlanner.
 * Intercepts incoming SMS (e.g. Iranian bank transaction SMS) even when the app process is closed,
 * automatically parses transaction data, and displays an interactive system notification with
 * [ثبت سریع] and [رد کردن] action buttons.
 */
public class SmsReceiver extends BroadcastReceiver {
    private static final String TAG = "LifePlannerSms";
    public static final String CHANNEL_ID = "lifeplanner_bank_sms";
    public static final String ACTION_REGISTER_SMS = "com.lifeplanner.app.ACTION_REGISTER_SMS";
    public static final String ACTION_DISMISS_SMS_NOTIF = "com.lifeplanner.app.ACTION_DISMISS_SMS_NOTIF";

    public interface SmsListener {
        void onSmsReceived(String sender, String body, long timestamp);
    }

    private static SmsListener listener;

    public static void setListener(SmsListener l) {
        listener = l;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if ("android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            Bundle bundle = intent.getExtras();
            if (bundle != null) {
                try {
                    Object[] pdus = (Object[]) bundle.get("pdus");
                    String format = bundle.getString("format");
                    if (pdus != null) {
                        StringBuilder fullBody = new StringBuilder();
                        String sender = "";
                        long timestamp = System.currentTimeMillis();

                        for (Object pdu : pdus) {
                            SmsMessage smsMessage;
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
                            } else {
                                smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                            }
                            if (smsMessage != null) {
                                sender = smsMessage.getDisplayOriginatingAddress();
                                fullBody.append(smsMessage.getMessageBody());
                                timestamp = smsMessage.getTimestampMillis();
                            }
                        }

                        String bodyText = fullBody.toString();
                        Log.d(TAG, "SMS received from " + sender + ": " + bodyText);

                        // If app webview is active, dispatch directly
                        if (listener != null) {
                            listener.onSmsReceived(sender, bodyText, timestamp);
                        }
                        if (MainActivity.getInstance() != null) {
                            MainActivity.getInstance().dispatchSmsToWeb(sender, bodyText, timestamp);
                        }

                        // Parse Bank transaction and trigger Interactive Notification
                        ParsedSmsInfo info = parseBankSms(bodyText, sender);
                        if (info != null && info.isBankTransaction) {
                            showInteractiveNotification(context, info, bodyText);
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error processing SMS PDU", e);
                }
            }
        }
    }

    public static class ParsedSmsInfo {
        public boolean isBankTransaction = false;
        public String bankName = "بانک";
        public long amountTomans = 0;
        public String formattedAmount = "";
        public String type = "expense"; // "expense" or "income"
    }

    /**
     * Smart parsing of Iranian bank SMS messages
     */
    public static ParsedSmsInfo parseBankSms(String text, String sender) {
        if (text == null) return null;
        String normalized = text.replace("ی", "ی").replace("ک", "ک");
        ParsedSmsInfo info = new ParsedSmsInfo();

        // 1. Identify Bank
        String[] banks = {
            "بلوبانک", "بلو", "سامان", "ملت", "ملی", "پاسارگاد", "تجارت", "سپه",
            "صادرات", "کشاورزی", "رسالت", "شهر", "رفاه", "مسکن", "آینده", "پارسیان",
            "سینا", "دی", "پست بانک", "خاورمیانه", "گردشگری", "ایران زمین"
        };
        for (String b : banks) {
            if (normalized.contains(b) || (sender != null && sender.contains(b))) {
                info.bankName = b.equals("بلو") ? "بلوبانک" : ("بانک " + b.replace("بانک", "").trim());
                info.isBankTransaction = true;
                break;
            }
        }

        // Transaction Keywords check
        boolean hasTxKeywords = normalized.contains("واریز") || normalized.contains("برداشت") ||
                                normalized.contains("خرید") || normalized.contains("انتقال") ||
                                normalized.contains("مانده:") || normalized.contains("موجودی:");

        if (hasTxKeywords) {
            info.isBankTransaction = true;
        }

        if (!info.isBankTransaction) {
            return null;
        }

        // 2. Identify Type (Income / Expense)
        if (normalized.contains("واریز") || normalized.contains("سود") || normalized.contains("بستانکار")) {
            info.type = "income";
        } else {
            info.type = "expense";
        }

        // 3. Extract Amount (regex handles Persian & English digits, commas)
        // Convert Persian digits to English digits
        String englishDigits = toEnglishDigits(normalized);

        // Patterns common in Iranian bank SMS:
        // "مبلغ: 120,000 ریال", "برداشت: 50,000 تومان", "خرید 350,000", "+ 1,500,000 ریال"
        Pattern amountPattern = Pattern.compile("(?:مبلغ|برداشت|واریز|خرید|انتقال)?[\\s:]*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\\s*(ریال|تومان)?");
        Matcher matcher = amountPattern.matcher(englishDigits);

        long amount = 0;
        boolean isRial = englishDigits.contains("ریال");

        if (matcher.find()) {
            String numStr = matcher.group(1).replace(",", "");
            try {
                amount = Long.parseLong(numStr);
                String unit = matcher.group(2);
                if (unit != null && unit.contains("تومان")) {
                    isRial = false;
                } else if (unit != null && unit.contains("ریال")) {
                    isRial = true;
                }
            } catch (Exception ignored) {}
        }

        if (amount == 0) {
            // Fallback: search for any sequence of formatted digits with commas
            Pattern fallbackPattern = Pattern.compile("([0-9]{1,3}(?:,[0-9]{3})+)\\s*(ریال|تومان)?");
            Matcher fbMatcher = fallbackPattern.matcher(englishDigits);
            if (fbMatcher.find()) {
                try {
                    amount = Long.parseLong(fbMatcher.group(1).replace(",", ""));
                    if (fbMatcher.group(2) != null && fbMatcher.group(2).contains("تومان")) {
                        isRial = false;
                    }
                } catch (Exception ignored) {}
            }
        }

        if (isRial && amount >= 10) {
            info.amountTomans = amount / 10;
        } else {
            info.amountTomans = amount;
        }

        DecimalFormat df = new DecimalFormat("#,###");
        info.formattedAmount = df.format(info.amountTomans) + " تومان";

        return info;
    }

    private static String toEnglishDigits(String input) {
        if (input == null) return "";
        char[] persianDigits = {'۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'};
        char[] arabicDigits = {'٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'};
        StringBuilder sb = new StringBuilder();
        for (char c : input.toCharArray()) {
            boolean matched = false;
            for (int i = 0; i < 10; i++) {
                if (c == persianDigits[i] || c == arabicDigits[i]) {
                    sb.append(i);
                    matched = true;
                    break;
                }
            }
            if (!matched) sb.append(c);
        }
        return sb.toString();
    }

    /**
     * Displays high-priority Android system notification with interactive action buttons:
     * [ثبت سریع] and [رد کردن]
     */
    private void showInteractiveNotification(Context context, ParsedSmsInfo info, String rawBody) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        // Ensure channel exists (Android 8.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "تراکنش‌های بانکی (Bank SMS Transactions)",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("کانال شناسایی خودکار پیامک‌های واریز و برداشت بانکی");
            channel.enableVibration(true);
            channel.setShowBadge(true);
            manager.createNotificationChannel(channel);
        }

        int notificationId = (int) (System.currentTimeMillis() % 100000);

        // Action 1: [ثبت سریع] -> Launches MainActivity with extras to open pre-filled modal
        Intent registerIntent = new Intent(context, MainActivity.class);
        registerIntent.setAction(ACTION_REGISTER_SMS);
        registerIntent.putExtra("EXTRA_SMS_BODY", rawBody);
        registerIntent.putExtra("EXTRA_BANK_NAME", info.bankName);
        registerIntent.putExtra("EXTRA_AMOUNT", info.amountTomans);
        registerIntent.putExtra("EXTRA_TX_TYPE", info.type);
        registerIntent.putExtra("NOTIFICATION_ID", notificationId);
        registerIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pRegisterIntent = PendingIntent.getActivity(context, notificationId, registerIntent, flags);

        // Action 2: [رد کردن] -> Dismisses the notification
        Intent dismissIntent = new Intent(context, SmsNotificationActionReceiver.class);
        dismissIntent.setAction(ACTION_DISMISS_SMS_NOTIF);
        dismissIntent.putExtra("NOTIFICATION_ID", notificationId);
        PendingIntent pDismissIntent = PendingIntent.getBroadcast(context, notificationId + 1, dismissIntent, flags);

        String notificationTitle = "پیامک بانکی جدید (" + info.bankName + ")";
        String notificationText = "تراکنش جدید به مبلغ " + info.formattedAmount + " (" + info.bankName + ") شناسایی شد. آیا مایل به ثبت هستید؟";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(notificationTitle)
            .setContentText(notificationText)
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText(notificationText + "\n\nمتن پیامک: " + (rawBody.length() > 140 ? rawBody.substring(0, 140) + "..." : rawBody)))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pRegisterIntent)
            .addAction(android.R.drawable.ic_menu_save, "ثبت سریع", pRegisterIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "رد کردن", pDismissIntent);

        manager.notify(notificationId, builder.build());
    }
}
