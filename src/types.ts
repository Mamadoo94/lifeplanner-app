export interface Category {
  id?: number;
  title: string;
  color: string;
  icon: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'completed';

export interface Task {
  id?: number;
  category_id: number;
  title: string;
  priority: TaskPriority;
  due_date: string; // Jalali YYYY/MM/DD
  due_time?: string; // HH:mm (e.g. 14:30)
  status: TaskStatus;
  created_at: string;
  sort_order?: number;
}

export interface Attribute {
  id?: number;
  title: string;
  icon: string;
  color?: string;
}

export interface TaskAttribute {
  task_id: number;
  attribute_id: number;
}

export type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Habit {
  id?: number;
  title: string;
  category_id: number;
  target_frequency: HabitFrequency;
  target_count?: number; // e.g. 3 times a week or 1 time a month
  icon: string;
  reminder_time?: string; // HH:mm (e.g. 08:30)
  target_date?: string; // Jalali YYYY/MM/DD (optional start or target date)
  sort_order?: number;
  // Customizable Recurring Habit Schedules:
  weekly_days?: number[]; // Array of Persian weekday indices [0..6] (0: شنبه, 1: یکشنبه, ..., 6: جمعه)
  monthly_type?: 'day_of_month' | 'last_day'; // 'day_of_month' (روز مشخص ماه) | 'last_day' (روز آخر ماه)
  monthly_day?: number; // 1 to 31 when monthly_type is 'day_of_month'
}

export interface HabitLog {
  id?: number;
  habit_id: number;
  completed_date_jalali: string; // YYYY/MM/DD
  status: 'done' | 'missed';
}

export interface PomodoroSession {
  id?: number;
  task_id: number | null;
  habit_id?: number | null;
  target_type?: 'task' | 'habit';
  duration_minutes: number;
  completed_at_jalali: string; // YYYY/MM/DD HH:mm
}

export interface DailyJournal {
  id?: number;
  date_jalali: string; // YYYY/MM/DD (unique)
  content: string;
  energy_score: number; // 1-10
  productivity_score: number; // 1-10
  is_locked: boolean;
  sort_order?: number;
}

export interface Note {
  id?: number;
  category_id: number;
  parent_id: number | null; // hierarchical
  title: string;
  content: string;
  updated_at_jalali: string;
  sort_order?: number;
}

export type ActiveTab = 'dashboard' | 'tasks' | 'habits' | 'pomodoro' | 'trade' | 'finance' | 'journal' | 'stats' | 'settings';

export type TradeDirection = 'long' | 'short';
export type TradeOutcome = 'win' | 'loss' | 'breakeven' | 'open' | 'draft';
export type TradePsychology = 'disciplined' | 'emotional' | 'revenge' | 'fomo' | 'fear';

export interface TradeScreenshot {
  id: string;
  url: string;
  title?: string;
  type: 'upload' | 'link';
}

export interface Trade {
  id?: number;
  date_jalali: string; // YYYY/MM/DD
  time: string; // HH:mm
  symbol: string; // e.g. "XAUUSD"
  direction: TradeDirection;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  lot_size: number;
  risk_usd: number;
  confluences: string[];
  screenshot_url?: string;
  screenshots?: TradeScreenshot[];
  psychology: TradePsychology;
  outcome: TradeOutcome;
  net_pnl: number;
  realized_rr: number;
  notes?: string;
  setup_notes?: string;
  is_draft?: boolean;
  sort_order?: number;
  created_at: string;
}

export interface TradeChecklistItem {
  id?: number;
  title: string;
  is_checked: boolean;
  sort_order?: number;
}

export interface TradeStrategy {
  id: string; // 'current_strategy'
  content: string;
  updated_at_jalali: string;
}

export interface TradeAccordionState {
  strategy: boolean;
  checklist: boolean;
  newTrade: boolean;
  analytics: boolean;
  history: boolean;
  calculator?: boolean;
}

export interface TradeRiskSettings {
  balance: number;
  risk_percent: number;
  prop_max_daily_risk_percent: number;
  default_symbol: string;
  golden_rules?: string;
  accordion_states?: TradeAccordionState;
}

// ==========================================
// FINANCIAL MANAGEMENT & BANK SMS PARSER
// ==========================================
export interface BankAccount {
  id?: number;
  bank_name: string; // e.g. "بانک ملت", "بلوبانک", "بانک سامان"
  title: string; // e.g. "کارت اصلی حقوق", "حساب پس‌انداز"
  card_number?: string; // e.g. "6037-9918-..." or "4512"
  account_number?: string;
  balance: number; // in Tomans
  color: string; // Hex color or Tailwind accent
  icon?: string;
  sort_order?: number;
  created_at?: string;
}

export type TransactionType = 'expense' | 'income'; // برداشت vs واریز

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  subcategories?: string[];
}

export interface FinanceCategory {
  id?: number;
  title: string;
  type: TransactionType;
  icon: string;
  color: string;
  subcategories?: string[];
}

export interface FinanceTransaction {
  id?: number;
  account_id: number;
  type: TransactionType;
  amount: number; // in Tomans
  category_id?: number;
  category_name?: string;
  subcategory_name?: string;
  description: string;
  date_jalali: string; // YYYY/MM/DD
  time?: string; // HH:mm
  balance_after?: number; // موجودی پس از تراکنش
  raw_sms?: string;
  sort_order?: number;
  party_id?: number; // طرف حساب مربوطه (در صورت ارتباط با دفتر اشخاص)
  is_advance_salary?: boolean; // آیا مساعده حقوق است؟
  advance_id?: number; // شناسه رکورد مساعده
  created_at: string;
}

// Salary & Recurring Income
export interface SalaryIncomeSchedule {
  id?: number;
  title: string; // e.g. "حقوق ماهیانه شرکت", "اجاره واحد تجاری"
  amount: number; // in Tomans
  type: 'salary' | 'recurring_income';
  payer_name?: string;
  day_of_month: number; // 1 to 31
  destination_account_id?: number;
  category_name?: string;
  subcategory_name?: string;
  is_active: boolean;
  notes?: string;
  last_registered_date?: string; // Jalali YYYY/MM
}

// Advance Salary (مساعده حقوق)
export interface SalaryAdvance {
  id?: number;
  salary_id?: number; // کدام حقوق ماهانه
  title: string; // e.g. "مساعده مهرماه"
  amount: number; // کل مبلغ مساعده دریافتی (تومان)
  date_jalali: string; // تاریخ دریافت مساعده
  total_months: number; // چند ماه کسر شود (مثلاً ۱، ۲ یا ۳ ماهه)
  deducted_months: number; // چند ماه تاکنون کسر شده
  monthly_deduction: number; // مبلغ کسر در هر ماه (تومان)
  remaining_amount: number; // باقیمانده مساعده
  destination_account_id?: number; // به کدام حساب واریز شد
  status: 'active' | 'settled'; // فعال یا تسویه شده
  notes?: string;
  created_at: string;
}

// SMS Patterns for Pattern Learning Engine
export interface SmsPattern {
  id?: number;
  bank_name: string; // e.g. "بلوبانک", "بانک ملت"
  pattern_name: string; // e.g. "قالب پیامک واریز کارت به کارت"
  sample_sms: string; // متن نمونه
  type: TransactionType; // expense | income
  amount_regex?: string; // الگوی استخراج مبلغ (اختیاری)
  balance_regex?: string; // الگوی استخراج مانده (اختیاری)
  account_card_regex?: string; // الگوی کارت یا حساب (اختیاری)
  notes?: string;
  created_at: string;
}

// In-App Settings & Preferences
export interface AppSettings {
  currency: 'toman' | 'rial' | 'usd';
  defaultSalaryPayDay: number; // 1-31
  smsAutoTracking: boolean;
  auto_sms_tracking?: boolean;
  smsNotificationPrompt: boolean;
  notifications_enabled?: boolean;
  hapticFeedback: boolean;
  soundEnabled: boolean;
}

// Debtors & Creditors / Accounts Ledger (دفتر حساب اشخاص)
export interface LedgerParty {
  id?: number;
  name: string; // نام شخص یا شرکت طرف حساب
  phone?: string;
  type: 'debt' | 'credit'; // 'debt' (بدهکاری من به او) | 'credit' (طلب من از او)
  total_amount: number; // کل مبلغ (تومان)
  settled_amount: number; // مبلغ تسویه‌شده (تومان)
  notes?: string;
  due_date_jalali?: string; // تاریخ سررسید تسویه
  last_settlement_date?: string;
  status: 'active' | 'settled';
  created_at: string;
}

export interface LedgerEntry {
  id?: number;
  party_id: number;
  type: 'increase' | 'settlement'; // افزایش بدهی/طلب یا تسویه/پرداخت
  amount: number; // in Tomans
  date_jalali: string;
  account_id?: number;
  notes?: string;
  created_at: string;
}

// Loans & Installments Management (وام‌ها و اقساط)
export interface Loan {
  id?: number;
  title: string; // e.g. "وام تسهیلات بانک رسالت", "وام مسکن"
  bank_name: string;
  total_amount: number; // مبلغ کل وام (تومان)
  interest_rate: number; // درصد سود یا کارمزد سالانه
  total_installments: number; // تعداد کل اقساط
  paid_installments: number; // تعداد اقساط پرداخت‌شده
  monthly_payment: number; // مبلغ هر قسط (تومان)
  due_day_of_month: number; // روز سررسید هر ماه (۱ تا ۳۱)
  start_date_jalali: string; // تاریخ شروع وام
  destination_account_id?: number; // حساب متصل برای کسر قسط
  linked_account_id?: number; // حساب متصل برای کسر قسط
  reminder_days_before: number; // روزهای قبل برای یادآوری (مثلاً ۲ روز قبل)
  reminder_enabled: boolean;
  status: 'active' | 'completed' | 'paid';
  notes?: string;
  created_at: string;
}

export interface ParsedBankSMS {
  id: string;
  type: TransactionType;
  amount: number; // in Tomans
  rawAmountText: string;
  unit: 'rial' | 'toman';
  bankName: string;
  accountOrCard?: string;
  matchedAccountId?: number;
  date_jalali: string;
  time?: string;
  balance_after?: number;
  description: string;
  raw_sms: string;
  confidence: number;
}

