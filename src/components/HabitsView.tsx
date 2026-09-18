import React, { useState } from 'react';
import {
  Plus,
  Flame,
  CheckCircle2,
  Trash2,
  Edit3,
  X,
  Award,
  Settings2,
  Calendar,
  Check,
  CalendarDays,
  CheckSquare,
  Sparkles,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Clock,
  Bell,
  AlarmClock,
  Circle,
  Target,
} from 'lucide-react';
import { Habit, HabitLog, Category, HabitFrequency } from '../types';
import {
  getTodayJalali,
  getLastNDaysJalaliInfo,
  toPersianDigits,
  isDateInCurrentWeekJalali,
  getCurrentJalaliMonthInfo,
  PERSIAN_MONTHS,
  PERSIAN_WEEK_DAYS_ORDERED,
  getCurrentWeekDaysJalali,
  getPersianDayOfWeekFromJalali,
  isHabitScheduledForDate,
  getHabitMonthlyScheduledDayNumber,
  parseJalali,
  getDaysInJalaliMonth,
} from '../utils/jalali';
import { soundFx } from '../utils/audio';
import { CategoryManagerModal } from './CategoryManagerModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { JalaliDatePickerField } from './JalaliDatePickerModal';

interface HabitsViewProps {
  habits: Habit[];
  habitLogs: HabitLog[];
  categories: Category[];
  onAddHabit: (habit: Omit<Habit, 'id'>) => Promise<void>;
  onUpdateHabit: (habit: Habit) => Promise<void>;
  onDeleteHabit: (habitId: number) => Promise<void>;
  onToggleHabit: (habitId: number, dateJalali?: string) => void;
  onAddCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  onDeleteCategory: (categoryId: number) => Promise<void>;
  onReorderHabits?: (habits: Habit[]) => Promise<void>;
  onStartPomodoroForHabit?: (habitId: number) => void;
}

export const HabitsView: React.FC<HabitsViewProps> = ({
  habits,
  habitLogs,
  categories,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  onToggleHabit,
  onAddCategory,
  onDeleteCategory,
  onReorderHabits,
  onStartPomodoroForHabit,
}) => {
  const [filterFrequency, setFilterFrequency] = useState<'all' | HabitFrequency>('all');
  const [showOnlyToday, setShowOnlyToday] = useState(true); // Default to Today's Habits
  const [expandedHabits, setExpandedHabits] = useState<Record<number, boolean>>({});
  const [habitToDelete, setHabitToDelete] = useState<{ id: number; title: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const toggleAccordion = (habitId: number) => {
    setExpandedHabits((prev) => ({
      ...prev,
      [habitId]: !prev[habitId],
    }));
  };

  // Drag and drop / Reordering states
  const [draggedHabitId, setDraggedHabitId] = useState<number | null>(null);
  const [dragOverHabitId, setDragOverHabitId] = useState<number | null>(null);

  // Deduplicate categories list to ensure no repeated titles
  const uniqueCategories: Category[] = categories.filter(
    (c, index, self) => index === self.findIndex((t) => t.title.trim() === c.title.trim())
  );

  // Form states
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number>(uniqueCategories[0]?.id || 1);
  const [targetFrequency, setTargetFrequency] = useState<HabitFrequency>('daily');
  const [targetCount, setTargetCount] = useState<number>(1);
  const [reminderTime, setReminderTime] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([0, 1, 2, 3, 4]); // شنبه تا چهارشنبه
  const [monthlyType, setMonthlyType] = useState<'day_of_month' | 'last_day'>('day_of_month');
  const [monthlyDay, setMonthlyDay] = useState<number>(1);

  const today = getTodayJalali();
  const currentMonthInfo = getCurrentJalaliMonthInfo();
  // 7 days ending with today (from 6 days ago up to today) for daily habits
  const last7Days = getLastNDaysJalaliInfo(7);
  // 7 days of the current Persian week (Saturday through Friday)
  const currentWeekDays = getCurrentWeekDaysJalali();

  const openAddModal = () => {
    setEditingHabit(null);
    setTitle('');
    setCategoryId(uniqueCategories[0]?.id || 1);
    setTargetFrequency('daily');
    setTargetCount(1);
    setReminderTime('');
    setTargetDate('');
    setWeeklyDays([0, 1, 2, 3, 4]);
    setMonthlyType('day_of_month');
    setMonthlyDay(1);
    setIsModalOpen(true);
  };

  const openEditModal = (h: Habit) => {
    setEditingHabit(h);
    setTitle(h.title);
    setCategoryId(h.category_id);
    setTargetFrequency(h.target_frequency || 'daily');
    setTargetCount(h.target_count || (h.target_frequency === 'weekly' ? 3 : 1));
    setReminderTime(h.reminder_time || '');
    setTargetDate(h.target_date || '');
    setWeeklyDays(h.weekly_days && h.weekly_days.length > 0 ? h.weekly_days : [0, 1, 2, 3, 4]);
    setMonthlyType(h.monthly_type || 'day_of_month');
    setMonthlyDay(h.monthly_day || 1);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const count =
      targetFrequency === 'daily'
        ? 1
        : targetFrequency === 'weekly'
        ? weeklyDays.length > 0
          ? weeklyDays.length
          : Math.max(1, Number(targetCount) || 3)
        : Math.max(1, Number(targetCount) || 1);

    const habitPayload = {
      title: title.trim(),
      category_id: categoryId,
      target_frequency: targetFrequency,
      target_count: count,
      reminder_time: reminderTime.trim() || undefined,
      target_date: targetDate.trim() || undefined,
      weekly_days: targetFrequency === 'weekly' ? weeklyDays : undefined,
      monthly_type: targetFrequency === 'monthly' ? monthlyType : undefined,
      monthly_day: targetFrequency === 'monthly' && monthlyType === 'day_of_month' ? monthlyDay : undefined,
    };

    if (editingHabit && editingHabit.id) {
      await onUpdateHabit({
        ...editingHabit,
        ...habitPayload,
      });
    } else {
      await onAddHabit({
        ...habitPayload,
        icon: 'Flame',
      });
    }
    setIsModalOpen(false);
  };

  // Calculate streak for a daily habit (consecutive days ending today or yesterday)
  const calculateDailyStreak = (habitId: number): number => {
    const logs = habitLogs.filter((l) => l.habit_id === habitId && l.status === 'done');
    const logDates = new Set(logs.map((l) => l.completed_date_jalali));

    let streak = 0;
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d).split('/');
      const dateStr = `${parts[0]}/${parts[1]}/${parts[2]}`;

      if (logDates.has(dateStr)) {
        streak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }
    return streak;
  };

  // Weekly habit helpers: smart completion tracking against assigned recurring days
  const getWeeklyHabitStats = (habit: Habit) => {
    const habitId = habit.id!;
    const doneLogsInCurrentWeek = habitLogs.filter(
      (l) => l.habit_id === habitId && l.status === 'done' && isDateInCurrentWeekJalali(l.completed_date_jalali)
    );

    if (habit.weekly_days && habit.weekly_days.length > 0) {
      // Calculate strictly against assigned days
      const assignedDayIds = new Set(habit.weekly_days);
      const completedAssignedDaysCount = currentWeekDays.filter(
        (day) =>
          assignedDayIds.has(day.dayId) &&
          doneLogsInCurrentWeek.some((l) => l.completed_date_jalali === day.dateJalali)
      ).length;

      const target = habit.weekly_days.length;
      const isTargetMet = completedAssignedDaysCount >= target;
      return { count: completedAssignedDaysCount, target, isTargetMet };
    }

    const target = habit.target_count || 3;
    const count = doneLogsInCurrentWeek.length;
    const isTargetMet = count >= target;
    return { count, target, isTargetMet };
  };

  // Monthly habit helpers
  const getMonthlyHabitStats = (habit: Habit) => {
    const habitId = habit.id!;
    const [todayYear, todayMonth] = today.split('/');
    const currentMonthPrefix = `${todayYear}/${todayMonth}`;
    const doneLogsInCurrentMonth = habitLogs.filter(
      (l) => l.habit_id === habitId && l.status === 'done' && l.completed_date_jalali.startsWith(currentMonthPrefix)
    );
    const isDone = doneLogsInCurrentMonth.length > 0;
    return { isDone, count: doneLogsInCurrentMonth.length };
  };

  const isDueToday = (habit: Habit): boolean => {
    return isHabitScheduledForDate(habit, today);
  };

  // 4-Section Expandable Accordion Architecture
  const [accordions, setAccordions] = useState<{
    today: boolean;
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
  }>({
    today: true,   // 'Today\'s Habits' (default: expanded)
    daily: false,  // 'Daily Habits'
    weekly: false, // 'Weekly Habits'
    monthly: false,// 'Monthly Habits'
  });

  const toggleAccordionSection = (key: 'today' | 'daily' | 'weekly' | 'monthly') => {
    setAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAllSections = () => {
    setAccordions({ today: true, daily: true, weekly: true, monthly: true });
  };

  const collapseAllSections = () => {
    setAccordions({ today: false, daily: false, weekly: false, monthly: false });
  };

  // Dynamic habit grouping
  const todayHabits = habits.filter((h) => isDueToday(h));
  const dailyHabits = habits.filter((h) => !h.target_frequency || h.target_frequency === 'daily');
  const weeklyHabits = habits.filter((h) => h.target_frequency === 'weekly');
  const monthlyHabits = habits.filter((h) => h.target_frequency === 'monthly');

  const todayCompletedCount = todayHabits.filter((h) =>
    habitLogs.some((l) => l.habit_id === h.id && l.completed_date_jalali === today && l.status === 'done')
  ).length;

  const dailyCompletedCount = dailyHabits.filter((h) =>
    habitLogs.some((l) => l.habit_id === h.id && l.completed_date_jalali === today && l.status === 'done')
  ).length;

  const weeklyCompletedCount = weeklyHabits.filter((h) => {
    const { isTargetMet } = getWeeklyHabitStats(h);
    return isTargetMet;
  }).length;

  const monthlyCompletedCount = monthlyHabits.filter((h) => {
    const { isDone } = getMonthlyHabitStats(h);
    return isDone;
  }).length;

  const handleMoveHabit = (habitId: number, direction: 'up' | 'down') => {
    const currentIdx = habits.findIndex((h) => h.id === habitId);
    if (currentIdx === -1) return;
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= habits.length) return;

    const newHabits = [...habits];
    const [moved] = newHabits.splice(currentIdx, 1);
    newHabits.splice(targetIdx, 0, moved);
    if (onReorderHabits) {
      onReorderHabits(newHabits);
    }
  };

  const handleDropHabit = (targetHabitId: number) => {
    if (!draggedHabitId || draggedHabitId === targetHabitId) {
      setDraggedHabitId(null);
      setDragOverHabitId(null);
      return;
    }
    const currentIdx = habits.findIndex((h) => h.id === draggedHabitId);
    const targetIdx = habits.findIndex((h) => h.id === targetHabitId);
    if (currentIdx === -1 || targetIdx === -1) {
      setDraggedHabitId(null);
      setDragOverHabitId(null);
      return;
    }

    const newHabits = [...habits];
    const [moved] = newHabits.splice(currentIdx, 1);
    newHabits.splice(targetIdx, 0, moved);
    setDraggedHabitId(null);
    setDragOverHabitId(null);
    if (onReorderHabits) {
      onReorderHabits(newHabits);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">رهگیری عادات</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            برنامه‌ریزی و ثبت انجام عادات به تفکیک روزانه، هفتگی و ماهانه
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 flex items-center gap-1.5 transition-all"
            title="مدیریت دسته‌بندی‌ها"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">مدیریت دسته‌ها</span>
          </button>
          <button
            onClick={openAddModal}
            id="add-habit-button"
            className="px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow-lg shadow-amber-600/30 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>عادت جدید</span>
          </button>
        </div>
      </div>

      {/* Top Controls: Summary KPIs & Expand/Collapse All */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* KPI Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>امروز: {toPersianDigits(todayCompletedCount)}/{toPersianDigits(todayHabits.length)}</span>
          </div>
          <div className="px-2.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>روزانه: {toPersianDigits(dailyHabits.length)}</span>
          </div>
          <div className="px-2.5 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-semibold flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-sky-400" />
            <span>هفتگی: {toPersianDigits(weeklyHabits.length)}</span>
          </div>
          <div className="px-2.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-purple-400" />
            <span>ماهانه: {toPersianDigits(monthlyHabits.length)}</span>
          </div>
        </div>

        {/* Expand / Collapse All Quick Action */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={expandAllSections}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
          >
            باز کردن همه
          </button>
          <button
            type="button"
            onClick={collapseAllSections}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            بستن همه
          </button>
        </div>
      </div>

      {/* Habit Card Renderer */}
      {(() => {
        const renderHabitCard = (habit: Habit, habitIndex: number, sectionKey: string = 'habit') => {
          const category = uniqueCategories.find((c) => c.id === habit.category_id);
          const freq: HabitFrequency = habit.target_frequency || 'daily';
          const isExpanded = !!expandedHabits[habit.id!];
          const isDoneToday = habitLogs.some(
            (l) => l.habit_id === habit.id && l.completed_date_jalali === today && l.status === 'done'
          );

          return (
            <div
              key={`${sectionKey}-${habit.id}`}
              draggable
              onDragStart={(e) => {
                if (habit.id) {
                  e.dataTransfer.setData('text/plain', habit.id.toString());
                  setDraggedHabitId(habit.id);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (habit.id && habit.id !== draggedHabitId) {
                  setDragOverHabitId(habit.id);
                }
              }}
              onDragLeave={() => {
                if (habit.id && dragOverHabitId === habit.id) {
                  setDragOverHabitId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (habit.id) handleDropHabit(habit.id);
              }}
              onDragEnd={() => {
                setDraggedHabitId(null);
                setDragOverHabitId(null);
              }}
              className={`bg-slate-900/90 border rounded-3xl p-4 shadow-sm transition-all ${
                dragOverHabitId === habit.id
                  ? 'border-amber-500 ring-2 ring-amber-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              } ${draggedHabitId === habit.id ? 'opacity-40 scale-[0.99]' : ''}`}
            >
              {/* Accordion Header: Habit Info, Mini Consistency Preview, Quick Today Check, Actions */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white truncate">{habit.title}</h3>
                      {category && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                          style={{
                            backgroundColor: `${category.color || '#3b82f6'}20`,
                            color: category.color || '#3b82f6',
                          }}
                        >
                          {category.title}
                        </span>
                      )}

                      {/* Frequency Badge */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                          freq === 'daily'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : freq === 'weekly'
                            ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                            : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                        }`}
                      >
                        {freq === 'daily'
                          ? 'روزانه'
                          : freq === 'weekly'
                          ? `هفتگی (${toPersianDigits(habit.target_count || 3)} بار)`
                          : `ماهانه (${toPersianDigits(habit.target_count || 1)} بار)`}
                      </span>

                      {/* Reminder Time Badge */}
                      {habit.reminder_time && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md font-medium border bg-amber-500/15 text-amber-300 border-amber-500/30 flex items-center gap-1 font-mono"
                          title="ساعت یادآوری"
                        >
                          <Bell className="w-3 h-3 text-amber-400" />
                          {toPersianDigits(habit.reminder_time)}
                        </span>
                      )}

                      {/* Target Date Badge */}
                      {habit.target_date && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md font-medium border bg-slate-800 text-slate-300 border-slate-700 flex items-center gap-1 font-mono"
                          title="تاریخ هدف یا شروع"
                        >
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {toPersianDigits(habit.target_date)}
                        </span>
                      )}
                    </div>

                    {/* Streak or Progress Info */}
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      {freq === 'daily' && (
                        <span className="flex items-center gap-1 text-amber-400 font-medium">
                          <Flame className="w-3.5 h-3.5" />
                          زنجیره استمرار: {toPersianDigits(calculateDailyStreak(habit.id!))} روز پیاپی
                        </span>
                      )}

                      {freq === 'weekly' && (() => {
                        const { count, target, isTargetMet } = getWeeklyHabitStats(habit);
                        return (
                          <span
                            className={`flex items-center gap-1 font-medium ${
                              isTargetMet ? 'text-emerald-400' : 'text-sky-400'
                            }`}
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            این هفته: {toPersianDigits(count)} از {toPersianDigits(target)} بار
                            {isTargetMet ? ' (تکمیل شد ✓)' : ''}
                          </span>
                        );
                      })()}

                      {freq === 'monthly' && (() => {
                        const { isDone } = getMonthlyHabitStats(habit);
                        return (
                          <span
                            className={`flex items-center gap-1 font-medium ${
                              isDone ? 'text-emerald-400' : 'text-purple-400'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            ماه {currentMonthInfo.monthName}: {isDone ? 'تکمیل شده ✓' : 'در انتظار انجام ○'}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right/End: Mini Consistency Dots Preview, Quick 1-Tap Today Button, Accordion Toggle & Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {/* Mini Consistency Preview Dots in Header */}
                  <div
                    className="flex items-center gap-1 bg-slate-800/80 px-2 py-1.5 rounded-xl border border-slate-750"
                    title="پیش‌نمایش ثبات و تیک روزهای اخیر"
                  >
                    {freq === 'daily' && (
                      <div className="flex items-center gap-1">
                        {last7Days.map((d, dIdx) => {
                          const isDone = habitLogs.some(
                            (l) =>
                              l.habit_id === habit.id &&
                              l.completed_date_jalali === d.dateJalali &&
                              l.status === 'done'
                          );
                          return (
                            <div
                              key={dIdx}
                              title={`${d.shortDayName} (${d.dateJalali}): ${isDone ? 'انجام شد' : 'انجام نشده'}`}
                              className={`w-2 h-2 rounded-full transition-all ${
                                isDone
                                  ? 'bg-amber-400 shadow-xs shadow-amber-400/50'
                                  : d.isToday
                                  ? 'border border-amber-400 bg-amber-400/30'
                                  : 'bg-slate-700'
                              }`}
                            />
                          );
                        })}
                      </div>
                    )}
                    {freq === 'weekly' && (
                      <div className="flex items-center gap-1">
                        {currentWeekDays.map((d) => {
                          const isTargetDay = habit.weekly_days?.length
                            ? habit.weekly_days.includes(d.dayId)
                            : true;
                          const isDone = habitLogs.some(
                            (l) =>
                              l.habit_id === habit.id &&
                              l.completed_date_jalali === d.dateJalali &&
                              l.status === 'done'
                          );
                          return (
                            <div
                              key={d.dayId}
                              title={`${d.shortName}: ${isDone ? 'انجام شد' : isTargetDay ? 'روز هدف' : 'اختیاری'}`}
                              className={`w-2 h-2 rounded-full transition-all ${
                                isDone
                                  ? 'bg-sky-400 shadow-xs shadow-sky-400/50'
                                  : isTargetDay
                                  ? 'border border-sky-400/60 bg-sky-500/20'
                                  : 'bg-slate-700'
                              }`}
                            />
                          );
                        })}
                      </div>
                    )}
                    {freq === 'monthly' && (() => {
                      const { isDone } = getMonthlyHabitStats(habit);
                      return (
                        <div
                          title={`وضعیت ماه جاری (${currentMonthInfo.monthName}): ${
                            isDone ? 'تکمیل شده' : 'انجام نشده'
                          }`}
                          className={`w-2.5 h-2.5 rounded-full ${
                            isDone
                              ? 'bg-purple-400 shadow-xs shadow-purple-400/50'
                              : 'border border-purple-400/60 bg-purple-500/20'
                          }`}
                        />
                      );
                    })()}
                  </div>

                  {/* 1-Tap Quick Today Checkmark */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (habit.id) {
                        soundFx.playCheckmark();
                        onToggleHabit(habit.id, today);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                      isDoneToday
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                        : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-emerald-400 border-slate-700'
                    }`}
                    title={isDoneToday ? 'امروز انجام شده (کلیک برای لغو)' : 'ثبت انجام سریع برای امروز'}
                  >
                    {isDoneToday ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="font-medium">{isDoneToday ? 'امروز ✓' : 'ثبت امروز'}</span>
                  </button>

                  {/* Accordion Expand / Collapse Toggle Button */}
                  <button
                    type="button"
                    onClick={() => habit.id && toggleAccordion(habit.id)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1 transition-all ${
                      isExpanded
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                    title={isExpanded ? 'بستن تقویم آکاردئون' : 'مشاهده تقویم و ثبت روزها'}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-amber-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="hidden sm:inline text-[11px]">
                      {isExpanded ? 'بستن' : 'تقویم'}
                    </span>
                  </button>

                  {/* Reorder Buttons & Handle */}
                  <div className="flex items-center bg-slate-800/60 rounded-xl p-0.5 border border-slate-700/50">
                    <button
                      type="button"
                      disabled={habitIndex === 0}
                      onClick={() => habit.id && handleMoveHabit(habit.id, 'up')}
                      className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-amber-400 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                      title="انتقال به بالا"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={habitIndex === habits.length - 1}
                      onClick={() => habit.id && handleMoveHabit(habit.id, 'down')}
                      className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-amber-400 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                      title="انتقال به پایین"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <div
                      className="p-1 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing"
                      title="نگه‌داشتن و کشیدن برای جابه‌جایی (⋮⋮)"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {onStartPomodoroForHabit && habit.id && (
                    <button
                      type="button"
                      onClick={() => onStartPomodoroForHabit(habit.id!)}
                      className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
                      title="شروع تمرکز پومودورو برای این عادت"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => openEditModal(habit)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="ویرایش عادت"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setHabitToDelete({ id: habit.id!, title: habit.title })}
                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                    title="حذف عادت"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Accordion Collapsible Body: Detailed Check-in Controls & Interactive Strips */}
              {isExpanded && (
                <div className="animate-fadeIn">
                  {/* CASE A: DAILY HABIT (7-Day Past Strip: 7 days up to today) */}
              {freq === 'daily' && (
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      برنامه و ثبت روزها (از ۷ روز گذشته تا امروز):
                    </span>
                    <span className="text-[10px] text-slate-500">
                      برای ثبت یا لغو تیک روزهای گذشته یا امروز، روی هر روز کلیک کنید
                    </span>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {last7Days.map((d, idx) => {
                      const isDone = habitLogs.some(
                        (l) =>
                          l.habit_id === habit.id &&
                          l.completed_date_jalali === d.dateJalali &&
                          l.status === 'done'
                      );

                      return (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => {
                            if (habit.id) {
                              soundFx.playCheckmark();
                              onToggleHabit(habit.id, d.dateJalali);
                            }
                          }}
                          title={`${d.dayName} (${d.dateJalali}) - ${isDone ? 'تکمیل‌شده' : 'انجام‌نشده'}`}
                          className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer border ${
                            isDone
                              ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                              : d.isToday
                              ? 'border-amber-500/80 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 ring-1 ring-amber-500/50'
                              : 'bg-slate-800/80 text-slate-400 border-slate-750 hover:bg-slate-750 hover:text-slate-200'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-medium ${
                              d.isToday && !isDone ? 'text-amber-400 font-bold' : ''
                            }`}
                          >
                            {d.shortDayName}
                          </span>
                          <span className="text-xs font-black">{d.dayNumber}</span>
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                              isDone ? 'bg-slate-950 text-amber-400 font-black' : 'text-slate-500'
                            }`}
                          >
                            {isDone ? '✓' : '○'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CASE B: WEEKLY HABIT (Interactive Persian Week Strip & Targeted Progress) */}
              {freq === 'weekly' && (() => {
                const { count, target, isTargetMet } = getWeeklyHabitStats(habit);
                const percent = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
                const hasAssignedDays = habit.weekly_days && habit.weekly_days.length > 0;

                return (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-sky-400" />
                          پیشرفت در روزهای هدف این هفته ({toPersianDigits(count)} از {toPersianDigits(target)} روز):
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {hasAssignedDays ? (
                            <>
                              روزهای تکرار انتخابی:{' '}
                              <span className="text-sky-300 font-medium">
                                {habit.weekly_days!
                                  .map((id) => PERSIAN_WEEK_DAYS_ORDERED[id]?.name)
                                  .join('، ')}
                              </span>
                            </>
                          ) : (
                            `هدف هفتگی شما ${toPersianDigits(target)} بار در هفته است.`
                          )}
                        </p>
                      </div>

                      {/* Quick 1-tap today button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (habit.id) {
                            soundFx.playCheckmark();
                            onToggleHabit(habit.id, today);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0 ${
                          isTargetMet
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                            : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>ثبت برای امروز ({toPersianDigits(today)})</span>
                      </button>
                    </div>

                    {/* Interactive 7-Day Persian Week Grid (شنبه تا جمعه) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>روزهای هفته جاری (شنبه تا جمعه):</span>
                        <span className="text-[10px] text-slate-500">برای ثبت یا لغو تیک، روی روز کلیک کنید</span>
                      </div>
                      <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {currentWeekDays.map((d) => {
                          const isTargetDay = hasAssignedDays ? habit.weekly_days!.includes(d.dayId) : true;
                          const isDone = habitLogs.some(
                            (l) =>
                              l.habit_id === habit.id &&
                              l.completed_date_jalali === d.dateJalali &&
                              l.status === 'done'
                          );

                          return (
                            <button
                              type="button"
                              key={d.dayId}
                              onClick={() => {
                                if (habit.id) {
                                  soundFx.playCheckmark();
                                  onToggleHabit(habit.id, d.dateJalali);
                                }
                              }}
                              title={`${d.name} (${d.dateJalali}) - ${isTargetDay ? 'روز هدف' : 'اختیاری'} - ${isDone ? 'تکمیل‌شده' : 'انجام‌نشده'}`}
                              className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer border relative ${
                                isDone
                                  ? 'bg-sky-600 text-white font-bold border-sky-400 shadow-md shadow-sky-600/20'
                                  : d.isToday
                                  ? 'border-sky-500/80 bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/50'
                                  : isTargetDay
                                  ? 'bg-slate-850 border-sky-500/30 text-slate-200 hover:border-sky-500/60'
                                  : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300'
                              }`}
                            >
                              <span className={`text-[10px] font-medium ${d.isToday && !isDone ? 'text-sky-400 font-bold' : ''}`}>
                                {d.shortName}
                              </span>
                              <span className="text-xs font-black">{d.dayNumber}</span>
                              {isTargetDay && (
                                <span className={`text-[8px] px-1 py-0.2 rounded-md ${isDone ? 'bg-sky-900/80 text-sky-200' : 'bg-sky-500/20 text-sky-300'}`}>
                                  هدف
                                </span>
                              )}
                              <span
                                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                                  isDone ? 'bg-slate-950 text-sky-300 font-black' : 'text-slate-600'
                                }`}
                              >
                                {isDone ? '✓' : '○'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">
                          {toPersianDigits(count)} از {toPersianDigits(target)} روز هدف انجام شده
                        </span>
                        <span className="font-mono font-bold text-sky-400">
                          {toPersianDigits(percent)}٪
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isTargetMet
                              ? 'bg-gradient-to-r from-teal-400 to-emerald-500'
                              : 'bg-gradient-to-r from-sky-500 to-blue-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CASE C: MONTHLY HABIT (Monthly Check-In & 12 Months Tracker) */}
              {freq === 'monthly' && (() => {
                const { isDone } = getMonthlyHabitStats(habit);
                const [todayYear, todayMonth] = today.split('/');
                const currentMonthNum = parseInt(todayMonth, 10);
                const isTodayScheduled = isHabitScheduledForDate(habit, today);
                const scheduledDayNum = getHabitMonthlyScheduledDayNumber(
                  habit,
                  currentMonthInfo.year,
                  currentMonthInfo.monthNumber
                );

                return (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            وضعیت ماه جاری ({currentMonthInfo.monthName} {toPersianDigits(currentMonthInfo.year)}):
                          </span>
                          {isTodayScheduled && (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold animate-pulse flex items-center gap-1">
                              <span>🔥</span>
                              <span>امروز روز موعد این عادت است!</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {habit.monthly_type === 'last_day' ? (
                            <>
                              موعد تکرار:{' '}
                              <span className="text-purple-300 font-medium">
                                روز آخر هر ماه (در {currentMonthInfo.monthName}: روز {toPersianDigits(scheduledDayNum)})
                              </span>
                            </>
                          ) : (
                            <>
                              موعد تکرار:{' '}
                              <span className="text-purple-300 font-medium">
                                روز {toPersianDigits(habit.monthly_day || 1)} هر ماه
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (habit.id) {
                            soundFx.playCheckmark();
                            const monthDate = `${todayYear}/${todayMonth}/01`;
                            onToggleHabit(habit.id, monthDate);
                          }
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-md shrink-0 ${
                          isDone
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {isDone
                            ? `تکمیل‌شده در ${currentMonthInfo.monthName} (لغو)`
                            : `ثبت انجام برای ماه ${currentMonthInfo.monthName}`}
                        </span>
                      </button>
                    </div>

                    {/* 12 Months Grid for the Year */}
                    <div className="pt-2 border-t border-slate-800/60">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-slate-400">
                          ثبت ماه‌های سال {toPersianDigits(currentMonthInfo.year)}:
                        </span>
                        <span className="text-[10px] text-slate-500">
                          برای ثبت یا لغو هر ماه، روی آن کلیک کنید
                        </span>
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                        {PERSIAN_MONTHS.map((mName, mIdx) => {
                          const mNum = mIdx + 1;
                          const mStr = mNum < 10 ? `0${mNum}` : `${mNum}`;
                          const monthDateKey = `${todayYear}/${mStr}/01`;
                          const monthPrefix = `${todayYear}/${mStr}`;
                          const isMonthDone = habitLogs.some(
                            (l) =>
                              l.habit_id === habit.id &&
                              l.status === 'done' &&
                              l.completed_date_jalali.startsWith(monthPrefix)
                          );
                          const isCurrent = mNum === currentMonthNum;

                          return (
                            <button
                              key={mIdx}
                              type="button"
                              onClick={() => {
                                if (habit.id) {
                                  soundFx.playCheckmark();
                                  onToggleHabit(habit.id, monthDateKey);
                                }
                              }}
                              className={`p-2 rounded-xl text-center border transition-all text-xs flex flex-col items-center justify-center gap-1 ${
                                isMonthDone
                                  ? 'bg-purple-600 text-white font-bold border-purple-500 shadow-sm shadow-purple-600/30'
                                  : isCurrent
                                  ? 'bg-purple-500/10 border-purple-500/40 text-purple-300 hover:bg-purple-500/20'
                                  : 'bg-slate-800/80 border-slate-750 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <span className="text-[11px]">{mName}</span>
                              <span className="text-[10px] font-mono">
                                {isMonthDone ? '✓' : isCurrent ? '○ جاری' : '—'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
                  </div>
                )}
            </div>
          );
        };

        return (
          <div className="space-y-3.5">
            {/* SECTION 1: TODAY'S HABITS (عادات امروز - پیش‌فرض باز) */}
            <div className={`bg-slate-900/90 border rounded-3xl overflow-hidden shadow-sm transition-all ${
              accordions.today ? 'border-amber-500/80 ring-1 ring-amber-500/20' : 'border-slate-800 hover:border-slate-700'
            }`}>
              <div
                onClick={() => toggleAccordionSection('today')}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-850/60 transition-colors select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/10">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white tracking-tight">عادات امروز (Today's Habits)</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        انجام‌شده: {toPersianDigits(todayCompletedCount)} از {toPersianDigits(todayHabits.length)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      عادات برنامه‌ریزی‌شده و موعددار برای امروز ({toPersianDigits(today)})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-750 flex items-center justify-center text-slate-400">
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${accordions.today ? 'rotate-180 text-amber-400' : ''}`} />
                  </div>
                </div>
              </div>

              {accordions.today && (
                <div className="p-3 sm:p-4 pt-1 space-y-3 border-t border-slate-800/60 bg-slate-950/30">
                  {todayHabits.length === 0 ? (
                    <div className="text-center py-6 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-400">برای امروز هیچ عادتی برنامه‌ریزی نشده است.</p>
                    </div>
                  ) : (
                    todayHabits.map((habit, idx) => renderHabitCard(habit, idx, 'today'))
                  )}
                </div>
              )}
            </div>

            {/* SECTION 2: DAILY HABITS (عادات روزانه) */}
            <div className={`bg-slate-900/90 border rounded-3xl overflow-hidden shadow-sm transition-all ${
              accordions.daily ? 'border-blue-500/80 ring-1 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
            }`}>
              <div
                onClick={() => toggleAccordionSection('daily')}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-850/60 transition-colors select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/10">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white tracking-tight">عادات روزانه (Daily Habits)</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {toPersianDigits(dailyHabits.length)} عادت ({toPersianDigits(dailyCompletedCount)} تکمیل امروز)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      عادات با تکرار مداوم و روزمره در طول تمام روزهای هفته
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-750 flex items-center justify-center text-slate-400">
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${accordions.daily ? 'rotate-180 text-blue-400' : ''}`} />
                  </div>
                </div>
              </div>

              {accordions.daily && (
                <div className="p-3 sm:p-4 pt-1 space-y-3 border-t border-slate-800/60 bg-slate-950/30">
                  {dailyHabits.length === 0 ? (
                    <div className="text-center py-6 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-400">عادت روزانه‌ای ثبت نشده است.</p>
                    </div>
                  ) : (
                    dailyHabits.map((habit, idx) => renderHabitCard(habit, idx, 'daily'))
                  )}
                </div>
              )}
            </div>

            {/* SECTION 3: WEEKLY HABITS (عادات هفتگی) */}
            <div className={`bg-slate-900/90 border rounded-3xl overflow-hidden shadow-sm transition-all ${
              accordions.weekly ? 'border-sky-500/80 ring-1 ring-sky-500/20' : 'border-slate-800 hover:border-slate-700'
            }`}>
              <div
                onClick={() => toggleAccordionSection('weekly')}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-850/60 transition-colors select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-sky-500/10">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white tracking-tight">عادات هفتگی (Weekly Habits)</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {toPersianDigits(weeklyHabits.length)} عادت ({toPersianDigits(weeklyCompletedCount)} تکمیل هفتگی)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      اهداف مبتنی بر روزهای هفته (شنبه تا جمعه) یا سهمیه هفتگی
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-750 flex items-center justify-center text-slate-400">
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${accordions.weekly ? 'rotate-180 text-sky-400' : ''}`} />
                  </div>
                </div>
              </div>

              {accordions.weekly && (
                <div className="p-3 sm:p-4 pt-1 space-y-3 border-t border-slate-800/60 bg-slate-950/30">
                  {weeklyHabits.length === 0 ? (
                    <div className="text-center py-6 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-400">عادت هفتگی ثبت نشده است.</p>
                    </div>
                  ) : (
                    weeklyHabits.map((habit, idx) => renderHabitCard(habit, idx, 'weekly'))
                  )}
                </div>
              )}
            </div>

            {/* SECTION 4: MONTHLY HABITS (عادات ماهانه) */}
            <div className={`bg-slate-900/90 border rounded-3xl overflow-hidden shadow-sm transition-all ${
              accordions.monthly ? 'border-purple-500/80 ring-1 ring-purple-500/20' : 'border-slate-800 hover:border-slate-700'
            }`}>
              <div
                onClick={() => toggleAccordionSection('monthly')}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-850/60 transition-colors select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/10">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white tracking-tight">عادات ماهانه (Monthly Habits)</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {toPersianDigits(monthlyHabits.length)} عادت ({toPersianDigits(monthlyCompletedCount)} تکمیل ماه جاری)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      اهداف تکرارشونده در تقویم ماه‌های سال ({currentMonthInfo.monthName} {toPersianDigits(currentMonthInfo.year)})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-750 flex items-center justify-center text-slate-400">
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${accordions.monthly ? 'rotate-180 text-purple-400' : ''}`} />
                  </div>
                </div>
              </div>

              {accordions.monthly && (
                <div className="p-3 sm:p-4 pt-1 space-y-3 border-t border-slate-800/60 bg-slate-950/30">
                  {monthlyHabits.length === 0 ? (
                    <div className="text-center py-6 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-400">عادت ماهانه‌ای ثبت نشده است.</p>
                    </div>
                  ) : (
                    monthlyHabits.map((habit, idx) => renderHabitCard(habit, idx, 'monthly'))
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add / Edit Habit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingHabit ? 'ویرایش عادت' : 'تعریف عادت جدید'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  عنوان عادت *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثلاً: ۳۰ دقیقه ورزش، خواندن کتاب یا حسابرسی ماهانه"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">دسته‌بندی</label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>مدیریت دسته‌ها</span>
                  </button>
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl px-3 py-2.5 text-xs focus:outline-none focus:border-amber-500"
                >
                  {uniqueCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  بازه و دوره تکرار
                </label>
                <select
                  value={targetFrequency}
                  onChange={(e) => setTargetFrequency(e.target.value as HabitFrequency)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl px-3 py-2.5 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="daily">روزانه (هر روز)</option>
                  <option value="weekly">هفتگی (چند روز در هفته)</option>
                  <option value="monthly">ماهانه (چند بار در ماه)</option>
                </select>
              </div>

              {/* WEEKLY HABIT RECURRENCE: Multi-select day toggle pill grid (ش ، ی ، د ، س ، چ ، پ ، ج) */}
              {targetFrequency === 'weekly' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-sky-400" />
                      روزهای انتخابی تکرار در هفته:
                    </label>
                    <span className="text-[11px] font-mono text-sky-400">
                      {toPersianDigits(weeklyDays.length)} روز در هفته
                    </span>
                  </div>

                  {/* Multi-select Day Toggle Pill Grid */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {PERSIAN_WEEK_DAYS_ORDERED.map((day) => {
                      const isSelected = weeklyDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (weeklyDays.length > 1) {
                                setWeeklyDays(weeklyDays.filter((id) => id !== day.id));
                              }
                            } else {
                              setWeeklyDays([...weeklyDays, day.id].sort());
                            }
                          }}
                          className={`py-2 px-1 rounded-xl text-center border transition-all flex flex-col items-center justify-center gap-1 active:scale-95 ${
                            isSelected
                              ? 'bg-sky-600 text-white font-bold border-sky-400 shadow-md shadow-sky-600/30'
                              : 'bg-slate-800/90 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                          }`}
                        >
                          <span className="text-xs font-bold">{day.shortName}</span>
                          <span className="text-[9px] opacity-80 hidden sm:inline">{day.name}</span>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${isSelected ? 'bg-sky-800 text-white' : 'text-slate-600'}`}>
                            {isSelected ? '✓' : '○'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Preset Buttons for Weekly */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-slate-400">انتخاب سریع:</span>
                    {[
                      { label: 'روزهای ترید و کاری (ش تا چ)', days: [0, 1, 2, 3, 4] },
                      { label: 'شنبه و یکشنبه (مرور بازار)', days: [0, 1] },
                      { label: 'جمعه‌ها (ژورنال شخصی)', days: [6] },
                      { label: 'آخر هفته (پ و ج)', days: [5, 6] },
                      { label: 'تمام ۷ روز', days: [0, 1, 2, 3, 4, 5, 6] },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setWeeklyDays(preset.days)}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-750 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* MONTHLY HABIT RECURRENCE: Day of month (1st-31st) or Last Day */}
              {targetFrequency === 'monthly' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      الگوی تکرار ماهانه:
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMonthlyType('day_of_month')}
                      className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                        monthlyType === 'day_of_month'
                          ? 'bg-purple-600/20 border-purple-500 text-purple-200 font-bold'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <span>روز مشخص ماه</span>
                      <span className="text-[10px] opacity-70">مثلاً روز ۱، ۱۵ یا ۲۵ هر ماه</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMonthlyType('last_day')}
                      className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                        monthlyType === 'last_day'
                          ? 'bg-purple-600/20 border-purple-500 text-purple-200 font-bold'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <span>روز آخر ماه</span>
                      <span className="text-[10px] opacity-70">هوشمند (۲۹، ۳۰ یا ۳۱ام)</span>
                    </button>
                  </div>

                  {monthlyType === 'day_of_month' && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-slate-300">
                          انتخاب شماره روز ماه (۱ تا ۳۱):
                        </label>
                        <span className="text-xs font-bold font-mono text-purple-400">
                          روز {toPersianDigits(monthlyDay)} هر ماه
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={31}
                        value={monthlyDay}
                        onChange={(e) => setMonthlyDay(Number(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400">روزهای پیشنهادی:</span>
                        {[1, 5, 10, 15, 20, 25, 30].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setMonthlyDay(d)}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors ${
                              monthlyDay === d
                                ? 'bg-purple-600 text-white font-bold border-purple-500'
                                : 'bg-slate-750 text-slate-400 border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            روز {toPersianDigits(d)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {monthlyType === 'last_day' && (
                    <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-900/40 text-[11px] text-purple-300 space-y-1">
                      <p className="font-semibold">✓ زمان‌بندی هوشمند روز آخر ماه:</p>
                      <p className="text-slate-400">
                        در ۶ ماه اول سال روز ۳۱ام، در ۵ ماه دوم روز ۳۰ام و در اسفند ماه بر اساس سال عادی یا کبیسه (۲۹ یا ۳۰ام) به طور خودکار تعیین می‌شود.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Date & Time Settings (ساعت یادآوری و تاریخ) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    ساعت یادآوری / آلارم
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-mono"
                  />
                  {/* Quick time preset chips */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {['07:00', '13:00', '19:30', '22:00'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setReminderTime(t)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors ${
                          reminderTime === t
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                            : 'bg-slate-800/80 text-slate-400 border-slate-750 hover:text-slate-200'
                        }`}
                      >
                        {toPersianDigits(t)}
                      </button>
                    ))}
                    {reminderTime && (
                      <button
                        type="button"
                        onClick={() => setReminderTime('')}
                        className="text-[10px] px-1.5 py-0.5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                      >
                        پاک کردن
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    تاریخ هدف یا شروع (اختیاری)
                  </label>
                  <JalaliDatePickerField
                    value={targetDate}
                    onChange={(val) => setTargetDate(val)}
                    placeholder="انتخاب تاریخ شمسی..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium shadow-md shadow-amber-600/30"
                >
                  {editingHabit ? 'ذخیره تغییرات' : 'افزودن عادت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={uniqueCategories}
        onAddCategory={onAddCategory}
        onDeleteCategory={onDeleteCategory}
        onSelectCategory={(newCatId) => setCategoryId(newCatId)}
      />

      {/* Confirm Delete Habit Modal */}
      <ConfirmDeleteModal
        isOpen={!!habitToDelete}
        title="حذف عادت"
        itemName={habitToDelete?.title || ''}
        message="آیا از حذف این عادت اطمینان دارید؟ تمامی لاگ‌ها و پیشینه ثبت‌شده این عادت نیز حذف خواهند شد."
        onConfirm={async () => {
          if (habitToDelete) {
            await onDeleteHabit(habitToDelete.id);
            setHabitToDelete(null);
          }
        }}
        onCancel={() => setHabitToDelete(null)}
      />
    </div>
  );
};
