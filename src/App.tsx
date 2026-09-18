import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActiveTab,
  Task,
  Habit,
  HabitLog,
  PomodoroSession,
  DailyJournal,
  Note,
  Category,
  Attribute,
  Trade,
  TradeChecklistItem,
  TradeRiskSettings,
  BankAccount,
  FinanceTransaction,
  FinanceCategory,
  SalaryIncomeSchedule,
  LedgerParty,
  LedgerEntry,
  Loan,
  SalaryAdvance,
  SmsPattern,
  AppSettings,
} from './types';
import { App as CapApp } from '@capacitor/app';
import { dbInstance } from './db/indexedDB';
import { getTodayJalali, toPersianDigits, isHabitScheduledForDate } from './utils/jalali';
import { notificationSystem } from './utils/notifications';
import { scheduleUpcomingLoanReminders } from './utils/loanNotifications';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { TasksView } from './components/TasksView';
import { HabitsView } from './components/HabitsView';
import { PomodoroView } from './components/PomodoroView';
import { JournalNotesView } from './components/JournalNotesView';
import { StatsView } from './components/StatsView';
import { TradeView } from './components/TradeView';
import { FinanceView } from './components/FinanceView';
import { SettingsView } from './components/SettingsView';
import { ApkExportModal } from './components/ApkExportModal';
import { BackupModal } from './components/BackupModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Core Data Collections
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskAttributesMap, setTaskAttributesMap] = useState<Record<number, number[]>>({});
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [journals, setJournals] = useState<DailyJournal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeChecklist, setTradeChecklist] = useState<TradeChecklistItem[]>([]);
  const [tradeStrategy, setTradeStrategy] = useState<string>('');
  const [tradeRiskSettings, setTradeRiskSettings] = useState<TradeRiskSettings>({
    balance: 10000,
    risk_percent: 1,
    prop_max_daily_risk_percent: 4,
    default_symbol: 'XAUUSD',
  });

  // Finance Collections
  const [financeAccounts, setFinanceAccounts] = useState<BankAccount[]>([]);
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [financeSalaries, setFinanceSalaries] = useState<SalaryIncomeSchedule[]>([]);
  const [financeSalaryAdvances, setFinanceSalaryAdvances] = useState<SalaryAdvance[]>([]);
  const [financeParties, setFinanceParties] = useState<LedgerParty[]>([]);
  const [financeLedgerEntries, setFinanceLedgerEntries] = useState<LedgerEntry[]>([]);
  const [financeLoans, setFinanceLoans] = useState<Loan[]>([]);
  const [smsPatterns, setSmsPatterns] = useState<SmsPattern[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    currency: 'toman',
    defaultSalaryPayDay: 28,
    smsAutoTracking: true,
    auto_sms_tracking: true,
    smsNotificationPrompt: true,
    notifications_enabled: true,
    hapticFeedback: true,
    soundEnabled: true,
  });

  // Selected Target for Pomodoro (Task or Habit)
  const [selectedPomodoroTaskId, setSelectedPomodoroTaskId] = useState<number | null>(null);
  const [selectedPomodoroHabitId, setSelectedPomodoroHabitId] = useState<number | null>(null);
  const [selectedPomodoroTargetType, setSelectedPomodoroTargetType] = useState<'task' | 'habit'>('task');

  // Modals
  const [isApkGuideOpen, setIsApkGuideOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  // Load all data from IndexedDB
  const refreshAllData = useCallback(async () => {
    try {
      await dbInstance.init();
      await dbInstance.seedInitialData();

      const [
        cats,
        attrs,
        ts,
        hs,
        hlogs,
        pomos,
        jrnls,
        nts,
        trds,
        chklist,
        strat,
        setts,
        finAccounts,
        finTxs,
        finCats,
        finSalaries,
        finParties,
        finEntries,
        finLoans,
        finSalaryAdvances,
        patterns,
        appSt,
      ] = await Promise.all([
        dbInstance.getAll<Category>('categories'),
        dbInstance.getAll<Attribute>('attributes'),
        dbInstance.getAll<Task>('tasks'),
        dbInstance.getAll<Habit>('habits'),
        dbInstance.getAll<HabitLog>('habit_logs'),
        dbInstance.getAll<PomodoroSession>('pomodoro_sessions'),
        dbInstance.getAll<DailyJournal>('daily_journals'),
        dbInstance.getAll<Note>('notes'),
        dbInstance.getAll<Trade>('trades'),
        dbInstance.getAll<TradeChecklistItem>('trade_checklist'),
        dbInstance.getTradeStrategy(),
        dbInstance.getTradeSettings(),
        dbInstance.getAll<BankAccount>('finance_accounts'),
        dbInstance.getAll<FinanceTransaction>('finance_transactions'),
        dbInstance.getAll<FinanceCategory>('finance_categories'),
        dbInstance.getAll<SalaryIncomeSchedule>('finance_salaries'),
        dbInstance.getAll<LedgerParty>('finance_parties'),
        dbInstance.getAll<LedgerEntry>('finance_ledger_entries'),
        dbInstance.getAll<Loan>('finance_loans'),
        dbInstance.getAll<SalaryAdvance>('finance_salary_advances'),
        dbInstance.getAll<SmsPattern>('sms_patterns'),
        dbInstance.getAppSettings(),
      ]);

      // Overdue Tasks Auto-Rollover: shift pending overdue tasks to today
      const today = getTodayJalali();
      let hasOverdueUpdated = false;
      for (const t of ts) {
        if (t.status === 'pending' && t.due_date && t.due_date.trim() < today) {
          t.due_date = today;
          await dbInstance.put('tasks', t);
          hasOverdueUpdated = true;
        }
      }

      ts.sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
      hs.sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
      jrnls.sort((a, b) => (a.sort_order !== undefined && b.sort_order !== undefined) ? a.sort_order - b.sort_order : b.date_jalali.localeCompare(a.date_jalali));
      nts.sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
      trds.sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
      chklist.sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
      finAccounts.sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
      finTxs.sort((a, b) => (b.date_jalali || '').localeCompare(a.date_jalali || ''));

      setCategories(cats);
      setAttributes(attrs);
      setTasks(ts);
      setHabits(hs);
      setHabitLogs(hlogs);
      setPomodoroSessions(pomos);
      setJournals(jrnls);
      setNotes(nts);
      setTrades(trds);
      setTradeChecklist(chklist);
      setTradeStrategy(strat);
      setTradeRiskSettings(setts);
      setFinanceAccounts(finAccounts);
      setFinanceTransactions(finTxs);
      setFinanceCategories(finCats);
      setFinanceSalaries(finSalaries);
      setFinanceParties(finParties);
      setFinanceLedgerEntries(finEntries);
      setFinanceLoans(finLoans);
      setFinanceSalaryAdvances(finSalaryAdvances);
      setSmsPatterns(patterns);
      if (appSt) {
        setAppSettings(appSt);
      }

      // Schedule local alarm notifications for upcoming loan installments
      if (finLoans && finLoans.length > 0) {
        scheduleUpcomingLoanReminders(finLoans);
      }

      // Load task attributes map
      const attrMap: Record<number, number[]> = {};
      for (const t of ts) {
        if (t.id) {
          const aIds = await dbInstance.getTaskAttributes(t.id);
          attrMap[t.id] = aIds;
        }
      }
      setTaskAttributesMap(attrMap);
    } catch (err) {
      console.error('Failed to load from IndexedDB', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Background notification & alarm scheduler loop for tasks & habits
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkScheduledAlerts = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const today = getTodayJalali();

      // 1. Check Tasks (Due today with matching due_time)
      tasks.forEach((t) => {
        if (t.status === 'pending' && t.due_date === today && t.due_time) {
          const timeParts = t.due_time.split(':');
          if (timeParts.length === 2) {
            const formattedTaskTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
            if (formattedTaskTime === currentTimeStr) {
              const alertKey = `task-${t.id}-${today}-${formattedTaskTime}`;
              if (!notifiedKeysRef.current.has(alertKey)) {
                notifiedKeysRef.current.add(alertKey);
                notificationSystem.triggerAlert({
                  title: `یادآوری وظیفه: ${t.title} ⏰`,
                  body: `زمان انجام این وظیفه فرارسیده است (${toPersianDigits(t.due_time)}).`,
                  sound: 'alarm',
                  type: 'task',
                });
              }
            }
          }
        }
      });

      // 2. Check Habits (Matching reminder_time, scheduled for today per weekly/monthly rules, and not yet done today)
      habits.forEach((h) => {
        if (h.reminder_time) {
          // Check if habit is scheduled for today based on recurrence rules
          if (!isHabitScheduledForDate(h, today)) {
            return;
          }

          const timeParts = h.reminder_time.split(':');
          if (timeParts.length === 2) {
            const formattedHabitTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
            if (formattedHabitTime === currentTimeStr) {
              const isDoneToday = habitLogs.some(
                (l) => l.habit_id === h.id && l.completed_date_jalali === today && l.status === 'done'
              );
              if (!isDoneToday) {
                const alertKey = `habit-${h.id}-${today}-${formattedHabitTime}`;
                if (!notifiedKeysRef.current.has(alertKey)) {
                  notifiedKeysRef.current.add(alertKey);
                  const freqName =
                    h.target_frequency === 'weekly'
                      ? 'هفتگی'
                      : h.target_frequency === 'monthly'
                      ? 'ماهانه'
                      : 'روزانه';
                  notificationSystem.triggerAlert({
                    title: `یادآوری عادت: ${h.title} 🔔`,
                    body: `زمان انجام عادت ${freqName} (${toPersianDigits(h.reminder_time)}) فرارسیده است.`,
                    sound: 'chime',
                    type: 'habit',
                  });
                }
              }
            }
          }
        }
      });
    };

    // Check immediately and then periodically every 15 seconds
    checkScheduledAlerts();
    const interval = setInterval(checkScheduledAlerts, 15000);

    const handleSyncOnFocus = () => {
      checkScheduledAlerts();
    };
    window.addEventListener('focus', handleSyncOnFocus);
    document.addEventListener('visibilitychange', handleSyncOnFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleSyncOnFocus);
      document.removeEventListener('visibilitychange', handleSyncOnFocus);
    };
  }, [tasks, habits, habitLogs]);

  // Today's journal
  const todayStr = getTodayJalali();
  const todayJournal = journals.find((j) => j.date_jalali === todayStr) || null;

  // Today's focus minutes
  const pomodoroMinutesToday = pomodoroSessions
    .filter((s) => s.completed_at_jalali.startsWith(todayStr))
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  // Category Actions (Shared across all sections)
  const handleAddCategory = async (newCategory: Omit<Category, 'id'>) => {
    await dbInstance.add('categories', newCategory);
    const updated = await dbInstance.getAll<Category>('categories');
    setCategories(updated);
  };

  const handleUpdateCategory = async (cat: Category) => {
    await dbInstance.put('categories', cat);
    const updated = await dbInstance.getAll<Category>('categories');
    setCategories(updated);
  };

  const handleDeleteCategory = async (categoryId: number) => {
    await dbInstance.deleteCategory(categoryId);
    const updatedCats = await dbInstance.getAll<Category>('categories');
    const updatedTasks = await dbInstance.getAll<Task>('tasks');
    const updatedHabits = await dbInstance.getAll<Habit>('habits');
    const updatedNotes = await dbInstance.getAll<Note>('notes');
    setCategories(updatedCats);
    setTasks(updatedTasks);
    setHabits(updatedHabits);
    setNotes(updatedNotes);
  };

  // Attribute Actions
  const handleAddAttribute = async (newAttribute: Omit<Attribute, 'id'>) => {
    await dbInstance.add('attributes', newAttribute);
    const updatedAttrs = await dbInstance.getAll<Attribute>('attributes');
    setAttributes(updatedAttrs);
  };

  const handleUpdateAttribute = async (attr: Attribute) => {
    await dbInstance.put('attributes', attr);
    const updatedAttrs = await dbInstance.getAll<Attribute>('attributes');
    setAttributes(updatedAttrs);
  };

  const handleDeleteAttribute = async (attributeId: number) => {
    await dbInstance.deleteAttribute(attributeId);
    const updatedAttrs = await dbInstance.getAll<Attribute>('attributes');
    setAttributes(updatedAttrs);
    const attrMap: Record<number, number[]> = {};
    for (const t of tasks) {
      if (t.id) {
        attrMap[t.id] = await dbInstance.getTaskAttributes(t.id);
      }
    }
    setTaskAttributesMap(attrMap);
  };

  // Task Actions
  const handleToggleTask = async (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updatedStatus = task.status === 'pending' ? 'completed' : 'pending';
    const updated = { ...task, status: updatedStatus };
    await dbInstance.put('tasks', updated);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
  };

  const handleAddTask = async (newTask: Omit<Task, 'id'>, attributeIds: number[]) => {
    const createdId = await dbInstance.add('tasks', newTask);
    if (attributeIds.length > 0) {
      await dbInstance.setTaskAttributes(createdId, attributeIds);
      setTaskAttributesMap((prev) => ({ ...prev, [createdId]: attributeIds }));
    }
    const updatedTasks = await dbInstance.getAll<Task>('tasks');
    setTasks(updatedTasks);
  };

  const handleUpdateTask = async (updatedTask: Task, attributeIds: number[]) => {
    await dbInstance.put('tasks', updatedTask);
    if (updatedTask.id) {
      await dbInstance.setTaskAttributes(updatedTask.id, attributeIds);
      setTaskAttributesMap((prev) => ({ ...prev, [updatedTask.id!]: attributeIds }));
    }
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleDeleteTask = async (taskId: number) => {
    await dbInstance.delete('tasks', taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedPomodoroTaskId === taskId) {
      setSelectedPomodoroTaskId(null);
    }
  };

  // Habit Actions (supports optional dateJalali for interactive daily ticking)
  const handleToggleHabit = async (habitId: number, dateJalali?: string) => {
    const targetDate = dateJalali || todayStr;
    await dbInstance.toggleHabitStatus(habitId, targetDate);
    const updatedLogs = await dbInstance.getAll<HabitLog>('habit_logs');
    setHabitLogs(updatedLogs);
  };

  const handleAddHabit = async (newHabit: Omit<Habit, 'id'>) => {
    await dbInstance.add('habits', newHabit);
    const updatedHabits = await dbInstance.getAll<Habit>('habits');
    setHabits(updatedHabits);
  };

  const handleUpdateHabit = async (updatedHabit: Habit) => {
    await dbInstance.put('habits', updatedHabit);
    setHabits((prev) => prev.map((h) => (h.id === updatedHabit.id ? updatedHabit : h)));
  };

  const handleDeleteHabit = async (habitId: number) => {
    await dbInstance.delete('habits', habitId);
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
  };

  // Pomodoro Actions
  const handleSessionCompleted = async (session: Omit<PomodoroSession, 'id'>) => {
    await dbInstance.add('pomodoro_sessions', session);
    const updatedPomos = await dbInstance.getAll<PomodoroSession>('pomodoro_sessions');
    setPomodoroSessions(updatedPomos);

    // If the focus session was tied to a habit, also record/increment habit completion for today!
    if (session.habit_id) {
      const today = getTodayJalali();
      const existingLog = habitLogs.find(
        (l) => l.habit_id === session.habit_id && l.completed_date_jalali === today && l.status === 'done'
      );
      if (!existingLog) {
        await handleToggleHabit(session.habit_id, today);
      }
    }
  };

  const handleStartPomodoroForTask = (taskId: number) => {
    setSelectedPomodoroTaskId(taskId);
    setSelectedPomodoroHabitId(null);
    setSelectedPomodoroTargetType('task');
    setActiveTab('pomodoro');
  };

  const handleStartPomodoroForHabit = (habitId: number) => {
    setSelectedPomodoroHabitId(habitId);
    setSelectedPomodoroTaskId(null);
    setSelectedPomodoroTargetType('habit');
    setActiveTab('pomodoro');
  };

  // Journal Actions
  const handleSaveJournal = async (journalData: Omit<DailyJournal, 'id'>) => {
    const existing = await dbInstance.getJournalByDate(journalData.date_jalali);
    if (existing && existing.id) {
      await dbInstance.put('daily_journals', { ...journalData, id: existing.id });
    } else {
      await dbInstance.add('daily_journals', journalData);
    }
    const updatedJournals = await dbInstance.getAll<DailyJournal>('daily_journals');
    setJournals(updatedJournals);
  };

  const handleDeleteJournal = async (journalId: number) => {
    await dbInstance.delete('daily_journals', journalId);
    const updatedJournals = await dbInstance.getAll<DailyJournal>('daily_journals');
    setJournals(updatedJournals);
  };

  // Notes Actions
  const handleAddNote = async (newNote: Omit<Note, 'id'>) => {
    await dbInstance.add('notes', newNote);
    const updatedNotes = await dbInstance.getAll<Note>('notes');
    setNotes(updatedNotes);
  };

  const handleUpdateNote = async (updatedNote: Note) => {
    await dbInstance.put('notes', updatedNote);
    setNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)));
  };

  const handleDeleteNote = async (noteId: number) => {
    await dbInstance.delete('notes', noteId);
    const children = notes.filter((n) => n.parent_id === noteId);
    for (const c of children) {
      if (c.id) await dbInstance.delete('notes', c.id);
    }
    const updatedNotes = await dbInstance.getAll<Note>('notes');
    setNotes(updatedNotes);
  };

  // Universal Reordering Handlers (persisting to IndexedDB)
  const handleReorderTasks = async (reorderedTasks: Task[]) => {
    const updated = reorderedTasks.map((t, idx) => ({ ...t, sort_order: idx }));
    setTasks(updated);
    const orderPayload = updated
      .filter((t) => t.id !== undefined)
      .map((t) => ({ id: t.id!, sort_order: t.sort_order! }));
    await dbInstance.updateSortOrders('tasks', orderPayload);
  };

  const handleReorderHabits = async (reorderedHabits: Habit[]) => {
    const updated = reorderedHabits.map((h, idx) => ({ ...h, sort_order: idx }));
    setHabits(updated);
    const orderPayload = updated
      .filter((h) => h.id !== undefined)
      .map((h) => ({ id: h.id!, sort_order: h.sort_order! }));
    await dbInstance.updateSortOrders('habits', orderPayload);
  };

  const handleReorderJournals = async (reorderedJournals: DailyJournal[]) => {
    const updated = reorderedJournals.map((j, idx) => ({ ...j, sort_order: idx }));
    setJournals(updated);
    const orderPayload = updated
      .filter((j) => j.id !== undefined)
      .map((j) => ({ id: j.id!, sort_order: j.sort_order! }));
    await dbInstance.updateSortOrders('daily_journals', orderPayload);
  };

  const handleReorderNotes = async (reorderedNotes: Note[]) => {
    const updated = reorderedNotes.map((n, idx) => ({ ...n, sort_order: idx }));
    setNotes(updated);
    const orderPayload = updated
      .filter((n) => n.id !== undefined)
      .map((n) => ({ id: n.id!, sort_order: n.sort_order! }));
    await dbInstance.updateSortOrders('notes', orderPayload);
  };

  // Trade Handlers
  const handleAddTrade = async (trade: Omit<Trade, 'id'>) => {
    const id = await dbInstance.add<Trade>('trades', {
      ...trade,
      sort_order: trades.length,
    });
    setTrades((prev) => [...prev, { ...trade, id, sort_order: prev.length }]);
  };

  const handleUpdateTrade = async (trade: Trade) => {
    await dbInstance.put<Trade>('trades', trade);
    setTrades((prev) => prev.map((t) => (t.id === trade.id ? trade : t)));
  };

  const handleDeleteTrade = async (tradeId: number) => {
    await dbInstance.delete('trades', tradeId);
    setTrades((prev) => prev.filter((t) => t.id !== tradeId));
  };

  const handleReorderTrades = async (reorderedTrades: Trade[]) => {
    const updated = reorderedTrades.map((t, idx) => ({ ...t, sort_order: idx }));
    setTrades(updated);
    const orderPayload = updated
      .filter((t) => t.id !== undefined)
      .map((t) => ({ id: t.id!, sort_order: t.sort_order! }));
    await dbInstance.updateSortOrders('trades', orderPayload);
  };

  const handleSaveTradeStrategy = async (content: string) => {
    await dbInstance.saveTradeStrategy(content);
    setTradeStrategy(content);
  };

  const handleAddTradeChecklistItem = async (title: string) => {
    const newItem: Omit<TradeChecklistItem, 'id'> = {
      title,
      is_checked: false,
      sort_order: tradeChecklist.length,
    };
    const id = await dbInstance.add<TradeChecklistItem>('trade_checklist', newItem);
    setTradeChecklist((prev) => [...prev, { ...newItem, id }]);
  };

  const handleUpdateTradeChecklistItem = async (item: TradeChecklistItem) => {
    await dbInstance.put<TradeChecklistItem>('trade_checklist', item);
    setTradeChecklist((prev) => prev.map((c) => (c.id === item.id ? item : c)));
  };

  const handleDeleteTradeChecklistItem = async (id: number) => {
    await dbInstance.delete('trade_checklist', id);
    setTradeChecklist((prev) => prev.filter((c) => c.id !== id));
  };

  const handleToggleTradeChecklistItem = async (id: number) => {
    const target = tradeChecklist.find((c) => c.id === id);
    if (!target) return;
    const updated = { ...target, is_checked: !target.is_checked };
    await dbInstance.put<TradeChecklistItem>('trade_checklist', updated);
    setTradeChecklist((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const handleResetTradeChecklist = async () => {
    await dbInstance.resetTradeChecklist();
    setTradeChecklist((prev) => prev.map((c) => ({ ...c, is_checked: false })));
  };

  const handleReorderTradeChecklist = async (items: TradeChecklistItem[]) => {
    const updated = items.map((item, idx) => ({ ...item, sort_order: idx }));
    for (const it of updated) {
      if (it.id) {
        await dbInstance.put<TradeChecklistItem>('trade_checklist', it);
      }
    }
    setTradeChecklist(updated);
  };

  const handleSaveTradeSettings = async (settings: TradeRiskSettings) => {
    await dbInstance.saveTradeSettings(settings);
    setTradeRiskSettings(settings);
  };

  // Finance Actions
  const handleAddAccount = async (newAccount: Omit<BankAccount, 'id'>) => {
    await dbInstance.add('finance_accounts', newAccount);
    const updated = await dbInstance.getAll<BankAccount>('finance_accounts');
    updated.sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
    setFinanceAccounts(updated);
  };

  const handleUpdateAccount = async (account: BankAccount) => {
    await dbInstance.put('finance_accounts', account);
    const updated = await dbInstance.getAll<BankAccount>('finance_accounts');
    updated.sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
    setFinanceAccounts(updated);
  };

  const handleDeleteAccount = async (id: number) => {
    await dbInstance.delete('finance_accounts', id);
    setFinanceAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAddTransaction = async (tx: Omit<FinanceTransaction, 'id'>) => {
    await dbInstance.add('finance_transactions', tx);
    // Update linked bank account balance
    const delta = tx.type === 'income' ? tx.amount : -tx.amount;
    await dbInstance.updateAccountBalance(tx.account_id, delta);

    const [updatedTxs, updatedAccounts] = await Promise.all([
      dbInstance.getAll<FinanceTransaction>('finance_transactions'),
      dbInstance.getAll<BankAccount>('finance_accounts'),
    ]);
    updatedTxs.sort((a, b) => (b.date_jalali || '').localeCompare(a.date_jalali || ''));
    updatedAccounts.sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
    setFinanceTransactions(updatedTxs);
    setFinanceAccounts(updatedAccounts);
  };

  const handleDeleteTransaction = async (id: number) => {
    const tx = financeTransactions.find((t) => t.id === id);
    if (tx) {
      // Revert account balance
      const revertDelta = tx.type === 'income' ? -tx.amount : tx.amount;
      await dbInstance.updateAccountBalance(tx.account_id, revertDelta);
    }
    await dbInstance.delete('finance_transactions', id);
    const [updatedTxs, updatedAccounts] = await Promise.all([
      dbInstance.getAll<FinanceTransaction>('finance_transactions'),
      dbInstance.getAll<BankAccount>('finance_accounts'),
    ]);
    updatedTxs.sort((a, b) => (b.date_jalali || '').localeCompare(a.date_jalali || ''));
    updatedAccounts.sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
    setFinanceTransactions(updatedTxs);
    setFinanceAccounts(updatedAccounts);
  };

  const handleBatchAddTransactions = async (batch: Omit<FinanceTransaction, 'id'>[]) => {
    for (const tx of batch) {
      await dbInstance.add('finance_transactions', tx);
      const delta = tx.type === 'income' ? tx.amount : -tx.amount;
      await dbInstance.updateAccountBalance(tx.account_id, delta);
    }
    const [updatedTxs, updatedAccounts] = await Promise.all([
      dbInstance.getAll<FinanceTransaction>('finance_transactions'),
      dbInstance.getAll<BankAccount>('finance_accounts'),
    ]);
    updatedTxs.sort((a, b) => (b.date_jalali || '').localeCompare(a.date_jalali || ''));
    updatedAccounts.sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0));
    setFinanceTransactions(updatedTxs);
    setFinanceAccounts(updatedAccounts);
  };

  // Finance Categories CRUD
  const handleAddFinanceCategory = async (cat: Omit<FinanceCategory, 'id'>) => {
    await dbInstance.add('finance_categories', cat);
    const updated = await dbInstance.getAll<FinanceCategory>('finance_categories');
    setFinanceCategories(updated);
  };

  const handleUpdateFinanceCategory = async (cat: FinanceCategory) => {
    await dbInstance.put('finance_categories', cat);
    const updated = await dbInstance.getAll<FinanceCategory>('finance_categories');
    setFinanceCategories(updated);
  };

  const handleDeleteFinanceCategory = async (id: number) => {
    await dbInstance.delete('finance_categories', id);
    setFinanceCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const handleReassignAndDeleteFinanceCategory = async (deletedCatId: number, targetCatId: number) => {
    await dbInstance.reassignFinanceCategory(deletedCatId, targetCatId);
    const [updatedCats, updatedTxs] = await Promise.all([
      dbInstance.getAll<FinanceCategory>('finance_categories'),
      dbInstance.getAll<FinanceTransaction>('finance_transactions'),
    ]);
    updatedTxs.sort((a, b) => (b.date_jalali || '').localeCompare(a.date_jalali || ''));
    setFinanceCategories(updatedCats);
    setFinanceTransactions(updatedTxs);
  };

  // Finance Salaries CRUD
  const handleAddSalary = async (salary: Omit<SalaryIncomeSchedule, 'id'>) => {
    await dbInstance.add('finance_salaries', salary);
    const updated = await dbInstance.getAll<SalaryIncomeSchedule>('finance_salaries');
    setFinanceSalaries(updated);
  };

  const handleUpdateSalary = async (salary: SalaryIncomeSchedule) => {
    await dbInstance.put('finance_salaries', salary);
    const updated = await dbInstance.getAll<SalaryIncomeSchedule>('finance_salaries');
    setFinanceSalaries(updated);
  };

  const handleDeleteSalary = async (id: number) => {
    await dbInstance.delete('finance_salaries', id);
    setFinanceSalaries((prev) => prev.filter((s) => s.id !== id));
  };

  // Finance Parties & Ledger Entries CRUD
  const handleAddParty = async (party: Omit<LedgerParty, 'id'>) => {
    await dbInstance.add('finance_parties', party);
    const updated = await dbInstance.getAll<LedgerParty>('finance_parties');
    setFinanceParties(updated);
  };

  const handleUpdateParty = async (party: LedgerParty) => {
    await dbInstance.put('finance_parties', party);
    const updated = await dbInstance.getAll<LedgerParty>('finance_parties');
    setFinanceParties(updated);
  };

  const handleDeleteParty = async (id: number) => {
    await dbInstance.delete('finance_parties', id);
    setFinanceParties((prev) => prev.filter((p) => p.id !== id));
    const entries = await dbInstance.getAll<LedgerEntry>('finance_ledger_entries');
    for (const e of entries) {
      if (e.party_id === id && e.id) {
        await dbInstance.delete('finance_ledger_entries', e.id);
      }
    }
    const updatedEntries = await dbInstance.getAll<LedgerEntry>('finance_ledger_entries');
    setFinanceLedgerEntries(updatedEntries);
  };

  const handleAddLedgerEntry = async (entry: Omit<LedgerEntry, 'id'>) => {
    await dbInstance.add('finance_ledger_entries', entry);
    const party = await dbInstance.getById<LedgerParty>('finance_parties', entry.party_id);
    if (party) {
      party.settled_amount = (party.settled_amount || 0) + entry.amount;
      if (party.settled_amount >= party.total_amount) {
        party.status = 'settled';
      }
      await dbInstance.put('finance_parties', party);
    }
    const [updatedParties, updatedEntries] = await Promise.all([
      dbInstance.getAll<LedgerParty>('finance_parties'),
      dbInstance.getAll<LedgerEntry>('finance_ledger_entries'),
    ]);
    setFinanceParties(updatedParties);
    setFinanceLedgerEntries(updatedEntries);
  };

  const handleDeleteLedgerEntry = async (id: number, partyId: number) => {
    const entry = financeLedgerEntries.find((e) => e.id === id);
    if (entry) {
      const party = await dbInstance.getById<LedgerParty>('finance_parties', partyId);
      if (party) {
        party.settled_amount = Math.max(0, (party.settled_amount || 0) - entry.amount);
        if (party.settled_amount < party.total_amount && party.status === 'settled') {
          party.status = 'active';
        }
        await dbInstance.put('finance_parties', party);
      }
    }
    await dbInstance.delete('finance_ledger_entries', id);
    const [updatedParties, updatedEntries] = await Promise.all([
      dbInstance.getAll<LedgerParty>('finance_parties'),
      dbInstance.getAll<LedgerEntry>('finance_ledger_entries'),
    ]);
    setFinanceParties(updatedParties);
    setFinanceLedgerEntries(updatedEntries);
  };

  // Finance Loans CRUD
  const handleAddLoan = async (loan: Omit<Loan, 'id'>) => {
    await dbInstance.add('finance_loans', loan);
    const updated = await dbInstance.getAll<Loan>('finance_loans');
    setFinanceLoans(updated);
    if (updated.length > 0) {
      scheduleUpcomingLoanReminders(updated);
    }
  };

  const handleUpdateLoan = async (loan: Loan) => {
    await dbInstance.put('finance_loans', loan);
    const updated = await dbInstance.getAll<Loan>('finance_loans');
    setFinanceLoans(updated);
    if (updated.length > 0) {
      scheduleUpcomingLoanReminders(updated);
    }
  };

  const handleDeleteLoan = async (id: number) => {
    await dbInstance.delete('finance_loans', id);
    setFinanceLoans((prev) => prev.filter((l) => l.id !== id));
  };

  // Finance Salary Advance CRUD
  const handleAddSalaryAdvance = async (advance: Omit<SalaryAdvance, 'id'>) => {
    await dbInstance.add('finance_salary_advances', advance);
    const updated = await dbInstance.getAll<SalaryAdvance>('finance_salary_advances');
    setFinanceSalaryAdvances(updated);
  };

  const handleUpdateSalaryAdvance = async (advance: SalaryAdvance) => {
    await dbInstance.put('finance_salary_advances', advance);
    const updated = await dbInstance.getAll<SalaryAdvance>('finance_salary_advances');
    setFinanceSalaryAdvances(updated);
  };

  const handleDeleteSalaryAdvance = async (id: number) => {
    await dbInstance.delete('finance_salary_advances', id);
    setFinanceSalaryAdvances((prev) => prev.filter((a) => a.id !== id));
  };

  // SMS Patterns CRUD
  const handleAddSmsPattern = async (pattern: Omit<SmsPattern, 'id'>) => {
    await dbInstance.add('sms_patterns', pattern);
    const updated = await dbInstance.getAll<SmsPattern>('sms_patterns');
    setSmsPatterns(updated);
  };

  const handleUpdateSmsPattern = async (pattern: SmsPattern) => {
    await dbInstance.put('sms_patterns', pattern);
    const updated = await dbInstance.getAll<SmsPattern>('sms_patterns');
    setSmsPatterns(updated);
  };

  const handleDeleteSmsPattern = async (id: number) => {
    await dbInstance.delete('sms_patterns', id);
    setSmsPatterns((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...appSettings, ...newSettings };
    await dbInstance.saveAppSettings(updated);
    setAppSettings(updated);
  };

  const handleResetAllData = async () => {
    await dbInstance.clearAllData();
    await refreshAllData();
  };

  // Native Android Hardware Back Button Interception
  useEffect(() => {
    let removeListener: (() => void) | null = null;
    try {
      CapApp.addListener('backButton', () => {
        if (isSidebarOpen) {
          setIsSidebarOpen(false);
        } else if (isBackupOpen) {
          setIsBackupOpen(false);
        } else if (isApkGuideOpen) {
          setIsApkGuideOpen(false);
        } else if (activeTab !== 'dashboard') {
          setActiveTab('dashboard');
        } else {
          CapApp.exitApp();
        }
      }).then((handle) => {
        removeListener = () => handle.remove();
      }).catch(() => {
        // Not in mobile Capacitor environment
      });
    } catch {
      // Ignore outside native environment
    }

    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, [isSidebarOpen, isBackupOpen, isApkGuideOpen, activeTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 animate-pulse flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg shadow-blue-500/30">
          LP
        </div>
        <p className="text-sm text-slate-400">در حال راه‌اندازی پایگاه داده آفلاین...</p>
      </div>
    );
  }

  const pendingTasksCount = tasks.filter((t) => t.status === 'pending').length;
  const todayPendingHabitsCount = habits.filter((h) => {
    if (!isHabitScheduledForDate(h, todayStr)) return false;
    const isDone = habitLogs.some(
      (l) => l.habit_id === h.id && l.completed_date_jalali === todayStr && l.status === 'done'
    );
    return !isDone;
  }).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased selection:bg-blue-500/30">
      {/* Top App Bar with Hamburger Toggle */}
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onOpenSettings={() => setActiveTab('settings')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            tasks={tasks}
            habits={habits}
            habitLogs={habitLogs}
            todayJournal={todayJournal}
            pomodoroMinutesToday={pomodoroMinutesToday}
            categories={categories}
            onToggleTask={handleToggleTask}
            onToggleHabit={handleToggleHabit}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            tasks={tasks}
            categories={categories}
            attributes={attributes}
            taskAttributesMap={taskAttributesMap}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onToggleTask={handleToggleTask}
            onStartPomodoroForTask={handleStartPomodoroForTask}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onAddAttribute={handleAddAttribute}
            onUpdateAttribute={handleUpdateAttribute}
            onDeleteAttribute={handleDeleteAttribute}
            onReorderTasks={handleReorderTasks}
          />
        )}

        {activeTab === 'habits' && (
          <HabitsView
            habits={habits}
            habitLogs={habitLogs}
            categories={categories}
            onAddHabit={handleAddHabit}
            onUpdateHabit={handleUpdateHabit}
            onDeleteHabit={handleDeleteHabit}
            onToggleHabit={handleToggleHabit}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            onReorderHabits={handleReorderHabits}
            onStartPomodoroForHabit={handleStartPomodoroForHabit}
          />
        )}

        {activeTab === 'pomodoro' && (
          <PomodoroView
            tasks={tasks}
            habits={habits}
            categories={categories}
            selectedTaskId={selectedPomodoroTaskId}
            selectedHabitId={selectedPomodoroHabitId}
            targetType={selectedPomodoroTargetType}
            onSelectTask={(id) => {
              setSelectedPomodoroTaskId(id);
              if (id) {
                setSelectedPomodoroHabitId(null);
                setSelectedPomodoroTargetType('task');
              }
            }}
            onSelectHabit={(id) => {
              setSelectedPomodoroHabitId(id);
              if (id) {
                setSelectedPomodoroTaskId(null);
                setSelectedPomodoroTargetType('habit');
              }
            }}
            onChangeTargetType={setSelectedPomodoroTargetType}
            onSessionCompleted={handleSessionCompleted}
            recentSessions={pomodoroSessions.filter((s) => s.completed_at_jalali.startsWith(todayStr))}
            allSessions={pomodoroSessions}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onToggleTask={handleToggleTask}
          />
        )}

        {activeTab === 'trade' && (
          <TradeView
            trades={trades}
            checklistItems={tradeChecklist}
            strategyContent={tradeStrategy}
            riskSettings={tradeRiskSettings}
            onAddTrade={handleAddTrade}
            onUpdateTrade={handleUpdateTrade}
            onDeleteTrade={handleDeleteTrade}
            onReorderTrades={handleReorderTrades}
            onSaveStrategy={handleSaveTradeStrategy}
            onAddChecklistItem={handleAddTradeChecklistItem}
            onUpdateChecklistItem={handleUpdateTradeChecklistItem}
            onDeleteChecklistItem={handleDeleteTradeChecklistItem}
            onToggleChecklistItem={handleToggleTradeChecklistItem}
            onResetChecklist={handleResetTradeChecklist}
            onReorderChecklist={handleReorderTradeChecklist}
            onSaveRiskSettings={handleSaveTradeSettings}
          />
        )}

        {activeTab === 'finance' && (
          <FinanceView
            accounts={financeAccounts}
            transactions={financeTransactions}
            categories={financeCategories}
            salaries={financeSalaries}
            salaryAdvances={financeSalaryAdvances}
            parties={financeParties}
            ledgerEntries={financeLedgerEntries}
            loans={financeLoans}
            smsPatterns={smsPatterns}
            onAddAccount={handleAddAccount}
            onUpdateAccount={handleUpdateAccount}
            onDeleteAccount={handleDeleteAccount}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onBatchAddTransactions={handleBatchAddTransactions}
            onAddCategory={handleAddFinanceCategory}
            onUpdateCategory={handleUpdateFinanceCategory}
            onDeleteCategory={handleDeleteFinanceCategory}
            onReassignAndDeleteCategory={handleReassignAndDeleteFinanceCategory}
            onAddSalary={handleAddSalary}
            onUpdateSalary={handleUpdateSalary}
            onDeleteSalary={handleDeleteSalary}
            onAddSalaryAdvance={handleAddSalaryAdvance}
            onUpdateSalaryAdvance={handleUpdateSalaryAdvance}
            onDeleteSalaryAdvance={handleDeleteSalaryAdvance}
            onAddParty={handleAddParty}
            onUpdateParty={handleUpdateParty}
            onDeleteParty={handleDeleteParty}
            onAddLedgerEntry={handleAddLedgerEntry}
            onDeleteLedgerEntry={handleDeleteLedgerEntry}
            onAddLoan={handleAddLoan}
            onUpdateLoan={handleUpdateLoan}
            onDeleteLoan={handleDeleteLoan}
          />
        )}

        {activeTab === 'journal' && (
          <JournalNotesView
            categories={categories}
            todayJournal={todayJournal}
            onSaveJournal={handleSaveJournal}
            allJournals={journals}
            onDeleteJournal={handleDeleteJournal}
            notes={notes}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            onReorderJournals={handleReorderJournals}
            onReorderNotes={handleReorderNotes}
          />
        )}

        {activeTab === 'stats' && (
          <StatsView
            journals={journals}
            habits={habits}
            habitLogs={habitLogs}
            pomodoroSessions={pomodoroSessions}
            categories={categories}
            tasks={tasks}
            attributes={attributes}
            taskAttributesMap={taskAttributesMap}
            trades={trades}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            appSettings={appSettings}
            onUpdateSettings={handleUpdateSettings}
            smsPatterns={smsPatterns}
            onAddSmsPattern={handleAddSmsPattern}
            onUpdateSmsPattern={handleUpdateSmsPattern}
            onDeleteSmsPattern={handleDeleteSmsPattern}
            onResetAllData={handleResetAllData}
            onDataRestored={refreshAllData}
            stats={{
              accountsCount: financeAccounts.length,
              transactionsCount: financeTransactions.length,
              tradesCount: trades.length,
              tasksCount: tasks.length,
              habitsCount: habits.length,
              notesCount: journals.length,
            }}
          />
        )}
      </main>

      {/* Modern Collapsible Sidebar Navigation (Replaces BottomNav) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onToggle={() => setIsSidebarOpen((prev) => !prev)}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        pendingTasksCount={pendingTasksCount}
        todayPendingHabitsCount={todayPendingHabitsCount}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenApkGuide={() => setIsApkGuideOpen(true)}
      />

      {/* APK Guide Modal */}
      <ApkExportModal
        isOpen={isApkGuideOpen}
        onClose={() => setIsApkGuideOpen(false)}
      />

      {/* Backup & Restore Modal */}
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onDataRestored={refreshAllData}
      />
    </div>
  );
}
