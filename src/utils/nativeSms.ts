import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ParsedBankSMS, BankAccount, TransactionType } from '../types';
import { parseSingleBankSMS } from './bankSmsParser';
import { soundFx } from './audio';
import { toPersianDigits } from './jalali';

export interface NativeSmsEvent {
  sender?: string;
  body: string;
  timestamp?: number;
}

export interface SmsActionRegisterEvent {
  action: string;
  body: string;
  bankName: string;
  amount: number;
  type: TransactionType;
  timestamp?: number;
}

export type SmsListenerCallback = (data: {
  raw: NativeSmsEvent;
  parsed: ParsedBankSMS | null;
}) => void;

export type SmsActionListenerCallback = (data: {
  action?: string;
  body: string;
  bankName: string;
  amount: number;
  type: TransactionType;
  date_jalali?: string;
  time?: string;
  parsed?: ParsedBankSMS | null;
}) => void;

// Active listeners registry
const activeListeners = new Set<SmsListenerCallback>();
const actionListeners = new Set<SmsActionListenerCallback>();
let isGlobalListenerBound = false;

/**
 * Checks if running inside native Capacitor Android or iOS shell
 */
export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Request SMS permissions on Android
 */
export async function requestNativeSmsPermissions(): Promise<boolean> {
  if (!isNativePlatform()) {
    return true; // In web, permission simulated
  }

  try {
    if ((window as any).Capacitor?.Plugins?.Permissions) {
      const res = await (window as any).Capacitor.Plugins.Permissions.requestPermission({
        name: 'android.permission.RECEIVE_SMS',
      });
      return res?.granted === true;
    }
    return true;
  } catch (err) {
    console.warn('Native SMS permission request:', err);
    return false;
  }
}

/**
 * Register action listener for when user taps [ثبت سریع] in native notification
 */
export function registerSmsActionListener(
  callback: SmsActionListenerCallback,
  accounts: BankAccount[] = []
): () => void {
  actionListeners.add(callback);

  ensureGlobalListeners(accounts);

  return () => {
    actionListeners.delete(callback);
  };
}

/**
 * Start listening for incoming SMS events
 */
export function registerSmsListener(
  callback: SmsListenerCallback,
  accounts: BankAccount[] = []
): () => void {
  activeListeners.add(callback);

  ensureGlobalListeners(accounts);

  return () => {
    activeListeners.delete(callback);
  };
}

function ensureGlobalListeners(accounts: BankAccount[]) {
  if (!isGlobalListenerBound && typeof window !== 'undefined') {
    isGlobalListenerBound = true;

    // Listen to custom event dispatched by native Java MainActivity bridge for SMS received
    window.addEventListener('nativeSmsReceived', ((event: CustomEvent<NativeSmsEvent>) => {
      const detail = event.detail;
      if (detail && detail.body) {
        handleIncomingSmsMessage(detail, accounts);
      }
    }) as EventListener);

    // Listen to notification action button click [ثبت سریع]
    window.addEventListener('nativeSmsActionRegister', ((event: CustomEvent<SmsActionRegisterEvent>) => {
      const detail = event.detail;
      if (detail) {
        handleIncomingSmsAction(detail, accounts);
      }
    }) as EventListener);

    // LocalNotifications action listener if using Capacitor LocalNotifications plugin
    if (isNativePlatform()) {
      try {
        LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
          if (notificationAction.actionId === 'register' && notificationAction.notification.extra) {
            const extra = notificationAction.notification.extra;
            handleIncomingSmsAction({
              action: 'register_sms',
              body: extra.body || '',
              bankName: extra.bankName || '',
              amount: extra.amount || 0,
              type: extra.type || 'expense',
            }, accounts);
          }
        });
      } catch (err) {
        console.warn('Could not bind localNotificationActionPerformed:', err);
      }
    }
  }
}

/**
 * Internal handler when an SMS is intercepted
 */
function handleIncomingSmsMessage(sms: NativeSmsEvent, accounts: BankAccount[]) {
  const parsed = parseSingleBankSMS(sms.body, accounts);

  if (parsed) {
    soundFx.playAdd();
  }

  // Notify all registered listener callbacks
  activeListeners.forEach((listener) => {
    try {
      listener({ raw: sms, parsed });
    } catch (err) {
      console.error('Error in SMS listener callback:', err);
    }
  });
}

/**
 * Internal handler when [ثبت سریع] is clicked
 */
function handleIncomingSmsAction(action: SmsActionRegisterEvent, accounts: BankAccount[]) {
  const parsed = parseSingleBankSMS(action.body, accounts);
  soundFx.playAdd();

  actionListeners.forEach((listener) => {
    try {
      listener({
        action: action.action,
        body: action.body,
        bankName: action.bankName || (parsed?.bankName || 'بانک'),
        amount: action.amount || (parsed?.amount || 0),
        type: action.type || (parsed?.type || 'expense'),
        date_jalali: parsed?.date_jalali,
        time: parsed?.time,
        parsed,
      });
    } catch (err) {
      console.error('Error in SMS action listener callback:', err);
    }
  });
}

/**
 * Simulates an incoming SMS message with interactive prompt / notification
 */
export function simulateIncomingBankSms(
  sampleType: 'blubank_deposit' | 'mellat_withdraw' | 'saman_transfer' | 'melli_purchase',
  accounts: BankAccount[] = [],
  triggerInteractivePrompt = true
): ParsedBankSMS | null {
  const sampleMessages: Record<string, { sender: string; body: string; bank: string; amount: number; type: TransactionType }> = {
    blubank_deposit: {
      sender: 'BluBank',
      bank: 'بلوبانک',
      type: 'income',
      amount: 250000,
      body: 'واریز به حساب\nمبلغ: ۲,۵۰۰,۰۰۰ ریال\nاز: ۶۰۳۷۹۹******۱۴۲۰\nمانده: ۱۸,۴۵۰,۰۰۰ ریال\n۱۴۰۵/۰۶/۲۴ - ۱۶:۳۰\nبلوبانک سامان',
    },
    mellat_withdraw: {
      sender: 'Bank Mellat',
      bank: 'بانک ملت',
      type: 'expense',
      amount: 45000,
      body: 'بانک ملت\nبرداشت از حساب: ۱۲۳۴۵۶۷۸\nمبلغ: ۴۵۰,۰۰۰ ریال\nخرید فروشگاهی\nمانده: ۷,۸۵۰,۰۰۰ ریال\n۱۴۰۵/۰۶/۲۴ - ۱۴:۱۵',
    },
    saman_transfer: {
      sender: 'Bank Saman',
      bank: 'بانک سامان',
      type: 'expense',
      amount: 1200000,
      body: 'بانک سامان\nانتقال کارت به کارت\nمبلغ: ۱۲,۰۰۰,۰۰۰ ریال\nبه کارت: ۵۰۲۲۲۹******۸۸۹۰\nمانده: ۳۴,۲۰۰,۰۰۰ ریال\n۱۴۰۵/۰۶/۲۴ - ۱۱:۰۲',
    },
    melli_purchase: {
      sender: 'BMI',
      bank: 'بانک ملی ایران',
      type: 'expense',
      amount: 185000,
      body: 'بانک ملی ایران\nبرداشت وجه خرید اینترنتی\nمبلغ: ۱,۸۵۰,۰۰۰ ریال\nاز کارت: ۶۰۳۷۹۹******۵۵۴۱\nمانده: ۵,۲۰۰,۰۰۰ ریال\n۱۴۰۵/۰۶/۲۴ - ۲۰:۴۵',
    },
  };

  const sample = sampleMessages[sampleType] || sampleMessages.blubank_deposit;
  const simulatedEvent: NativeSmsEvent = {
    sender: sample.sender,
    body: sample.body,
    timestamp: Date.now(),
  };

  const parsed = parseSingleBankSMS(sample.body, accounts);

  // Dispatch custom event to mirror native bridge
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('nativeSmsReceived', {
        detail: simulatedEvent,
      })
    );

    if (triggerInteractivePrompt) {
      // Trigger interactive action notification
      window.dispatchEvent(
        new CustomEvent('nativeSmsActionRegister', {
          detail: {
            action: 'register',
            body: sample.body,
            bankName: sample.bank,
            amount: sample.amount,
            type: sample.type,
            timestamp: Date.now(),
          },
        })
      );
    }
  }

  return parsed;
}

/**
 * Simulates a custom SMS message interception with direct action registration
 */
export function simulateNativeSmsInterception(
  body: string,
  bankName = 'بانک',
  accounts: BankAccount[] = []
): ParsedBankSMS | null {
  const parsed = parseSingleBankSMS(body, accounts);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('nativeSmsReceived', {
        detail: {
          sender: bankName,
          body,
          timestamp: Date.now(),
        },
      })
    );
    window.dispatchEvent(
      new CustomEvent('nativeSmsActionRegister', {
        detail: {
          action: 'register',
          body,
          bankName: parsed?.bankName || bankName,
          amount: parsed?.amount || 0,
          type: parsed?.type || 'expense',
          timestamp: Date.now(),
        },
      })
    );
  }
  return parsed;
}

