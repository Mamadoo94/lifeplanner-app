import {
  Category,
  Task,
  Attribute,
  TaskAttribute,
  Habit,
  HabitLog,
  PomodoroSession,
  DailyJournal,
  Note,
  Trade,
  TradeChecklistItem,
  TradeStrategy,
  TradeRiskSettings,
  TradeAccordionState,
  BankAccount,
  FinanceCategory,
  FinanceTransaction,
  SalaryIncomeSchedule,
  SalaryAdvance,
  SmsPattern,
  AppSettings,
  LedgerParty,
  LedgerEntry,
  Loan,
} from '../types';
import { getTodayJalali, getTodayJalaliWithTime } from '../utils/jalali';

const DB_NAME = 'LifePlannerDB';
const DB_VERSION = 5;

export class LifePlannerDatabase {
  private db: IDBDatabase | null = null;
  private isSeeding = false;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('خطا در بازگشایی پایگاه داده IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. categories
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
        }

        // 2. tasks
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
          taskStore.createIndex('category_id', 'category_id', { unique: false });
          taskStore.createIndex('status', 'status', { unique: false });
          taskStore.createIndex('priority', 'priority', { unique: false });
          taskStore.createIndex('due_date', 'due_date', { unique: false });
        }

        // 3. attributes
        if (!db.objectStoreNames.contains('attributes')) {
          db.createObjectStore('attributes', { keyPath: 'id', autoIncrement: true });
        }

        // 4. task_attributes
        if (!db.objectStoreNames.contains('task_attributes')) {
          const taStore = db.createObjectStore('task_attributes', { autoIncrement: true });
          taStore.createIndex('task_id', 'task_id', { unique: false });
          taStore.createIndex('attribute_id', 'attribute_id', { unique: false });
        }

        // 5. habits
        if (!db.objectStoreNames.contains('habits')) {
          const habitStore = db.createObjectStore('habits', { keyPath: 'id', autoIncrement: true });
          habitStore.createIndex('category_id', 'category_id', { unique: false });
        }

        // 6. habit_logs
        if (!db.objectStoreNames.contains('habit_logs')) {
          const habitLogStore = db.createObjectStore('habit_logs', { keyPath: 'id', autoIncrement: true });
          habitLogStore.createIndex('habit_id', 'habit_id', { unique: false });
          habitLogStore.createIndex('completed_date_jalali', 'completed_date_jalali', { unique: false });
        }

        // 7. pomodoro_sessions
        if (!db.objectStoreNames.contains('pomodoro_sessions')) {
          const pomoStore = db.createObjectStore('pomodoro_sessions', { keyPath: 'id', autoIncrement: true });
          pomoStore.createIndex('task_id', 'task_id', { unique: false });
          pomoStore.createIndex('completed_at_jalali', 'completed_at_jalali', { unique: false });
        }

        // 8. daily_journals
        if (!db.objectStoreNames.contains('daily_journals')) {
          const journalStore = db.createObjectStore('daily_journals', { keyPath: 'id', autoIncrement: true });
          journalStore.createIndex('date_jalali', 'date_jalali', { unique: true });
        }

        // 9. notes
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
          noteStore.createIndex('category_id', 'category_id', { unique: false });
          noteStore.createIndex('parent_id', 'parent_id', { unique: false });
        }

        // 10. trades
        if (!db.objectStoreNames.contains('trades')) {
          const tradeStore = db.createObjectStore('trades', { keyPath: 'id', autoIncrement: true });
          tradeStore.createIndex('date_jalali', 'date_jalali', { unique: false });
          tradeStore.createIndex('symbol', 'symbol', { unique: false });
          tradeStore.createIndex('outcome', 'outcome', { unique: false });
          tradeStore.createIndex('psychology', 'psychology', { unique: false });
        }

        // 11. trade_checklist
        if (!db.objectStoreNames.contains('trade_checklist')) {
          db.createObjectStore('trade_checklist', { keyPath: 'id', autoIncrement: true });
        }

        // 12. trade_strategy
        if (!db.objectStoreNames.contains('trade_strategy')) {
          db.createObjectStore('trade_strategy', { keyPath: 'id' });
        }

        // 13. trade_settings
        if (!db.objectStoreNames.contains('trade_settings')) {
          db.createObjectStore('trade_settings', { keyPath: 'id' });
        }

        // 14. finance_accounts
        if (!db.objectStoreNames.contains('finance_accounts')) {
          db.createObjectStore('finance_accounts', { keyPath: 'id', autoIncrement: true });
        }

        // 15. finance_transactions
        if (!db.objectStoreNames.contains('finance_transactions')) {
          const txStore = db.createObjectStore('finance_transactions', { keyPath: 'id', autoIncrement: true });
          txStore.createIndex('account_id', 'account_id', { unique: false });
          txStore.createIndex('date_jalali', 'date_jalali', { unique: false });
          txStore.createIndex('type', 'type', { unique: false });
        }

        // 16. finance_categories
        if (!db.objectStoreNames.contains('finance_categories')) {
          db.createObjectStore('finance_categories', { keyPath: 'id', autoIncrement: true });
        }

        // 17. finance_salaries
        if (!db.objectStoreNames.contains('finance_salaries')) {
          db.createObjectStore('finance_salaries', { keyPath: 'id', autoIncrement: true });
        }

        // 18. finance_parties (Debtors & Creditors)
        if (!db.objectStoreNames.contains('finance_parties')) {
          const partyStore = db.createObjectStore('finance_parties', { keyPath: 'id', autoIncrement: true });
          partyStore.createIndex('type', 'type', { unique: false });
          partyStore.createIndex('status', 'status', { unique: false });
        }

        // 19. finance_ledger_entries
        if (!db.objectStoreNames.contains('finance_ledger_entries')) {
          const entryStore = db.createObjectStore('finance_ledger_entries', { keyPath: 'id', autoIncrement: true });
          entryStore.createIndex('party_id', 'party_id', { unique: false });
        }

        // 20. finance_loans
        if (!db.objectStoreNames.contains('finance_loans')) {
          const loanStore = db.createObjectStore('finance_loans', { keyPath: 'id', autoIncrement: true });
          loanStore.createIndex('status', 'status', { unique: false });
        }

        // 21. finance_salary_advances (مساعده حقوق)
        if (!db.objectStoreNames.contains('finance_salary_advances')) {
          const advanceStore = db.createObjectStore('finance_salary_advances', { keyPath: 'id', autoIncrement: true });
          advanceStore.createIndex('salary_id', 'salary_id', { unique: false });
          advanceStore.createIndex('status', 'status', { unique: false });
        }

        // 22. sms_patterns (الگوهای پیامک بانکی)
        if (!db.objectStoreNames.contains('sms_patterns')) {
          const patternStore = db.createObjectStore('sms_patterns', { keyPath: 'id', autoIncrement: true });
          patternStore.createIndex('bank_name', 'bank_name', { unique: false });
        }

        // 23. app_settings
        if (!db.objectStoreNames.contains('app_settings')) {
          db.createObjectStore('app_settings', { keyPath: 'id' });
        }
      };
    });
  }

  // Deduplicate any repeated categories or attributes that might have been seeded multiple times
  async cleanDuplicates(): Promise<void> {
    const cats = await this.getAll<Category>('categories');
    const seenCatTitles: Record<string, number> = {};
    for (const c of cats) {
      if (!c.id) continue;
      const cleanTitle = c.title.trim();
      if (!seenCatTitles[cleanTitle]) {
        seenCatTitles[cleanTitle] = c.id;
      } else {
        // This is a duplicate! Re-assign anything pointing to this duplicate to the first one
        const originalId = seenCatTitles[cleanTitle];
        const dupId = c.id;

        // Reassign tasks
        const tasks = await this.getAll<Task>('tasks');
        for (const t of tasks) {
          if (t.category_id === dupId) {
            t.category_id = originalId;
            await this.put('tasks', t);
          }
        }

        // Reassign habits
        const habits = await this.getAll<Habit>('habits');
        for (const h of habits) {
          if (h.category_id === dupId) {
            h.category_id = originalId;
            await this.put('habits', h);
          }
        }

        // Reassign notes
        const notes = await this.getAll<Note>('notes');
        for (const n of notes) {
          if (n.category_id === dupId) {
            n.category_id = originalId;
            await this.put('notes', n);
          }
        }

        // Delete duplicate category
        await this.delete('categories', dupId);
      }
    }

    // Deduplicate attributes
    const attrs = await this.getAll<Attribute>('attributes');
    const seenAttrTitles: Record<string, number> = {};
    for (const a of attrs) {
      if (!a.id) continue;
      const cleanTitle = a.title.trim();
      if (!seenAttrTitles[cleanTitle]) {
        seenAttrTitles[cleanTitle] = a.id;
      } else {
        // Duplicate attribute
        const originalId = seenAttrTitles[cleanTitle];
        const dupId = a.id;

        // Update task_attributes
        const db = await this.init();
        const tx = db.transaction('task_attributes', 'readwrite');
        const store = tx.objectStore('task_attributes');
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const val = cursor.value as TaskAttribute;
            if (val.attribute_id === dupId) {
              cursor.update({ ...val, attribute_id: originalId });
            }
            cursor.continue();
          }
        };

        await this.delete('attributes', dupId);
      }
    }
  }

  // Seed default data if empty
  async seedInitialData(): Promise<void> {
    const SEED_FLAG_KEY = 'lifeplanner_initial_seed_completed_v3';
    if (typeof window !== 'undefined' && localStorage.getItem(SEED_FLAG_KEY) === 'true') {
      return;
    }
    if (this.isSeeding) return;
    this.isSeeding = true;
    try {
      const categories = await this.getAll<Category>('categories');
      if (categories.length === 0) {
        const defaultCategories: Omit<Category, 'id'>[] = [
          { title: 'کاری و شغلی', color: '#3b82f6', icon: 'Briefcase' },
          { title: 'شخصی و زندگی', color: '#10b981', icon: 'User' },
          { title: 'یادگیری و مهارت', color: '#8b5cf6', icon: 'BookOpen' },
          { title: 'سلامت و تندرستی', color: '#ec4899', icon: 'HeartPulse' },
          { title: 'مالی و بودجه', color: '#f59e0b', icon: 'Wallet' },
        ];
        for (const cat of defaultCategories) {
          await this.add('categories', cat);
        }

        const defaultAttributes: Omit<Attribute, 'id'>[] = [
          { title: 'فوری و ضرب‌الاجل', icon: 'Flame' },
          { title: 'تمرکز عمیق (Deep Work)', icon: 'Brain' },
          { title: 'مستلزم تماس / پیگیری', icon: 'Phone' },
          { title: 'انرژی پایین / سبک', icon: 'Coffee' },
        ];
        for (const attr of defaultAttributes) {
          await this.add('attributes', attr);
        }

        const today = getTodayJalali();
        // Seed initial sample tasks
        const createdCats = await this.getAll<Category>('categories');
        const workCatId = createdCats[0]?.id || 1;
        const learnCatId = createdCats[2]?.id || 1;

        await this.add<Task>('tasks', {
          category_id: workCatId,
          title: 'بررسی اهداف هفتگی و اولویت‌بندی برنامه‌ها',
          priority: 'high',
          due_date: today,
          status: 'pending',
          created_at: getTodayJalaliWithTime(),
        });

        await this.add<Task>('tasks', {
          category_id: learnCatId,
          title: 'مطالعه ۳۰ صفحه کتاب معماری سیستم',
          priority: 'medium',
          due_date: today,
          status: 'pending',
          created_at: getTodayJalaliWithTime(),
        });

        // Seed habits
        const healthCatId = createdCats[3]?.id || 1;
        const habit1 = await this.add<Habit>('habits', {
          title: 'ورزش و حرکات کششی صبحگاهی (۱۵ دقیقه)',
          category_id: healthCatId,
          target_frequency: 'daily',
          icon: 'Activity',
        });
        await this.add<Habit>('habits', {
          title: 'نوشیدن ۲ لیتر آب در طول روز',
          category_id: healthCatId,
          target_frequency: 'daily',
          icon: 'Droplets',
        });
        await this.add<Habit>('habits', {
          title: 'یادداشت‌برداری شبانه در ژورنال',
          category_id: createdCats[1]?.id || 1,
          target_frequency: 'daily',
          icon: 'Feather',
        });

        // Seed initial log for habit 1
        if (habit1) {
          await this.add<HabitLog>('habit_logs', {
            habit_id: habit1,
            completed_date_jalali: today,
            status: 'done',
          });
        }

        // Seed initial note
        await this.add<Note>('notes', {
          category_id: workCatId,
          parent_id: null,
          title: 'اصول مدیریت زمان و تمرکز',
          content: 'قانون ۸۰/۲۰ پارتو: ۸۰ درصد نتایج حاصل ۲۰ درصد فعالیت‌های مهم و اولویت‌دار است. تمرکز بر کارهای با اثرگذاری بالا اولویت اصلی است.',
          updated_at_jalali: getTodayJalaliWithTime(),
        });

        // Seed today's journal placeholder
        await this.add<DailyJournal>('daily_journals', {
          date_jalali: today,
          content: 'امروز روزی پربار و سرشار از انگیزه را آغاز کرده‌ام. قصد دارم تمام وظایف اصلی‌ام را تکمیل کنم.',
          energy_score: 8,
          productivity_score: 9,
          is_locked: false,
        });

        // Seed a sample completed pomodoro
        await this.add<PomodoroSession>('pomodoro_sessions', {
          task_id: 1,
          duration_minutes: 25,
          completed_at_jalali: getTodayJalaliWithTime(),
        });
      } else {
        // Clean duplicates if any exists
        await this.cleanDuplicates();
      }

      // Seed Trade Checklist if empty
      const existingChecklist = await this.getAll<TradeChecklistItem>('trade_checklist');
      if (existingChecklist.length === 0) {
        const defaultChecklist: Omit<TradeChecklistItem, 'id'>[] = [
          { title: 'تحلیل ساختار تایم فریم بالا (HTF Structure & Key Levels)', is_checked: false, sort_order: 0 },
          { title: 'تایید شکست ساختار یا تغییر ماهیت روند (BOS / CHoCH)', is_checked: false, sort_order: 1 },
          { title: 'ورود در محدوده تخفیف یا گران‌فروشی (Premium / Discount)', is_checked: false, sort_order: 2 },
          { title: 'شکار نقدینگی و هانت کف یا سقف معتبر (Liquidity Sweep)', is_checked: false, sort_order: 3 },
          { title: 'تاییدیه اردر بلاک یا عدم تعادل قیمت (OB / FVG Mitigation)', is_checked: false, sort_order: 4 },
          { title: 'مناطق زمانی فعال بازار (London / NY Kill Zones)', is_checked: false, sort_order: 5 },
        ];
        for (const item of defaultChecklist) {
          await this.add('trade_checklist', item);
        }
      }

      // Seed Strategy if empty
      const existingStrategy = await this.getTradeStrategy();
      if (!existingStrategy) {
        await this.saveTradeStrategy(
`# پلان و قوانین معاملاتی اسمارت مانی (SMC Trading Plan)

### ۱. اصول ساختار و جهت‌گیری مارکت
- ورود به پوزیشن صرفاً در جهت روند ساختار تایم‌فریم اصلی (4H / 1H).
- شناسایی استخرهای نقدینگی دست‌نخورده (BSL / SSL) قبل از ورود.
- تاییدیه نهایی با شکست CHoCH در تایم‌فریم تریگر (5m / 15m).

### ۲. مدیریت ریسک و سرمایه (قوانین حساب پراپ)
- حداکثر ریسک مجاز در هر ترید: ۱٪ از بالانس حساب.
- تارگت حداقلی سود به زیان (R:R): ۱ به ۲.۵ یا بالاتر.
- حداکثر دراودان روزانه مجاز: ۴٪ (در صورت رسیدن به این حد، معامله برای کل روز متوقف می‌شود).
- ریسک فری کردن پوزیشن (BE) پس از شکست اولین ساختار در جهت سود.

### ۳. روانشناسی و انضباط معامله‌گر
- حداکثر ۲ معامله در روز (کیفیت بر کمیت ترجیح داده شود).
- هرگز معامله انتقامی پس از ضرر انجام نخواهم داد.
- در شرایط خستگی یا هیجان پای چارت نخواهم نشست.`
        );
      }

      // Seed sample trades if empty
      const existingTrades = await this.getAll<Trade>('trades');
      if (existingTrades.length === 0) {
        const sampleTrades: Omit<Trade, 'id'>[] = [
          {
            date_jalali: '1405/06/18',
            time: '11:30',
            symbol: 'XAUUSD',
            direction: 'long',
            entry_price: 2490.5,
            stop_loss: 2486.0,
            take_profit: 2504.0,
            lot_size: 0.22,
            risk_usd: 100,
            confluences: ['HTF Structure', 'Liquidity Sweep', 'OB / FVG'],
            psychology: 'disciplined',
            outcome: 'win',
            net_pnl: 297,
            realized_rr: 3.0,
            notes: 'شکار نقدینگی کف آسیا در کیل‌زون لندن و ری‌اکشن سریع به FVG تایم ۱۵ دقیقه.',
            created_at: '1405/06/18 11:30',
            sort_order: 0,
          },
          {
            date_jalali: '1405/06/19',
            time: '16:15',
            symbol: 'XAUUSD',
            direction: 'short',
            entry_price: 2512.0,
            stop_loss: 2516.5,
            take_profit: 2498.5,
            lot_size: 0.22,
            risk_usd: 100,
            confluences: ['BOS / CHoCH', 'Premium / Discount'],
            psychology: 'disciplined',
            outcome: 'win',
            net_pnl: 297,
            realized_rr: 3.0,
            notes: 'تاچ اوردربلاک سقف روزانه نیویورک با تاییدیه شکست ریزساختار.',
            created_at: '1405/06/19 16:15',
            sort_order: 1,
          },
          {
            date_jalali: '1405/06/20',
            time: '14:45',
            symbol: 'XAUUSD',
            direction: 'long',
            entry_price: 2505.0,
            stop_loss: 2501.0,
            take_profit: 2515.0,
            lot_size: 0.25,
            risk_usd: 100,
            confluences: ['OB / FVG'],
            psychology: 'fomo',
            outcome: 'loss',
            net_pnl: -100,
            realized_rr: -1.0,
            notes: 'ورود زودهنگام قبل از تایید نهایی چوک؛ درس: صبر برای تایید ساختار.',
            created_at: '1405/06/20 14:45',
            sort_order: 2,
          },
        ];
        for (const tr of sampleTrades) {
          await this.add('trades', tr);
        }
      }

      // Seed finance accounts and categories if empty
      const existingAccounts = await this.getAll<BankAccount>('finance_accounts');
      if (existingAccounts.length === 0) {
        const defaultAccounts: Omit<BankAccount, 'id'>[] = [
          {
            bank_name: 'بلوبانک',
            title: 'کارت روزمره و خرید',
            card_number: '6219-8610-1234-5678',
            balance: 5400000,
            color: '#3b82f6',
            sort_order: 0,
            created_at: getTodayJalaliWithTime(),
          },
          {
            bank_name: 'بانک ملت',
            title: 'حساب اصلی و حقوق',
            card_number: '6104-3378-9876-5432',
            balance: 18500000,
            color: '#ef4444',
            sort_order: 1,
            created_at: getTodayJalaliWithTime(),
          },
          {
            bank_name: 'بانک سامان',
            title: 'صندوق پس‌انداز',
            card_number: '6219-8619-4433-2211',
            balance: 32000000,
            color: '#06b6d4',
            sort_order: 2,
            created_at: getTodayJalaliWithTime(),
          },
        ];
        for (const acc of defaultAccounts) {
          await this.add('finance_accounts', acc);
        }
      }

      const existingFinanceCats = await this.getAll<FinanceCategory>('finance_categories');
      if (existingFinanceCats.length === 0) {
        const defaultFinanceCats: Omit<FinanceCategory, 'id'>[] = [
          // Expenses
          {
            title: 'خوراک و سوپرمارکت',
            type: 'expense',
            icon: 'ShoppingBag',
            color: '#f59e0b',
            subcategories: ['سوپرمارکت', 'رستوران و فست‌فود', 'میوه و سبزیجات', 'نانوایی و شیرینی'],
          },
          {
            title: 'حمل و نقل و اسنپ',
            type: 'expense',
            icon: 'Car',
            color: '#3b82f6',
            subcategories: ['بنزین و سوخت', 'اسنپ و تپسی', 'تعمیرات و سرویس', 'مترو و اتوبوس'],
          },
          {
            title: 'مسکن و قبوض',
            type: 'expense',
            icon: 'Home',
            color: '#ec4899',
            subcategories: ['اجاره‌بها', 'شارژ ساختمان', 'قبض آب و برق و گاز', 'اینترنت و شارژ سیمکارت'],
          },
          {
            title: 'کافه و رستوران',
            type: 'expense',
            icon: 'Coffee',
            color: '#8b5cf6',
            subcategories: ['کافه و قهوه', 'ناهار کاری', 'دورهمی دوستانه'],
          },
          {
            title: 'پزشکی و سلامت',
            type: 'expense',
            icon: 'HeartPulse',
            color: '#10b981',
            subcategories: ['داروخانه', 'ویزیت پزشک', 'دندانپزشکی', 'آزمایشگاه'],
          },
          {
            title: 'خرید شخصی و پوشاک',
            type: 'expense',
            icon: 'Tag',
            color: '#06b6d4',
            subcategories: ['لباس و کفش', 'لوازم بهداشتی و آرایشی', 'اکسسوری'],
          },
          {
            title: 'آموزش و کتاب',
            type: 'expense',
            icon: 'BookOpen',
            color: '#6366f1',
            subcategories: ['کتاب و مجله', 'دوره‌های آموزشی', 'ورزش و باشگاه'],
          },
          {
            title: 'اقساط و تعهدات',
            type: 'expense',
            icon: 'CreditCard',
            color: '#ef4444',
            subcategories: ['قسط وام', 'تسویه بدهی شخص', 'چک'],
          },
          {
            title: 'سایر هزینه‌ها',
            type: 'expense',
            icon: 'MoreHorizontal',
            color: '#64748b',
            subcategories: ['هزینه‌های پیش‌بینی نشده', 'هدیه و خیرات'],
          },
          // Income
          {
            title: 'حقوق و دستمزد',
            type: 'income',
            icon: 'Briefcase',
            color: '#10b981',
            subcategories: ['حقوق ثابت ماهانه', 'اضافه‌کاری و حق مأموریت', 'پاداش و عیدی'],
          },
          {
            title: 'پاداش و درآمد جانبی',
            type: 'income',
            icon: 'Zap',
            color: '#3b82f6',
            subcategories: ['پروژه‌های فریلنسری', 'مشاوره ساعتی'],
          },
          {
            title: 'سود بانکی و سرمایه‌گذاری',
            type: 'income',
            icon: 'TrendingUp',
            color: '#8b5cf6',
            subcategories: ['سود ترید و معامله‌گری', 'سود سپرده بانکی', 'سود سهام بورس'],
          },
          {
            title: 'اجاره دریافتی',
            type: 'income',
            icon: 'Home',
            color: '#f59e0b',
            subcategories: ['اجاره مسکن', 'کرایه پارکینگ یا تجهیزات'],
          },
          {
            title: 'سایر واریزها',
            type: 'income',
            icon: 'PlusCircle',
            color: '#64748b',
            subcategories: ['دریافت طلب شخصی', 'کادو و عیدی'],
          },
        ];
        for (const fc of defaultFinanceCats) {
          await this.add('finance_categories', fc);
        }
      } else {
        // Ensure existing categories have subcategories if empty
        for (const fc of existingFinanceCats) {
          if (!fc.subcategories || fc.subcategories.length === 0) {
            if (fc.title.includes('خوراک')) fc.subcategories = ['سوپرمارکت', 'رستوران و فست‌فود', 'میوه و سبزیجات'];
            else if (fc.title.includes('حمل')) fc.subcategories = ['بنزین', 'اسنپ و تپسی', 'تعمیرات'];
            else if (fc.title.includes('مسکن')) fc.subcategories = ['اجاره‌بها', 'شارژ', 'قبوض'];
            else if (fc.title.includes('حقوق')) fc.subcategories = ['حقوق ماهانه', 'پاداش'];
            else fc.subcategories = ['عمومی'];
            await this.put('finance_categories', fc);
          }
        }
      }

      // Seed default Salary Schedule if empty
      const existingSalaries = await this.getAll<SalaryIncomeSchedule>('finance_salaries');
      if (existingSalaries.length === 0) {
        await this.add<SalaryIncomeSchedule>('finance_salaries', {
          title: 'حقوق ثابت شرکتی',
          amount: 25000000,
          type: 'salary',
          payer_name: 'شرکت فناوران نوین',
          day_of_month: 28,
          destination_account_id: 2, // بانک ملت
          category_name: 'حقوق و دستمزد',
          subcategory_name: 'حقوق ثابت ماهانه',
          is_active: true,
          notes: 'واریز منظم در بیست و هشتم هر ماه خورشیدی',
        });
      }

      // Seed default Ledger Parties (Debtors & Creditors) if empty
      const existingParties = await this.getAll<LedgerParty>('finance_parties');
      if (existingParties.length === 0) {
        const p1 = await this.add<LedgerParty>('finance_parties', {
          name: 'علی محمدی (طلب شخصی)',
          phone: '09121112233',
          type: 'credit', // طلب من از شخص
          total_amount: 8500000,
          settled_amount: 3000000,
          notes: 'قرض بابت خرید لپ‌تاپ',
          due_date_jalali: '1405/07/15',
          status: 'active',
          created_at: getTodayJalaliWithTime(),
        });
        if (p1) {
          await this.add<LedgerEntry>('finance_ledger_entries', {
            party_id: p1,
            type: 'settlement',
            amount: 3000000,
            date_jalali: '1405/06/10',
            notes: 'واریز بخش اول قرض به حساب بلوبانک',
            created_at: getTodayJalaliWithTime(),
          });
        }

        await this.add<LedgerParty>('finance_parties', {
          name: 'فروشگاه لوازم خانگی رضوی',
          phone: '02188776655',
          type: 'debt', // بدهی من به شخص/فروشگاه
          total_amount: 14000000,
          settled_amount: 14000000,
          notes: 'خرید تلویزیون اقساطی دوماهه',
          due_date_jalali: '1405/05/30',
          status: 'settled',
          created_at: getTodayJalaliWithTime(),
        });
      }

      // Seed default Loan if empty
      const existingLoans = await this.getAll<Loan>('finance_loans');
      if (existingLoans.length === 0) {
        await this.add<Loan>('finance_loans', {
          title: 'تسهیلات طرح پیوند بانک رسالت',
          bank_name: 'بانک قرض‌الحسنه رسالت',
          total_amount: 60000000,
          interest_rate: 4, // ۴ درصد کارمزد
          total_installments: 24,
          paid_installments: 7,
          monthly_payment: 2600000,
          due_day_of_month: 12,
          start_date_jalali: '1404/11/12',
          destination_account_id: 1, // بلوبانک
          reminder_days_before: 2,
          reminder_enabled: true,
          status: 'active',
          notes: 'پرداخت خودکار از طریق اینترنت بانک',
          created_at: getTodayJalaliWithTime(),
        });
      }
    } finally {
      this.isSeeding = false;
      if (typeof window !== 'undefined') {
        localStorage.setItem('lifeplanner_initial_seed_completed_v3', 'true');
      }
    }
  }

  // Generic CRUD
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  async getById<T>(storeName: string, id: number): Promise<T | undefined> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  }

  async add<T>(storeName: string, item: T): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.add(item);
      let insertedId = 0;
      req.onsuccess = () => {
        insertedId = req.result as number;
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve(insertedId);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
  }

  async put<T>(storeName: string, item: T): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      let updatedId = 0;
      req.onsuccess = () => {
        updatedId = req.result as number;
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve(updatedId);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
  }

  async delete(storeName: string, id: number): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
  }

  // Clear all stores for Full App Reset
  async clearAllData(): Promise<void> {
    const db = await this.init();
    const storeNames = Array.from(db.objectStoreNames);
    for (const name of storeNames) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(name, 'readwrite');
        const store = tx.objectStore(name);
        const req = store.clear();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lifeplanner_initial_seed_completed_v3');
    }
  }

  async getAppSettings(): Promise<AppSettings> {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction('app_settings', 'readonly');
        const store = tx.objectStore('app_settings');
        const req = store.get('main');
        req.onsuccess = () => {
          if (req.result && req.result.settings) {
            resolve({
              auto_sms_tracking: req.result.settings.auto_sms_tracking ?? req.result.settings.smsAutoTracking ?? true,
              notifications_enabled: req.result.settings.notifications_enabled ?? true,
              ...req.result.settings,
            });
          } else {
            resolve({
              currency: 'toman',
              defaultSalaryPayDay: 28,
              smsAutoTracking: true,
              auto_sms_tracking: true,
              smsNotificationPrompt: true,
              notifications_enabled: true,
              hapticFeedback: true,
              soundEnabled: true,
            });
          }
        };
        req.onerror = () => {
          resolve({
            currency: 'toman',
            defaultSalaryPayDay: 28,
            smsAutoTracking: true,
            auto_sms_tracking: true,
            smsNotificationPrompt: true,
            notifications_enabled: true,
            hapticFeedback: true,
            soundEnabled: true,
          });
        };
      });
    } catch {
      return {
        currency: 'toman',
        defaultSalaryPayDay: 28,
        smsAutoTracking: true,
        auto_sms_tracking: true,
        smsNotificationPrompt: true,
        notifications_enabled: true,
        hapticFeedback: true,
        soundEnabled: true,
      };
    }
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('app_settings', 'readwrite');
      const store = tx.objectStore('app_settings');
      const req = store.put({ id: 'main', settings });
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Batch update sort orders
  async updateSortOrders(storeName: string, items: { id: number; sort_order: number }[]): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) {
        const getReq = store.get(item.id);
        getReq.onsuccess = () => {
          if (getReq.result) {
            const updated = { ...getReq.result, sort_order: item.sort_order };
            store.put(updated);
          }
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Specific query helpers
  async getJournalByDate(dateJalali: string): Promise<DailyJournal | undefined> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('daily_journals', 'readonly');
      const store = tx.objectStore('daily_journals');
      const index = store.index('date_jalali');
      const req = index.get(dateJalali);
      req.onsuccess = () => resolve(req.result as DailyJournal);
      req.onerror = () => reject(req.error);
    });
  }

  async getHabitLogsForDate(dateJalali: string): Promise<HabitLog[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('habit_logs', 'readonly');
      const store = tx.objectStore('habit_logs');
      const index = store.index('completed_date_jalali');
      const req = index.getAll(dateJalali);
      req.onsuccess = () => resolve(req.result as HabitLog[]);
      req.onerror = () => reject(req.error);
    });
  }

  async getHabitLogsByHabit(habitId: number): Promise<HabitLog[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('habit_logs', 'readonly');
      const store = tx.objectStore('habit_logs');
      const index = store.index('habit_id');
      const req = index.getAll(habitId);
      req.onsuccess = () => resolve(req.result as HabitLog[]);
      req.onerror = () => reject(req.error);
    });
  }

  async toggleHabitStatus(habitId: number, dateJalali: string): Promise<boolean> {
    const logs = await this.getHabitLogsByHabit(habitId);
    const existing = logs.find((l) => l.completed_date_jalali === dateJalali);
    if (existing && existing.id) {
      if (existing.status === 'done') {
        await this.delete('habit_logs', existing.id);
        return false;
      } else {
        existing.status = 'done';
        await this.put('habit_logs', existing);
        return true;
      }
    } else {
      await this.add<HabitLog>('habit_logs', {
        habit_id: habitId,
        completed_date_jalali: dateJalali,
        status: 'done',
      });
      return true;
    }
  }

  async getTaskAttributes(taskId: number): Promise<number[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('task_attributes', 'readonly');
      const store = tx.objectStore('task_attributes');
      const index = store.index('task_id');
      const req = index.getAll(taskId);
      req.onsuccess = () => {
        const rows = req.result as TaskAttribute[];
        resolve(rows.map((r) => r.attribute_id));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async setTaskAttributes(taskId: number, attributeIds: number[]): Promise<void> {
    const db = await this.init();
    const tx = db.transaction('task_attributes', 'readwrite');
    const store = tx.objectStore('task_attributes');
    const index = store.index('task_id');
    const req = index.openCursor(IDBKeyRange.only(taskId));

    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        // Insert new
        for (const attrId of attributeIds) {
          store.add({ task_id: taskId, attribute_id: attrId });
        }
      }
    };
  }

  async deleteCategory(categoryId: number): Promise<void> {
    await this.delete('categories', categoryId);
    const remaining = await this.getAll<Category>('categories');
    const fallbackId = remaining[0]?.id || 1;

    // Update tasks
    const tasks = await this.getAll<Task>('tasks');
    for (const t of tasks) {
      if (t.category_id === categoryId) {
        t.category_id = fallbackId;
        await this.put('tasks', t);
      }
    }

    // Update habits
    const habits = await this.getAll<Habit>('habits');
    for (const h of habits) {
      if (h.category_id === categoryId) {
        h.category_id = fallbackId;
        await this.put('habits', h);
      }
    }

    // Update notes
    const notes = await this.getAll<Note>('notes');
    for (const n of notes) {
      if (n.category_id === categoryId) {
        n.category_id = fallbackId;
        await this.put('notes', n);
      }
    }
  }

  async deleteAttribute(attributeId: number): Promise<void> {
    await this.delete('attributes', attributeId);
    const db = await this.init();
    const tx = db.transaction('task_attributes', 'readwrite');
    const store = tx.objectStore('task_attributes');
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const val = cursor.value as TaskAttribute;
        if (val.attribute_id === attributeId) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  }

  // Trade Strategy Methods
  async getTradeStrategy(): Promise<string> {
    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction('trade_strategy', 'readonly');
      const store = tx.objectStore('trade_strategy');
      const req = store.get('current_strategy');
      req.onsuccess = () => {
        if (req.result && typeof req.result.content === 'string') {
          resolve(req.result.content);
        } else {
          resolve('');
        }
      };
      req.onerror = () => resolve('');
    });
  }

  async saveTradeStrategy(content: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('trade_strategy', 'readwrite');
      const store = tx.objectStore('trade_strategy');
      const req = store.put({
        id: 'current_strategy',
        content,
        updated_at_jalali: getTodayJalaliWithTime(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Trade Checklist Methods
  async resetTradeChecklist(): Promise<void> {
    const items = await this.getAll<TradeChecklistItem>('trade_checklist');
    for (const item of items) {
      if (item.id) {
        await this.put('trade_checklist', { ...item, is_checked: false });
      }
    }
  }

  // Trade Risk Settings Methods
  async getTradeSettings(): Promise<TradeRiskSettings> {
    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction('trade_settings', 'readonly');
      const store = tx.objectStore('trade_settings');
      const req = store.get('calculator_settings');
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          resolve({
            balance: 10000,
            risk_percent: 1,
            prop_max_daily_risk_percent: 4,
            default_symbol: 'XAUUSD',
          });
        }
      };
      req.onerror = () =>
        resolve({
          balance: 10000,
          risk_percent: 1,
          prop_max_daily_risk_percent: 4,
          default_symbol: 'XAUUSD',
        });
    });
  }

  async saveTradeSettings(settings: TradeRiskSettings): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('trade_settings', 'readwrite');
      const store = tx.objectStore('trade_settings');
      const req = store.put({ ...settings, id: 'calculator_settings' });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getTradeAccordionStates(): Promise<TradeAccordionState> {
    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction('trade_settings', 'readonly');
      const store = tx.objectStore('trade_settings');
      const req = store.get('trade_accordion_states');
      req.onsuccess = () => {
        if (req.result && req.result.states) {
          resolve(req.result.states);
        } else {
          resolve({
            strategy: false,
            checklist: true,
            newTrade: true,
            analytics: true,
            history: true,
          });
        }
      };
      req.onerror = () =>
        resolve({
          strategy: false,
          checklist: true,
          newTrade: true,
          analytics: true,
          history: true,
        });
    });
  }

  async saveTradeAccordionStates(states: TradeAccordionState): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('trade_settings', 'readwrite');
      const store = tx.objectStore('trade_settings');
      const req = store.put({ id: 'trade_accordion_states', states });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Backup & Restore
  async exportAllData(): Promise<string> {
    const data: Record<string, unknown> = {};
    const stores = [
      'categories',
      'tasks',
      'attributes',
      'task_attributes',
      'habits',
      'habit_logs',
      'pomodoro_sessions',
      'daily_journals',
      'notes',
      'trades',
      'trade_checklist',
      'trade_strategy',
      'trade_settings',
      'finance_accounts',
      'finance_transactions',
      'finance_categories',
      'finance_salaries',
      'finance_parties',
      'finance_ledger_entries',
      'finance_loans',
      'finance_salary_advances',
      'sms_patterns',
    ];
    for (const s of stores) {
      data[s] = await this.getAll(s);
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Smart Merge Backup & Restore System:
   * Preserves existing host machine data, adds incoming items,
   * and updates completion statuses (tasks completed, habits checked done) from mobile/remote backups.
   */
  async importData(
    jsonString: string,
    mode: 'merge' | 'overwrite' = 'merge'
  ): Promise<{ success: boolean; stats: { added: number; updated: number; preserved: number } }> {
    try {
      const data = JSON.parse(jsonString);
      let addedCount = 0;
      let updatedCount = 0;
      let preservedCount = 0;

      const stores = [
        'categories',
        'tasks',
        'attributes',
        'task_attributes',
        'habits',
        'habit_logs',
        'pomodoro_sessions',
        'daily_journals',
        'notes',
        'trades',
        'trade_checklist',
        'trade_strategy',
        'trade_settings',
        'finance_accounts',
        'finance_transactions',
        'finance_categories',
        'finance_salaries',
        'finance_parties',
        'finance_ledger_entries',
        'finance_loans',
        'finance_salary_advances',
        'sms_patterns',
      ];

      if (mode === 'overwrite') {
        for (const s of stores) {
          if (Array.isArray(data[s])) {
            const db = await this.init();
            const tx = db.transaction(s, 'readwrite');
            const store = tx.objectStore(s);
            await new Promise<void>((res) => {
              const clearReq = store.clear();
              clearReq.onsuccess = () => res();
            });
            for (const item of data[s]) {
              await this.add(s, item);
              addedCount++;
            }
          }
        }
        return { success: true, stats: { added: addedCount, updated: 0, preserved: 0 } };
      }

      // === SMART MERGE MODE (PRESERVE EXISTING + SYNC COMPLETIONS & NEW ITEMS) ===

      // 1. Categories
      if (Array.isArray(data.categories)) {
        const existingCats = await this.getAll<Category>('categories');
        const catMap = new Map<string, Category>();
        existingCats.forEach((c) => catMap.set(c.title.trim().toLowerCase(), c));
        for (const incCat of data.categories as Category[]) {
          const key = (incCat.title || '').trim().toLowerCase();
          if (!catMap.has(key)) {
            const { id, ...rest } = incCat;
            await this.add('categories', rest);
            addedCount++;
          } else {
            preservedCount++;
          }
        }
      }

      // 2. Attributes
      if (Array.isArray(data.attributes)) {
        const existingAttrs = await this.getAll<Attribute>('attributes');
        const attrMap = new Map<string, Attribute>();
        existingAttrs.forEach((a) => attrMap.set(a.title.trim().toLowerCase(), a));
        for (const incAttr of data.attributes as Attribute[]) {
          const key = (incAttr.title || '').trim().toLowerCase();
          if (!attrMap.has(key)) {
            const { id, ...rest } = incAttr;
            await this.add('attributes', rest);
            addedCount++;
          } else {
            preservedCount++;
          }
        }
      }

      // 3. Tasks & Completion Status Merge
      if (Array.isArray(data.tasks)) {
        const existingTasks = await this.getAll<Task>('tasks');
        const taskById = new Map<number, Task>();
        const taskBySignature = new Map<string, Task>();
        existingTasks.forEach((t) => {
          if (t.id) taskById.set(t.id, t);
          const sig = `${(t.title || '').trim()}___${t.due_date || ''}`;
          taskBySignature.set(sig, t);
        });

        for (const incTask of data.tasks as Task[]) {
          const sig = `${(incTask.title || '').trim()}___${incTask.due_date || ''}`;
          let match = incTask.id ? taskById.get(incTask.id) : undefined;
          if (!match) match = taskBySignature.get(sig);

          if (match) {
            // If incoming task was marked 'completed' on mobile, propagate status to host!
            if (incTask.status === 'completed' && match.status !== 'completed') {
              match.status = 'completed';
              await this.put('tasks', match);
              updatedCount++;
            } else {
              preservedCount++;
            }
          } else {
            // New incoming task - add to host
            const { id, ...rest } = incTask;
            await this.add('tasks', rest);
            addedCount++;
          }
        }
      }

      // 4. Task Attributes Mapping
      if (Array.isArray(data.task_attributes)) {
        const existingTaskAttrs = await this.getAll<TaskAttribute>('task_attributes');
        const set = new Set(existingTaskAttrs.map((ta) => `${ta.task_id}_${ta.attribute_id}`));
        for (const incTA of data.task_attributes as TaskAttribute[]) {
          const key = `${incTA.task_id}_${incTA.attribute_id}`;
          if (!set.has(key)) {
            await this.add('task_attributes', incTA);
            addedCount++;
          }
        }
      }

      // 5. Habits
      if (Array.isArray(data.habits)) {
        const existingHabits = await this.getAll<Habit>('habits');
        const habitMap = new Map<string, Habit>();
        existingHabits.forEach((h) => {
          if (h.id) habitMap.set(String(h.id), h);
          habitMap.set(h.title.trim().toLowerCase(), h);
        });

        for (const incHabit of data.habits as Habit[]) {
          const idKey = incHabit.id ? String(incHabit.id) : '';
          const titleKey = (incHabit.title || '').trim().toLowerCase();
          const match = (idKey && habitMap.get(idKey)) || habitMap.get(titleKey);

          if (!match) {
            const { id, ...rest } = incHabit;
            await this.add('habits', rest);
            addedCount++;
          } else {
            preservedCount++;
          }
        }
      }

      // 6. Habit Logs (Daily Ticks & Completions)
      if (Array.isArray(data.habit_logs)) {
        const existingLogs = await this.getAll<HabitLog>('habit_logs');
        const logMap = new Map<string, HabitLog>();
        existingLogs.forEach((l) => {
          logMap.set(`${l.habit_id}_${l.completed_date_jalali}`, l);
        });

        for (const incLog of data.habit_logs as HabitLog[]) {
          const key = `${incLog.habit_id}_${incLog.completed_date_jalali}`;
          const match = logMap.get(key);

          if (match) {
            // If incoming has done status and host doesn't, update host
            if (incLog.status === 'done' && match.status !== 'done') {
              match.status = 'done';
              await this.put('habit_logs', match);
              updatedCount++;
            } else {
              preservedCount++;
            }
          } else {
            // New completion log from mobile
            const { id, ...rest } = incLog;
            await this.add('habit_logs', rest);
            addedCount++;
          }
        }
      }

      // 7. Pomodoro Sessions
      if (Array.isArray(data.pomodoro_sessions)) {
        const existingSessions = await this.getAll<PomodoroSession>('pomodoro_sessions');
        const sessionKeys = new Set(
          existingSessions.map((s) => `${s.completed_at_jalali}_${s.duration_minutes}`)
        );

        for (const incSess of data.pomodoro_sessions as PomodoroSession[]) {
          const key = `${incSess.completed_at_jalali}_${incSess.duration_minutes}`;
          if (!sessionKeys.has(key)) {
            const { id, ...rest } = incSess;
            await this.add('pomodoro_sessions', rest);
            addedCount++;
          } else {
            preservedCount++;
          }
        }
      }

      // 8. Daily Journals
      if (Array.isArray(data.daily_journals)) {
        const existingJournals = await this.getAll<DailyJournal>('daily_journals');
        const journalMap = new Map<string, DailyJournal>();
        existingJournals.forEach((j) => journalMap.set(j.date_jalali, j));

        for (const incJ of data.daily_journals as DailyJournal[]) {
          const match = journalMap.get(incJ.date_jalali);
          if (!match) {
            const { id, ...rest } = incJ;
            await this.add('daily_journals', rest);
            addedCount++;
          } else {
            // If existing journal has empty content but incoming has rich content
            if (!match.content && incJ.content) {
              match.content = incJ.content;
              match.energy_score = incJ.energy_score;
              match.productivity_score = incJ.productivity_score;
              await this.put('daily_journals', match);
              updatedCount++;
            } else {
              preservedCount++;
            }
          }
        }
      }

      // 9. Notes
      if (Array.isArray(data.notes)) {
        const existingNotes = await this.getAll<Note>('notes');
        const noteMap = new Map<string, Note>();
        existingNotes.forEach((n) => {
          if (n.id) noteMap.set(String(n.id), n);
          noteMap.set(n.title.trim().toLowerCase(), n);
        });

        for (const incNote of data.notes as Note[]) {
          const idKey = incNote.id ? String(incNote.id) : '';
          const titleKey = (incNote.title || '').trim().toLowerCase();
          const match = (idKey && noteMap.get(idKey)) || noteMap.get(titleKey);

          if (!match) {
            const { id, ...rest } = incNote;
            await this.add('notes', rest);
            addedCount++;
          } else {
            preservedCount++;
          }
        }
      }

      // 10. Trades
      if (Array.isArray(data.trades)) {
        const existingTrades = await this.getAll<Trade>('trades');
        const tradeMap = new Map<string, Trade>();
        existingTrades.forEach((t) => {
          tradeMap.set(`${t.date_jalali}_${t.time}_${t.symbol}`, t);
          if (t.id) tradeMap.set(`id_${t.id}`, t);
        });

        for (const incTrade of data.trades as Trade[]) {
          const key = `${incTrade.date_jalali}_${incTrade.time}_${incTrade.symbol}`;
          const idKey = incTrade.id ? `id_${incTrade.id}` : '';
          const match = (idKey && tradeMap.get(idKey)) || tradeMap.get(key);

          if (!match) {
            const { id, ...rest } = incTrade;
            await this.add('trades', rest);
            addedCount++;
          } else {
            // Update outcome if incoming trade was closed on mobile
            if (match.outcome === 'open' && incTrade.outcome !== 'open') {
              match.outcome = incTrade.outcome;
              match.net_pnl = incTrade.net_pnl;
              match.realized_rr = incTrade.realized_rr;
              if (incTrade.screenshot_url) match.screenshot_url = incTrade.screenshot_url;
              if (incTrade.notes) match.notes = incTrade.notes;
              await this.put('trades', match);
              updatedCount++;
            } else {
              preservedCount++;
            }
          }
        }
      }

      // 11. Trade Checklist
      if (Array.isArray(data.trade_checklist)) {
        const existingChecklist = await this.getAll<TradeChecklistItem>('trade_checklist');
        const chkMap = new Map<string, TradeChecklistItem>();
        existingChecklist.forEach((c) => chkMap.set(c.title.trim(), c));

        for (const incChk of data.trade_checklist as TradeChecklistItem[]) {
          const key = (incChk.title || '').trim();
          const match = chkMap.get(key);
          if (!match) {
            const { id, ...rest } = incChk;
            await this.add('trade_checklist', rest);
            addedCount++;
          } else {
            if (incChk.is_checked && !match.is_checked) {
              match.is_checked = true;
              await this.put('trade_checklist', match);
              updatedCount++;
            } else {
              preservedCount++;
            }
          }
        }
      }

      // 12. Trade Strategy & Settings
      if (data.trade_strategy && typeof data.trade_strategy === 'string') {
        const currentStrategy = await this.getTradeStrategy();
        if (!currentStrategy.trim() && data.trade_strategy.trim()) {
          await this.saveTradeStrategy(data.trade_strategy);
          updatedCount++;
        }
      }

      // 13. Finance Accounts
      if (Array.isArray(data.finance_accounts)) {
        const existingAccs = await this.getAll<BankAccount>('finance_accounts');
        const accMap = new Map<string, BankAccount>();
        existingAccs.forEach((a) => {
          if (a.id) accMap.set(String(a.id), a);
          accMap.set(`${(a.bank_name || '').trim()}_${(a.title || '').trim()}`, a);
        });

        for (const incAcc of data.finance_accounts as BankAccount[]) {
          const idKey = incAcc.id ? String(incAcc.id) : '';
          const nameKey = `${(incAcc.bank_name || '').trim()}_${(incAcc.title || '').trim()}`;
          const match = (idKey && accMap.get(idKey)) || accMap.get(nameKey);

          if (!match) {
            const { id, ...rest } = incAcc;
            await this.add('finance_accounts', rest);
            addedCount++;
          } else {
            // Keep host balance unless incoming has newer updated balance
            preservedCount++;
          }
        }
      }

      // 14. Finance Transactions
      if (Array.isArray(data.finance_transactions)) {
        const existingTxs = await this.getAll<FinanceTransaction>('finance_transactions');
        const txMap = new Map<string, FinanceTransaction>();
        existingTxs.forEach((t) => {
          txMap.set(`${t.date_jalali}_${t.amount}_${t.type}_${t.account_id}`, t);
          if (t.id) txMap.set(`id_${t.id}`, t);
        });

        for (const incTx of data.finance_transactions as FinanceTransaction[]) {
          const key = `${incTx.date_jalali}_${incTx.amount}_${incTx.type}_${incTx.account_id}`;
          const idKey = incTx.id ? `id_${incTx.id}` : '';
          const match = (idKey && txMap.get(idKey)) || txMap.get(key);

          if (!match) {
            const { id, ...rest } = incTx;
            await this.add('finance_transactions', rest);
            addedCount++;
          } else {
            preservedCount++;
          }
        }
      }

      // 15. Finance Categories
      if (Array.isArray(data.finance_categories)) {
        const existingFCats = await this.getAll<FinanceCategory>('finance_categories');
        const fCatMap = new Map<string, FinanceCategory>();
        existingFCats.forEach((fc) => fCatMap.set(`${fc.title.trim()}_${fc.type}`, fc));

        for (const incFC of data.finance_categories as FinanceCategory[]) {
          const key = `${(incFC.title || '').trim()}_${incFC.type}`;
          if (!fCatMap.has(key)) {
            const { id, ...rest } = incFC;
            await this.add('finance_categories', rest);
            addedCount++;
          } else {
            preservedCount++;
          }
        }
      }

      return {
        success: true,
        stats: { added: addedCount, updated: updatedCount, preserved: preservedCount },
      };
    } catch (err) {
      console.error('Failed to smart-merge backup data', err);
      return { success: false, stats: { added: 0, updated: 0, preserved: 0 } };
    }
  }

  // Finance Helper: update account balance
  async updateAccountBalance(accountId: number, delta: number): Promise<void> {
    const acc = await this.getById<BankAccount>('finance_accounts', accountId);
    if (acc) {
      acc.balance = (acc.balance || 0) + delta;
      await this.put('finance_accounts', acc);
    }
  }

  async setAccountBalance(accountId: number, newBalance: number): Promise<void> {
    const acc = await this.getById<BankAccount>('finance_accounts', accountId);
    if (acc) {
      acc.balance = newBalance;
      await this.put('finance_accounts', acc);
    }
  }

  /**
   * Smart Fallback: Reassign transactions from oldCategoryName to newCategoryName,
   * then delete the old category from finance_categories.
   */
  async reassignFinanceCategory(
    oldCategoryId: number,
    targetCatIdOrOldName: number | string,
    newCategoryName?: string,
    newCategoryId?: number
  ): Promise<{ reassignedCount: number }> {
    let oldName = '';
    let newName = '';
    let targetId: number | undefined = newCategoryId;

    if (typeof targetCatIdOrOldName === 'number') {
      targetId = targetCatIdOrOldName;
      const [oldCat, newCat] = await Promise.all([
        this.getById<FinanceCategory>('finance_categories', oldCategoryId),
        this.getById<FinanceCategory>('finance_categories', targetId),
      ]);
      oldName = oldCat?.title || '';
      newName = newCat?.title || 'سایر';
    } else {
      oldName = targetCatIdOrOldName;
      newName = newCategoryName || 'سایر';
    }

    const allTxs = await this.getAll<FinanceTransaction>('finance_transactions');
    let reassignedCount = 0;

    for (const tx of allTxs) {
      const matchById = tx.category_id && tx.category_id === oldCategoryId;
      const matchByName = oldName && tx.category_name && tx.category_name.trim() === oldName.trim();
      if (matchById || matchByName) {
        tx.category_name = newName;
        tx.category_id = targetId;
        await this.put('finance_transactions', tx);
        reassignedCount++;
      }
    }

    // Delete the old category
    await this.delete('finance_categories', oldCategoryId);

    return { reassignedCount };
  }
}

export const dbInstance = new LifePlannerDatabase();

