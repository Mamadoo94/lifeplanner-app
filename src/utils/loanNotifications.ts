import { Loan, SalaryIncomeSchedule } from '../types';
import { notificationSystem, isNativeMobile } from './notifications';
import { toPersianDigits, getTodayJalali } from './jalali';

/**
 * Calculates the next trigger Date for a specific day of the Persian month.
 */
function getNextPersianMonthDayDate(dayOfMonth: number, daysBefore: number = 0): Date {
  const now = new Date();
  const targetDay = Math.max(1, Math.min(31, dayOfMonth - daysBefore));
  
  // Approximate next occurrence (days forward)
  const todayDate = now.getDate();
  let daysDiff = targetDay - todayDate;
  if (daysDiff <= 0) {
    daysDiff += 30; // schedule for next month cycle
  }

  const triggerDate = new Date(now.getTime() + daysDiff * 24 * 60 * 60 * 1000);
  triggerDate.setHours(9, 0, 0, 0); // 9:00 AM
  return triggerDate;
}

/**
 * Schedules native local notification reminder for upcoming loan installment
 */
export async function scheduleLoanReminder(loan: Loan): Promise<boolean> {
  if (!loan.reminder_enabled || !loan.id) return false;

  const reminderDate = getNextPersianMonthDayDate(
    loan.due_day_of_month,
    loan.reminder_days_before || 0
  );

  const title = `یادآوری سررسید قسط: ${loan.title}`;
  const body = `قسط ${toPersianDigits(loan.monthly_payment.toLocaleString())} تومانی ${loan.bank_name} در تاریخ ${toPersianDigits(loan.due_day_of_month)} این ماه سررسید می‌شود. (${toPersianDigits(loan.paid_installments)} از ${toPersianDigits(loan.total_installments)} قسط پرداخت شده)`;

  return notificationSystem.scheduleAlarm({
    id: 800000 + loan.id,
    title,
    body,
    atDate: reminderDate,
    type: 'task',
    sound: 'alarm.wav',
  });
}

/**
 * Cancels a scheduled loan reminder
 */
export async function cancelLoanReminder(loanId: number): Promise<void> {
  await notificationSystem.cancelAlarm(800000 + loanId);
}

/**
 * Schedules reminder for recurring salary or income expected day
 */
export async function scheduleSalaryReminder(salary: SalaryIncomeSchedule): Promise<boolean> {
  if (!salary.is_active || !salary.id) return false;

  const reminderDate = getNextPersianMonthDayDate(salary.day_of_month, 0);

  const title = `موعد واریز: ${salary.title}`;
  const body = `امروز موعد واریز ${salary.title} به مبلغ ${toPersianDigits(salary.amount.toLocaleString())} تومان است. جهت ثبت سریع در حساب‌ها کلیک کنید.`;

  return notificationSystem.scheduleAlarm({
    id: 900000 + salary.id,
    title,
    body,
    atDate: reminderDate,
    type: 'task',
  });
}

/**
 * Schedules reminders for a list of active loans
 */
export async function scheduleUpcomingLoanReminders(loans: Loan[]): Promise<void> {
  for (const loan of loans) {
    if (loan.reminder_enabled && loan.status === 'active') {
      try {
        await scheduleLoanReminder(loan);
      } catch (err) {
        console.warn('Failed to schedule loan reminder for loan:', loan.id, err);
      }
    }
  }
}

