import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit3,
  Sliders,
  X,
  CheckSquare,
  Flame,
  BookOpen,
  Check,
  Trash2,
  Clock,
  TrendingUp,
  Download,
  Maximize2,
  FileText,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { Habit, HabitLog, Trade, Task, DailyJournal, Note } from '../types';
import {
  getTodayJalali,
  getTodayJalaliWithTime,
  toPersianDigits,
  isHabitScheduledForDate,
} from '../utils/jalali';
import { soundFx } from '../utils/audio';
import { usePWAInstall } from '../utils/usePWAInstall';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export type WidgetSize = '2x2' | '4x2' | '4x4';
export type WidgetView = 'tasks' | 'habits' | 'notes';

interface QuickWidgetProps {
  habits: Habit[];
  habitLogs: HabitLog[];
  trades: Trade[];
  pomodoroMinutesToday: number;
  tasks?: Task[];
  onToggleTask?: (taskId: number) => void;
  onAddTask?: (task: Omit<Task, 'id'>, attrIds: number[]) => Promise<void>;
  onDeleteTask?: (taskId: number) => Promise<void>;
  todayJournal?: DailyJournal | null;
  notes?: Note[];
  onAddNote?: (note: Omit<Note, 'id'>) => Promise<void>;
  onDeleteNote?: (noteId: number) => Promise<void>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onToggleHabit: (habitId: number, date: string) => Promise<void>;
}

export const QuickWidget: React.FC<QuickWidgetProps> = ({
  habits,
  habitLogs,
  trades,
  pomodoroMinutesToday,
  tasks = [],
  onToggleTask,
  onAddTask,
  onDeleteTask,
  todayJournal,
  notes = [],
  onAddNote,
  onDeleteNote,
  activeTab,
  setActiveTab,
  onToggleHabit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdjustSizeOpen, setIsAdjustSizeOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Item deletion state for ConfirmDeleteModal
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'task' | 'note';
    id: number;
    title: string;
  } | null>(null);

  // Widget view state: 'tasks' | 'habits' | 'notes'
  const [widgetView, setWidgetView] = useState<WidgetView>(() => {
    try {
      const saved = localStorage.getItem('lp_widget_view');
      if (saved === 'tasks' || saved === 'habits' || saved === 'notes') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'tasks';
  });

  // Widget size state with persistent storage: 2x2, 4x2, 4x4
  const [widgetSize, setWidgetSize] = useState<WidgetSize>(() => {
    try {
      const saved = localStorage.getItem('lp_widget_size');
      if (saved === '2x2' || saved === '4x2' || saved === '4x4') return saved;
    } catch {
      // fallback
    }
    return '4x2';
  });

  const { isInstallable, install } = usePWAInstall();
  const today = getTodayJalali();

  const handleSizeChange = (newSize: WidgetSize) => {
    setWidgetSize(newSize);
    try {
      localStorage.setItem('lp_widget_size', newSize);
    } catch {
      // ignore
    }
    setIsAdjustSizeOpen(false);
  };

  const handleViewChange = (newView: WidgetView) => {
    setWidgetView(newView);
    try {
      localStorage.setItem('lp_widget_view', newView);
    } catch {
      // ignore
    }
  };

  // Switch between views using < and > header controls
  const viewOrder: WidgetView[] = ['tasks', 'habits', 'notes'];
  const handlePrevView = () => {
    const currentIndex = viewOrder.indexOf(widgetView);
    const prevIndex = (currentIndex - 1 + viewOrder.length) % viewOrder.length;
    handleViewChange(viewOrder[prevIndex]);
  };

  const handleNextView = () => {
    const currentIndex = viewOrder.indexOf(widgetView);
    const nextIndex = (currentIndex + 1) % viewOrder.length;
    handleViewChange(viewOrder[nextIndex]);
  };

  // 1. Habits scheduled for TODAY
  const todayScheduledHabits = habits.filter((h) => isHabitScheduledForDate(h, today));
  const completedTodayHabitIds = new Set(
    habitLogs
      .filter((l) => l.completed_date_jalali === today && l.status === 'done')
      .map((l) => l.habit_id)
  );
  const doneHabitCount = todayScheduledHabits.filter((h) => h.id && completedTodayHabitIds.has(h.id)).length;
  const totalHabitsToday = todayScheduledHabits.length;
  const habitsProgressPercent =
    totalHabitsToday > 0 ? Math.round((doneHabitCount / totalHabitsToday) * 100) : 100;

  // 2. Tasks for TODAY
  const todayTasks = tasks.filter((t) => t.due_date === today);
  const doneTasksCount = todayTasks.filter((t) => t.status === 'completed').length;
  const totalTasksToday = todayTasks.length;
  const tasksProgressPercent =
    totalTasksToday > 0 ? Math.round((doneTasksCount / totalTasksToday) * 100) : 100;

  // 3. Notes
  const recentNotes = notes.slice(0, 8);

  // Handle quick item addition from header +
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) return;

    if (widgetView === 'tasks' && onAddTask) {
      await onAddTask(
        {
          title: quickAddTitle.trim(),
          category_id: 1,
          priority: 'medium',
          due_date: today,
          status: 'pending',
          created_at: getTodayJalaliWithTime(),
        },
        []
      );
      soundFx.playCheckmark();
    } else if (widgetView === 'notes' && onAddNote) {
      await onAddNote({
        title: quickAddTitle.trim(),
        content: '',
        category_id: 1,
        parent_id: null,
        created_at_jalali: getTodayJalaliWithTime(),
        updated_at_jalali: getTodayJalaliWithTime(),
      });
      soundFx.playCheckmark();
    } else {
      setActiveTab(widgetView);
      setIsOpen(false);
    }

    setQuickAddTitle('');
    setIsQuickAddOpen(false);
  };

  // Container width classes based on widget size
  const containerSizeClasses = {
    '2x2': 'sm:max-w-sm',
    '4x2': 'sm:max-w-xl',
    '4x4': 'sm:max-w-3xl',
  }[widgetSize];

  return (
    <>
      {/* Floating Quick Launcher Pill / Button */}
      <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-2">
        {!isOpen && (
          <button
            type="button"
            id="quick-widget-launcher-btn"
            onClick={() => {
              soundFx.playCheckmark();
              setIsOpen(true);
            }}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-slate-950 font-bold shadow-xl shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all border border-amber-300/60 group"
            aria-label="باز کردن ویجت هوشمند"
          >
            <div className="relative">
              <Sparkles className="w-5 h-5 text-slate-950 group-hover:rotate-12 transition-transform" />
              {(totalHabitsToday > doneHabitCount || totalTasksToday > doneTasksCount) && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
              )}
            </div>
            <div className="flex flex-col text-right leading-none">
              <span className="text-xs font-black">ویجت هوشمند ({widgetSize})</span>
              <span className="text-[10px] opacity-80 font-mono">
                {widgetView === 'tasks' && `${toPersianDigits(doneTasksCount)}/${toPersianDigits(totalTasksToday)} وظیفه`}
                {widgetView === 'habits' && `${toPersianDigits(doneHabitCount)}/${toPersianDigits(totalHabitsToday)} عادت`}
                {widgetView === 'notes' && `${toPersianDigits(notes.length)} یادداشت`}
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Floating Collapsible Widget Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full ${containerSizeClasses} bg-slate-900 border border-slate-750 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all animate-slideUp`}
            id="quick-widget-panel"
          >
            {/* Header with View Navigation (< >), Add (+), Edit Mode, Size Dialog & Close */}
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-850 via-slate-800 to-slate-850 border-b border-slate-750 flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-white">
                      {widgetView === 'tasks' && "وظایف امروز (Today's Tasks)"}
                      {widgetView === 'habits' && "عادات امروز (Today's Habits)"}
                      {widgetView === 'notes' && 'یادداشت‌ها و ژورنال (Notes)'}
                    </h3>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                      {toPersianDigits(today)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    اندازه فعال: <span className="font-mono font-bold text-amber-400">{widgetSize}</span>
                    {isEditMode && <span className="text-rose-400 mr-2 font-bold">● حالت ویرایش فعال است</span>}
                  </p>
                </div>
              </div>

              {/* Header Controls: < > Navigation, +, Edit Mode, Adjust Size, Close */}
              <div className="flex items-center gap-1.5">
                {/* View Switcher Controls (< >) */}
                <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-700/80">
                  <button
                    type="button"
                    onClick={handlePrevView}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="نمای قبلی"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextView}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="نمای بعدی"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Add Button (+) */}
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                  className={`p-1.5 rounded-xl transition-all ${
                    isQuickAddOpen
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-800/80 hover:bg-slate-750 text-amber-400'
                  }`}
                  title="افزودن سریع (+)"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Edit Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`p-1.5 rounded-xl transition-all ${
                    isEditMode
                      ? 'bg-rose-500 text-white shadow-md'
                      : 'bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-white'
                  }`}
                  title={isEditMode ? 'خروج از حالت ویرایش' : 'حالت ویرایش (Edit Mode)'}
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                {/* Adjust Size Dialog Button */}
                <button
                  type="button"
                  onClick={() => setIsAdjustSizeOpen(!isAdjustSizeOpen)}
                  className={`p-1.5 rounded-xl transition-all ${
                    isAdjustSizeOpen
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-white'
                  }`}
                  title="تنظیم اندازه ویجت (Adjust Size)"
                >
                  <Sliders className="w-4 h-4" />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-white transition-colors"
                  aria-label="بستن ویجت"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Adjust Size Dialog Modal / Popover */}
            {isAdjustSizeOpen && (
              <div className="p-3 bg-slate-950 border-b border-slate-800 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                  <span>تنظیم اندازه ویجت (Adjust Size):</span>
                  <span className="text-slate-500 text-[11px]">اندازه دلخواه را انتخاب کنید</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSizeChange('2x2')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      widgetSize === '2x2'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="font-mono text-sm font-black">۲×۲</span>
                    <span className="text-[10px]">فشرده (Mini)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSizeChange('4x2')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      widgetSize === '4x2'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="font-mono text-sm font-black">۴×۲</span>
                    <span className="text-[10px]">استاندارد (Standard)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSizeChange('4x4')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      widgetSize === '4x4'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="font-mono text-sm font-black">۴×۴</span>
                    <span className="text-[10px]">داشبورد کامل (Expanded)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Add Bar (Triggered by + button) */}
            {isQuickAddOpen && (
              <form
                onSubmit={handleQuickAddSubmit}
                className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center gap-2 animate-fadeIn"
              >
                <input
                  type="text"
                  value={quickAddTitle}
                  onChange={(e) => setQuickAddTitle(e.target.value)}
                  placeholder={
                    widgetView === 'tasks'
                      ? 'عنوان وظیفه جدید برای امروز...'
                      : widgetView === 'habits'
                      ? 'افزودن عادت جدید (انتقال به بخش عادات)...'
                      : 'عنوان یادداشت سریع جدید...'
                  }
                  autoFocus
                  className="flex-1 bg-slate-900 border border-slate-750 text-slate-100 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!quickAddTitle.trim()}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-50"
                >
                  ثبت
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {/* View Selector Tabs (Tasks / Habits / Notes) */}
            <div className="grid grid-cols-3 bg-slate-950/70 border-b border-slate-800 p-1.5 gap-1 text-xs select-none">
              <button
                type="button"
                onClick={() => handleViewChange('tasks')}
                className={`py-2 px-1 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  widgetView === 'tasks'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>وظایف امروز</span>
                <span className="text-[10px] font-mono opacity-80">({toPersianDigits(totalTasksToday)})</span>
              </button>

              <button
                type="button"
                onClick={() => handleViewChange('habits')}
                className={`py-2 px-1 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  widgetView === 'habits'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>عادات امروز</span>
                <span className="text-[10px] font-mono opacity-80">({toPersianDigits(totalHabitsToday)})</span>
              </button>

              <button
                type="button"
                onClick={() => handleViewChange('notes')}
                className={`py-2 px-1 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  widgetView === 'notes'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>یادداشت‌ها</span>
                <span className="text-[10px] font-mono opacity-80">({toPersianDigits(notes.length)})</span>
              </button>
            </div>

            {/* ============================================================== */}
            {/* WIDGET CONTENT RENDERING (2x2 / 4x2 / 4x4)                      */}
            {/* ============================================================== */}
            <div className="p-4 overflow-y-auto flex-1 max-h-[70vh]">
              {/* -------------------- 2x2 MINI SIZE -------------------- */}
              {widgetSize === '2x2' && (
                <div className="space-y-3">
                  {widgetView === 'tasks' && (
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">تکمیل وظایف امروز:</span>
                        <span className="font-bold text-blue-400 font-mono">
                          {toPersianDigits(doneTasksCount)} / {toPersianDigits(totalTasksToday)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${tasksProgressPercent}%` }}
                        />
                      </div>

                      {/* Next pending task */}
                      {todayTasks.filter((t) => t.status === 'pending').slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <span className="text-xs truncate text-slate-200">{t.title}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (t.id && onToggleTask) {
                                soundFx.playCheckmark();
                                onToggleTask(t.id);
                              }
                            }}
                            className="px-2 py-0.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold shrink-0"
                          >
                            انجام
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {widgetView === 'habits' && (
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">انجام عادات امروز:</span>
                        <span className="font-bold text-amber-400 font-mono">
                          {toPersianDigits(doneHabitCount)} / {toPersianDigits(totalHabitsToday)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${habitsProgressPercent}%` }}
                        />
                      </div>

                      {/* Next uncompleted habit */}
                      {todayScheduledHabits
                        .filter((h) => h.id && !completedTodayHabitIds.has(h.id))
                        .slice(0, 2)
                        .map((h) => (
                          <div
                            key={h.id}
                            className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <span className="text-xs truncate text-slate-200">{h.title}</span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (h.id) {
                                  soundFx.playCheckmark();
                                  await onToggleHabit(h.id, today);
                                }
                              }}
                              className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold shrink-0"
                            >
                              ثبت
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                  {widgetView === 'notes' && (
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">ژورنال امروز:</span>
                        <span className="text-purple-400 font-bold">
                          {todayJournal ? `انرژی: ${toPersianDigits(todayJournal.energy_score)}/۱۰` : 'ثبت نشده'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-2 bg-slate-900 p-2 rounded-xl border border-slate-850">
                        {todayJournal?.content || 'هنوز متنی برای ژورنال امروز ثبت نشده است.'}
                      </p>
                      {recentNotes[0] && (
                        <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <span className="text-[11px] text-slate-200 truncate">{recentNotes[0].title}</span>
                          <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* -------------------- 4x2 STANDARD SIZE -------------------- */}
              {widgetSize === '4x2' && (
                <div className="space-y-2.5">
                  {widgetView === 'tasks' && (
                    <div className="space-y-2">
                      <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-400">پیشرفت کل وظایف امروز:</span>
                        <span className="font-bold text-blue-400 font-mono">
                          {toPersianDigits(doneTasksCount)} از {toPersianDigits(totalTasksToday)} ({toPersianDigits(tasksProgressPercent)}٪)
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {todayTasks.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500">
                            هیچ وظیفه‌ای برای سررسید امروز ثبت نشده است. روی + بزنید تا اضافه شود.
                          </div>
                        ) : (
                          todayTasks.map((task) => {
                            const isCompleted = task.status === 'completed';
                            return (
                              <div
                                key={task.id}
                                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                  isCompleted
                                    ? 'bg-slate-950/40 border-slate-800 opacity-60'
                                    : 'bg-slate-850/70 border-slate-800'
                                }`}
                              >
                                <span className={`text-xs truncate ${isCompleted ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                                  {task.title}
                                </span>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isEditMode && task.id && onDeleteTask && (
                                    <button
                                      type="button"
                                      onClick={() => setItemToDelete({ type: 'task', id: task.id!, title: task.title })}
                                      className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                                      title="حذف وظیفه"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (task.id && onToggleTask) {
                                        soundFx.playCheckmark();
                                        onToggleTask(task.id);
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                      isCompleted
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700'
                                    }`}
                                  >
                                    {isCompleted ? '✓ انجام شد' : 'تکمیل'}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {widgetView === 'habits' && (
                    <div className="space-y-2">
                      <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-400">پیشرفت کل عادات امروز:</span>
                        <span className="font-bold text-amber-400 font-mono">
                          {toPersianDigits(doneHabitCount)} از {toPersianDigits(totalHabitsToday)} ({toPersianDigits(habitsProgressPercent)}٪)
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {todayScheduledHabits.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500">
                            هیچ عادتی برای موعد امروز تعریف نشده است.
                          </div>
                        ) : (
                          todayScheduledHabits.map((habit) => {
                            const isDone = habit.id ? completedTodayHabitIds.has(habit.id) : false;
                            return (
                              <div
                                key={habit.id}
                                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                  isDone
                                    ? 'bg-emerald-950/20 border-emerald-500/30'
                                    : 'bg-slate-850/70 border-slate-800'
                                }`}
                              >
                                <span className={`text-xs truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                                  {habit.title}
                                </span>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (habit.id) {
                                      soundFx.playCheckmark();
                                      await onToggleHabit(habit.id, today);
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                                    isDone
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  {isDone ? '✓ ثبت شد' : 'ثبت'}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {widgetView === 'notes' && (
                    <div className="space-y-2.5">
                      <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">ژورنال و وضعیت روز:</span>
                          <span className="text-purple-400 font-bold">
                            {todayJournal
                              ? `انرژی: ${toPersianDigits(todayJournal.energy_score)} • بهره‌وری: ${toPersianDigits(todayJournal.productivity_score)}`
                              : 'هنوز ثبت نشده'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {todayJournal?.content || 'برای امروز هنوز یادداشت ژورنالی ثبت نکرده‌اید.'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 block px-1">آخرین یادداشت‌ها:</span>
                        {recentNotes.slice(0, 4).map((note) => (
                          <div
                            key={note.id}
                            onClick={() => {
                              setActiveTab('journal');
                              setIsOpen(false);
                            }}
                            className="p-2 rounded-xl bg-slate-850/60 hover:bg-slate-800 border border-slate-800 cursor-pointer text-xs text-slate-200 flex items-center justify-between"
                          >
                            <span className="truncate">{note.title}</span>
                            <div className="flex items-center gap-1.5">
                              {isEditMode && note.id && onDeleteNote && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemToDelete({ type: 'note', id: note.id!, title: note.title });
                                  }}
                                  className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10"
                                  title="حذف یادداشت"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* -------------------- 4x4 EXPANDED DASHBOARD SIZE -------------------- */}
              {widgetSize === '4x4' && (
                <div className="space-y-4">
                  {/* Grid of Views */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Panel 1: Today's Tasks Full List */}
                    <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                          <span className="text-xs font-bold text-white">وظایف سررسید امروز</span>
                        </div>
                        <span className="text-[11px] font-mono text-blue-400 font-bold">
                          {toPersianDigits(doneTasksCount)}/{toPersianDigits(totalTasksToday)}
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {todayTasks.length === 0 ? (
                          <div className="text-center py-4 text-xs text-slate-500">
                            هیچ وظیفه‌ای برای سررسید امروز موجود نیست.
                          </div>
                        ) : (
                          todayTasks.map((task) => {
                            const isCompleted = task.status === 'completed';
                            return (
                              <div
                                key={task.id}
                                className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                              >
                                <span className={`text-xs truncate ${isCompleted ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                                  {task.title}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (task.id && onToggleTask) {
                                      soundFx.playCheckmark();
                                      onToggleTask(task.id);
                                    }
                                  }}
                                  className={`px-2 py-0.5 rounded-lg text-xs font-bold shrink-0 ${
                                    isCompleted ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {isCompleted ? '✓' : 'انجام'}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Panel 2: Today's Habits Full List */}
                    <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Flame className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-white">عادات موعد امروز</span>
                        </div>
                        <span className="text-[11px] font-mono text-amber-400 font-bold">
                          {toPersianDigits(doneHabitCount)}/{toPersianDigits(totalHabitsToday)}
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {todayScheduledHabits.length === 0 ? (
                          <div className="text-center py-4 text-xs text-slate-500">
                            عادتی برای موعد امروز تعیین نشده است.
                          </div>
                        ) : (
                          todayScheduledHabits.map((habit) => {
                            const isDone = habit.id ? completedTodayHabitIds.has(habit.id) : false;
                            return (
                              <div
                                key={habit.id}
                                className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                              >
                                <span className={`text-xs truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                                  {habit.title}
                                </span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (habit.id) {
                                      soundFx.playCheckmark();
                                      await onToggleHabit(habit.id, today);
                                    }
                                  }}
                                  className={`px-2 py-0.5 rounded-lg text-xs font-bold shrink-0 ${
                                    isDone ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {isDone ? '✓' : 'ثبت'}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Panel 3: Notes & Journal Reflections */}
                    <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-bold text-white">ژورنال و بازتاب امروز</span>
                        </div>
                        {todayJournal && (
                          <span className="text-[10px] text-purple-400 font-mono">
                            انرژی: {toPersianDigits(todayJournal.energy_score)}/۱۰
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        {todayJournal?.content || 'هنوز یادداشت ژورنالی برای امروز ثبت نکرده‌اید.'}
                      </p>
                    </div>

                    {/* Panel 4: Focus & Trading Overview */}
                    <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-rose-400" />
                          <span className="text-xs font-bold text-white">تمرکز و آمار</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-rose-400">
                          {toPersianDigits(pomodoroMinutesToday)} دقیقه پومودورو
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                        <span className="text-slate-400">یادداشت‌های درختی:</span>
                        <span className="font-mono text-purple-400 font-bold">{toPersianDigits(notes.length)} سند</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    await install();
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg flex items-center gap-1 text-[11px]"
                >
                  <Download className="w-3 h-3" />
                  <span>نصب PWA</span>
                </button>
              )}
              <div className="flex items-center gap-2 mr-auto text-[11px] text-slate-400">
                <span>کنترل‌ها: [‹ ›] تعویض نما • [+] افزودن • [ویرایش] • [اندازه: {widgetSize}]</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Confirm Delete Modal for Widget Item Deletion */}
      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        title={itemToDelete?.type === 'task' ? 'حذف وظیفه از ویجت' : 'حذف یادداشت از ویجت'}
        itemName={itemToDelete?.title}
        message="آیا از حذف این مورد اطمینان دارید؟ این عملیات غیرقابل بازگشت است."
        onConfirm={async () => {
          if (itemToDelete) {
            if (itemToDelete.type === 'task' && onDeleteTask) {
              await onDeleteTask(itemToDelete.id);
            } else if (itemToDelete.type === 'note' && onDeleteNote) {
              await onDeleteNote(itemToDelete.id);
            }
            setItemToDelete(null);
          }
        }}
        onCancel={() => setItemToDelete(null)}
      />
    </>
  );
};
