import React, { useEffect, useRef, useState } from 'react';
import {
  TrendingUp,
  Award,
  Zap,
  CheckCircle2,
  Clock,
  Calendar,
  Flame,
  Layers,
  ChevronDown,
  CalendarDays,
  CheckSquare,
  Target,
  ChevronRight,
  ChevronLeft,
  Filter,
  Sparkles,
  ArrowUpDown,
  X,
  BookOpen,
  DollarSign,
  Smile,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { DailyJournal, Habit, HabitLog, PomodoroSession, Category, Task, Attribute, Trade } from '../types';
import {
  getLastNDaysJalali,
  toPersianDigits,
  PERSIAN_WEEKDAYS,
  PERSIAN_MONTHS,
  getCurrentJalaliMonthInfo,
  getDaysInJalaliMonth,
  formatJalaliReadable,
  getTodayJalali,
  getPersianDayOfWeekFromJalali,
} from '../utils/jalali';

interface StatsViewProps {
  journals: DailyJournal[];
  habits: Habit[];
  habitLogs: HabitLog[];
  pomodoroSessions: PomodoroSession[];
  categories: Category[];
  tasks: Task[];
  attributes?: Attribute[];
  taskAttributesMap?: Record<number, number[]>;
  trades?: Trade[];
}

export const StatsView: React.FC<StatsViewProps> = ({
  journals = [],
  habits = [],
  habitLogs = [],
  pomodoroSessions = [],
  categories = [],
  tasks = [],
  attributes = [],
  taskAttributesMap = {},
  trades = [],
}) => {
  // Chart 1: Time range filter (7, 14, 30 days) for Productivity vs Energy correlation
  const [trendDaysRange, setTrendDaysRange] = useState<7 | 14 | 30>(7);

  // Monthly Category Execution Progress States
  const currentJalaliInfo = getCurrentJalaliMonthInfo();
  const [selectedYear, setSelectedYear] = useState<number>(currentJalaliInfo.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentJalaliInfo.monthNumber);

  // Interactive Day Inspection Modal State
  const [inspectedDate, setInspectedDate] = useState<string | null>(null);
  const [categoryChartViewMode, setCategoryChartViewMode] = useState<'combined' | 'tasks' | 'habits'>('combined');
  const [categoryChartDisplayType, setCategoryChartDisplayType] = useState<'count' | 'percent'>('count');

  // Canvas Ref for Productivity vs Energy correlation
  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 360);

  // Resize listener for responsive canvas charts
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Deduplicate categories and attributes
  const uniqueCategories = (categories || []).filter(
    (c, index, self) => index === self.findIndex((t) => t.title.trim() === c.title.trim())
  );
  const uniqueAttributes = (attributes || []).filter(
    (a, index, self) => index === self.findIndex((t) => t.title.trim() === a.title.trim())
  );

  const pastNDays = getLastNDaysJalali(trendDaysRange);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth > 1) {
      setSelectedMonth(selectedMonth - 1);
    } else {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth < 12) {
      setSelectedMonth(selectedMonth + 1);
    } else {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setSelectedYear(currentJalaliInfo.year);
    setSelectedMonth(currentJalaliInfo.monthNumber);
  };

  // =========================================================================
  // MONTHLY CATEGORY DATA CALCULATION (HABITS + TASKS COMBINED)
  // =========================================================================
  const monthPrefix = `${selectedYear}/${String(selectedMonth).padStart(2, '0')}`;
  const today = getTodayJalali();
  const [todayY, todayM, todayD] = today.split('/');
  const isCurrentMonth = parseInt(todayY, 10) === selectedYear && parseInt(todayM, 10) === selectedMonth;
  const currentDay = parseInt(todayD, 10);
  const daysInMonth = getDaysInJalaliMonth(selectedYear, selectedMonth);

  const monthlyCategoryStats = uniqueCategories.map((cat) => {
    // 1. Tasks in category for this month
    const catTasks = tasks.filter((t) => t.category_id === cat.id);
    const monthTasks = catTasks.filter(
      (t) =>
        (t.due_date && t.due_date.startsWith(monthPrefix)) ||
        (!t.due_date && t.created_at && t.created_at.startsWith(monthPrefix))
    );
    // If no tasks specifically stamped with this month but it's current month, fallback to all category tasks
    const effectiveTasks = monthTasks.length > 0 ? monthTasks : isCurrentMonth ? catTasks : [];
    const tasksTotal = effectiveTasks.length;
    const tasksCompleted = effectiveTasks.filter((t) => t.status === 'completed').length;
    const tasksRate = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

    // 2. Habits in category for this month
    const catHabits = habits.filter((h) => h.category_id === cat.id);
    let habitsDoneCount = 0;
    let habitsExpectedCount = 0;

    catHabits.forEach((h) => {
      const doneLogs = habitLogs.filter(
        (l) =>
          l.habit_id === h.id &&
          l.status === 'done' &&
          l.completed_date_jalali &&
          l.completed_date_jalali.startsWith(monthPrefix)
      ).length;
      habitsDoneCount += doneLogs;

      let targetCount = 1;
      if (h.target_frequency === 'daily') {
        targetCount = isCurrentMonth ? Math.max(1, currentDay) : daysInMonth;
      } else if (h.target_frequency === 'weekly') {
        const weeksPassed = isCurrentMonth ? Math.max(1, Math.ceil(currentDay / 7)) : 4;
        targetCount = (h.target_count || 3) * weeksPassed;
      } else if (h.target_frequency === 'monthly') {
        targetCount = h.target_count || 1;
      }
      habitsExpectedCount += targetCount;
    });
    const habitsRate = habitsExpectedCount > 0 ? Math.round((habitsDoneCount / habitsExpectedCount) * 100) : 0;

    // 3. Combined total of Habits + Tasks
    const combinedTotal = tasksTotal + habitsExpectedCount;
    const combinedCompleted = tasksCompleted + habitsDoneCount;
    const combinedRate = combinedTotal > 0 ? Math.min(100, Math.round((combinedCompleted / combinedTotal) * 100)) : 0;

    return {
      category: cat,
      tasksTotal,
      tasksCompleted,
      tasksRate,
      habitsDoneCount,
      habitsExpectedCount,
      habitsRate,
      combinedTotal,
      combinedCompleted,
      combinedRate,
    };
  });

  // Monthly summary stats across all categories
  const totalMonthCompleted = monthlyCategoryStats.reduce((sum, s) => {
    if (categoryChartViewMode === 'tasks') return sum + s.tasksCompleted;
    if (categoryChartViewMode === 'habits') return sum + s.habitsDoneCount;
    return sum + s.combinedCompleted;
  }, 0);

  const totalMonthTarget = monthlyCategoryStats.reduce((sum, s) => {
    if (categoryChartViewMode === 'tasks') return sum + s.tasksTotal;
    if (categoryChartViewMode === 'habits') return sum + s.habitsExpectedCount;
    return sum + s.combinedTotal;
  }, 0);

  const overallMonthRate =
    totalMonthTarget > 0 ? Math.min(100, Math.round((totalMonthCompleted / totalMonthTarget) * 100)) : 0;

  // Best performing category of the month
  const topCategory =
    monthlyCategoryStats
      .filter((s) => s.combinedTotal > 0)
      .slice()
      .sort((a, b) => b.combinedRate - a.combinedRate)[0] || null;

  // =========================================================================
  // 1. Productivity vs. Energy Correlation (Line Chart Overlay Canvas)
  // =========================================================================
  useEffect(() => {
    const canvas = trendCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 360;
    const height = 210;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const padLeft = 35;
    const padRight = 20;
    const padTop = 25;
    const padBottom = 35;
    const chartWidth = width - padLeft - padRight;
    const chartHeight = height - padTop - padBottom;

    // Grid lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    for (let i = 0; i <= 5; i++) {
      const y = padTop + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(toPersianDigits(10 - i * 2), padLeft - 6, y + 3);
    }
    ctx.setLineDash([]);

    // Data points for selected range
    const scores = pastNDays.map((dStr, idx) => {
      const j = journals.find((item) => item.date_jalali === dStr);
      // Day label
      const parts = dStr.split('/');
      const monthDay = `${toPersianDigits(parts[1])}/${toPersianDigits(parts[2])}`;
      return {
        prod: j ? j.productivity_score : 5,
        energy: j ? j.energy_score : 6,
        dayLabel: monthDay,
        hasRecord: !!j,
      };
    });

    const stepX = chartWidth / (scores.length - 1 || 1);

    // Draw Productivity Line (Emerald)
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    scores.forEach((pt, i) => {
      const x = padLeft + i * stepX;
      const y = padTop + chartHeight - (pt.prod / 10) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Energy Line (Amber)
    ctx.beginPath();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    scores.forEach((pt, i) => {
      const x = padLeft + i * stepX;
      const y = padTop + chartHeight - (pt.energy / 10) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Dots and X-Axis Labels
    const labelStep = trendDaysRange === 30 ? 4 : trendDaysRange === 14 ? 2 : 1;
    scores.forEach((pt, i) => {
      const x = padLeft + i * stepX;
      const yProd = padTop + chartHeight - (pt.prod / 10) * chartHeight;
      const yEnergy = padTop + chartHeight - (pt.energy / 10) * chartHeight;

      // Prod Dot
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(x, yProd, pt.hasRecord ? 4.5 : 2.5, 0, 2 * Math.PI);
      ctx.fill();

      // Energy Dot
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(x, yEnergy, pt.hasRecord ? 4 : 2, 0, 2 * Math.PI);
      ctx.fill();

      // Label (sampled to avoid overcrowding)
      if (i % labelStep === 0 || i === scores.length - 1) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pt.dayLabel, x, height - 12);
      }
    });
  }, [journals, pastNDays, trendDaysRange, windowWidth]);

  // Overall calculations
  const totalPomodoroMinutes = pomodoroSessions.reduce((sum, s) => sum + (s.duration_minutes || 25), 0);
  const totalCompletedTasks = tasks.filter((t) => t.status === 'completed').length;
  const totalTasksCount = tasks.length;
  const taskCompletionRate = totalTasksCount > 0 ? Math.round((totalCompletedTasks / totalTasksCount) * 100) : 100;

  // Average energy & productivity across all journals
  const avgEnergy = journals.length > 0
    ? (journals.reduce((sum, j) => sum + j.energy_score, 0) / journals.length).toFixed(1)
    : '۷.۵';
  const avgProd = journals.length > 0
    ? (journals.reduce((sum, j) => sum + j.productivity_score, 0) / journals.length).toFixed(1)
    : '۸.۰';

  // 7-day consistency for habits
  const past7Days = getLastNDaysJalali(7);

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">آمار و تحلیل عملکرد هوشمند</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          نمودارهای تعاملی Canvas بدون وابستگی به اینترنت، با تفکیک دسته‌بندی‌ها و ویژگی‌ها
        </p>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 text-center">
          <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <span className="text-lg font-black text-white block">
            {toPersianDigits(totalPomodoroMinutes)}
          </span>
          <span className="text-[10px] text-slate-400">دقیقه تمرکز کل</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 text-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <span className="text-lg font-black text-white block">
            {toPersianDigits(totalCompletedTasks)} از {toPersianDigits(totalTasksCount)}
          </span>
          <span className="text-[10px] text-slate-400">وظایف انجام‌شده ({toPersianDigits(taskCompletionRate)}٪)</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 text-center">
          <Flame className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <span className="text-lg font-black text-white block">
            {toPersianDigits(habits.length)}
          </span>
          <span className="text-[10px] text-slate-400">عادت‌های فعال</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 text-center">
          <Zap className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
          <span className="text-lg font-black text-white block">
            {toPersianDigits(avgProd)} / ۱۰
          </span>
          <span className="text-[10px] text-slate-400">میانگین بهره‌وری</span>
        </div>
      </div>

      {/* NEW: Chart - Monthly Category Completion (Combined Habits & Tasks) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">انجام دسته‌بندی‌ها در طول ماه (مجموع عادات و وظایف)</h3>
                {isCurrentMonth && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ماه جاری
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                مقایسه عملکرد و درصد تکمیل کارها و عادات به تفکیک دسته‌بندی در {PERSIAN_MONTHS[selectedMonth - 1]} {toPersianDigits(selectedYear)}
              </p>
            </div>
          </div>

          {/* Month Selector & Controls */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {/* Month Navigation */}
            <div className="flex items-center bg-slate-800 border border-slate-700/60 rounded-xl p-1 text-xs">
              <button
                onClick={handlePrevMonth}
                title="ماه قبل"
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="bg-transparent text-slate-200 font-bold px-2 py-0.5 text-xs focus:outline-none cursor-pointer"
              >
                {PERSIAN_MONTHS.map((mName, idx) => (
                  <option key={idx} value={idx + 1} className="bg-slate-900 text-white">
                    {mName} {toPersianDigits(selectedYear)}
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextMonth}
                title="ماه بعد"
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {!isCurrentMonth && (
              <button
                onClick={handleResetToCurrentMonth}
                className="text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2.5 py-1.5 rounded-xl font-medium transition-all"
              >
                بازگشت به ماه جاری
              </button>
            )}
          </div>
        </div>

        {/* View Mode & Unit Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 p-2.5 rounded-2xl border border-slate-800/60 text-xs">
          {/* Filter Scope: Combined / Tasks / Habits */}
          <div className="flex items-center gap-1 bg-slate-800/90 rounded-xl p-1">
            <button
              onClick={() => setCategoryChartViewMode('combined')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                categoryChartViewMode === 'combined'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              مجموع (عادات + وظایف)
            </button>
            <button
              onClick={() => setCategoryChartViewMode('tasks')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                categoryChartViewMode === 'tasks'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              فقط وظایف
            </button>
            <button
              onClick={() => setCategoryChartViewMode('habits')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                categoryChartViewMode === 'habits'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              فقط عادات
            </button>
          </div>

          {/* Unit Toggle: Count vs Percent */}
          <div className="flex items-center gap-1 bg-slate-800/90 rounded-xl p-1 text-[11px]">
            <button
              onClick={() => setCategoryChartDisplayType('count')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                categoryChartDisplayType === 'count'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              تعداد (انجام‌شده / کل)
            </button>
            <button
              onClick={() => setCategoryChartDisplayType('percent')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                categoryChartDisplayType === 'percent'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              درصد تحقق (٪)
            </button>
          </div>
        </div>

        {/* 4 Monthly KPI Mini Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-right">
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-2.5">
            <span className="text-[10px] text-slate-400 block mb-0.5">کل اقدامات انجام‌شده</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-emerald-400 font-mono">
                {toPersianDigits(totalMonthCompleted)}
              </span>
              <span className="text-[10px] text-slate-500">اقدام</span>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-2.5">
            <span className="text-[10px] text-slate-400 block mb-0.5">کل هدف و برنامه‌ریزی ماه</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-slate-200 font-mono">
                {toPersianDigits(totalMonthTarget)}
              </span>
              <span className="text-[10px] text-slate-500">مورد</span>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-2.5">
            <span className="text-[10px] text-slate-400 block mb-0.5">میانگین پایبندی کل ماه</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-blue-400 font-mono">
                {toPersianDigits(overallMonthRate)}٪
              </span>
              <span className="text-[10px] text-slate-500">تکمیل</span>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-2.5">
            <span className="text-[10px] text-slate-400 block mb-0.5">موفق‌ترین دسته ماه</span>
            <div className="flex items-center gap-1.5 truncate">
              {topCategory ? (
                <>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: topCategory.category.color || '#3b82f6' }}
                  />
                  <span className="text-xs font-bold text-white truncate">
                    {topCategory.category.title} ({toPersianDigits(topCategory.combinedRate)}٪)
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-500">بدون فعالیت</span>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Category Breakdown Cards */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
            <span className="font-bold text-slate-300">جزئیات تفکیکی دسته‌بندی‌ها در این ماه:</span>
            <span>{toPersianDigits(monthlyCategoryStats.length)} دسته‌بندی</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {monthlyCategoryStats.map((item) => {
              const catColor = item.category.color || '#3b82f6';
              return (
                <div
                  key={item.category.id}
                  className="bg-slate-950/60 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-3 space-y-2.5 transition-all"
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: catColor }}
                      />
                      <span className="text-xs font-bold text-white">{item.category.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          item.combinedRate >= 80
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : item.combinedRate >= 50
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : item.combinedTotal > 0
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-slate-800/40 text-slate-500'
                        }`}
                      >
                        {toPersianDigits(item.combinedRate)}٪ تکمیل
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, item.combinedRate)}%`,
                        backgroundColor: catColor,
                      }}
                    />
                  </div>

                  {/* Tasks & Habits Sub-stats */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                    <div className="bg-slate-900/90 rounded-xl px-2.5 py-1.5 border border-slate-800/60">
                      <div className="flex items-center gap-1 text-slate-400 mb-0.5">
                        <CheckSquare className="w-3 h-3 text-emerald-400" />
                        <span>وظایف:</span>
                      </div>
                      <span className="font-mono text-slate-200 font-bold">
                        {toPersianDigits(item.tasksCompleted)} از {toPersianDigits(item.tasksTotal)}
                      </span>
                      <span className="text-[10px] text-slate-500 mr-1">
                        ({toPersianDigits(item.tasksRate)}٪)
                      </span>
                    </div>

                    <div className="bg-slate-900/90 rounded-xl px-2.5 py-1.5 border border-slate-800/60">
                      <div className="flex items-center gap-1 text-slate-400 mb-0.5">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span>عادات:</span>
                      </div>
                      <span className="font-mono text-slate-200 font-bold">
                        {toPersianDigits(item.habitsDoneCount)} از {toPersianDigits(item.habitsExpectedCount)}
                      </span>
                      <span className="text-[10px] text-slate-500 mr-1">
                        ({toPersianDigits(item.habitsRate)}٪)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart 1: Productivity vs Energy Correlation Line Chart */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">همبستگی بهره‌وری و انرژی روزانه</h3>
              <p className="text-[11px] text-slate-400">بررسی اثر سطح انرژی بر خروجی و کارایی روزانه</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Range Toggle */}
            <div className="flex items-center bg-slate-800 rounded-xl p-1 text-xs">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setTrendDaysRange(d as any)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    trendDaysRange === d
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {toPersianDigits(d)} روز
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-3 h-1.5 rounded-full bg-emerald-500 inline-block" />
                بهره‌وری
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <span className="w-3 h-1.5 rounded-full bg-amber-500 inline-block" />
                انرژی
              </span>
            </div>
          </div>
        </div>

        <div className="w-full">
          <canvas ref={trendCanvasRef} className="w-full h-[210px]" />
        </div>
      </div>

      {/* Chart 2: Solar Hijri Monthly Consistency Matrix & 4-Week Block System */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>ماتریس پایبندی تقویم شمسی ({PERSIAN_MONTHS[selectedMonth - 1]} {toPersianDigits(selectedYear)})</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  ۴ بلوک هفتگی منظم
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                تقسیم‌بندی ۴ بلوک استاندارد شمسی: روزهای ۱-۷، ۸-۱۴، ۱۵-۲۱ و ۲۲ تا پایان ماه (کلیک روی هر روز برای بررسی جامع)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick month navigation inside matrix */}
            <div className="flex items-center bg-slate-800 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-750"
                title="ماه قبل"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-bold text-slate-300 text-[11px]">
                {PERSIAN_MONTHS[selectedMonth - 1]}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-750"
                title="ماه بعد"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 mr-1">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block shadow-sm" />
                انجام شده
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-slate-800 border border-slate-750 inline-block" />
                ثبت‌نشده
              </span>
            </div>
          </div>
        </div>

        {/* 4 Distinct Solar Hijri Week Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { id: 1, label: 'هفته اول', range: 'روزهای ۱ تا ۷', startDay: 1, endDay: 7 },
            { id: 2, label: 'هفته دوم', range: 'روزهای ۸ تا ۱۴', startDay: 8, endDay: 14 },
            { id: 3, label: 'هفته سوم', range: 'روزهای ۱۵ تا ۲۱', startDay: 15, endDay: 21 },
            { id: 4, label: 'هفته چهارم', range: `روزهای ۲۲ تا ${toPersianDigits(daysInMonth)}`, startDay: 22, endDay: daysInMonth },
          ].map((block) => {
            const blockDays = Array.from(
              { length: block.endDay - block.startDay + 1 },
              (_, idx) => block.startDay + idx
            );

            // Compute block habit completion rate
            let blockHabitChecks = 0;
            let blockPossibleChecks = 0;

            blockDays.forEach((dayNum) => {
              const dStr = `${selectedYear}/${String(selectedMonth).padStart(2, '0')}/${String(dayNum).padStart(2, '0')}`;
              habits.forEach((h) => {
                blockPossibleChecks++;
                const isDone = habitLogs.some(
                  (l) => l.habit_id === h.id && l.completed_date_jalali === dStr && l.status === 'done'
                );
                if (isDone) blockHabitChecks++;
              });
            });

            const blockPercent =
              blockPossibleChecks > 0 ? Math.round((blockHabitChecks / blockPossibleChecks) * 100) : 0;

            return (
              <div
                key={block.id}
                className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{block.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{block.range}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                      blockPercent >= 80
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : blockPercent >= 40
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {toPersianDigits(blockPercent)}٪
                  </span>
                </div>

                {/* Day Buttons inside Week Block */}
                <div className="grid grid-cols-7 gap-1">
                  {blockDays.map((dayNum) => {
                    const dStr = `${selectedYear}/${String(selectedMonth).padStart(2, '0')}/${String(dayNum).padStart(2, '0')}`;
                    const isTodayCell = isCurrentMonth && dayNum === currentDay;
                    const isFuture = isCurrentMonth && dayNum > currentDay;

                    // Day stats
                    const dayHabitsDone = habitLogs.filter(
                      (l) => l.completed_date_jalali === dStr && l.status === 'done'
                    ).length;
                    const dayTasksDone = tasks.filter(
                      (t) => t.status === 'completed' && t.due_date === dStr
                    ).length;
                    const dayTrades = trades.filter((tr) => tr.date_jalali === dStr);
                    const dayJournal = journals.find((j) => j.date_jalali === dStr);

                    return (
                      <button
                        key={dayNum}
                        type="button"
                        onClick={() => setInspectedDate(dStr)}
                        className={`p-1 rounded-xl flex flex-col items-center justify-center transition-all relative group ${
                          isTodayCell
                            ? 'bg-amber-500/20 border border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/20'
                            : dayHabitsDone > 0 || dayTasksDone > 0
                            ? 'bg-slate-850 hover:bg-slate-800 border border-slate-750 text-white'
                            : 'bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400'
                        }`}
                        title={`روز ${toPersianDigits(dayNum)}: کلیک برای بررسی جزئیات روز`}
                      >
                        <span className="text-[11px] font-mono leading-none">{toPersianDigits(dayNum)}</span>
                        <div className="flex items-center gap-0.5 mt-1">
                          {dayHabitsDone > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          )}
                          {dayTasksDone > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          )}
                          {dayTrades.length > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Heatmap Grid across All Habits */}
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <table className="w-full text-right border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="py-2 px-3 font-semibold sticky right-0 bg-slate-900 z-10 min-w-[130px]">
                  عنوان عادت
                </th>
                {Array.from({ length: daysInMonth }, (_, idx) => {
                  const dayNum = idx + 1;
                  const dStr = `${selectedYear}/${String(selectedMonth).padStart(2, '0')}/${String(dayNum).padStart(2, '0')}`;
                  const isTodayCol = isCurrentMonth && dayNum === currentDay;
                  return (
                    <th
                      key={dayNum}
                      onClick={() => setInspectedDate(dStr)}
                      className={`py-1.5 px-1 text-center font-mono text-[10px] min-w-[24px] cursor-pointer hover:bg-slate-800/80 rounded transition-colors ${
                        isTodayCol ? 'bg-amber-500/10 text-amber-300 rounded-t' : 'text-slate-400'
                      }`}
                      title={`کلیک برای بررسی وقایع روز ${toPersianDigits(dayNum)}`}
                    >
                      <span>{toPersianDigits(dayNum)}</span>
                    </th>
                  );
                })}
                <th className="py-2 px-3 text-center font-semibold min-w-[70px]">پایبندی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {habits.map((habit) => {
                const logs = habitLogs.filter((l) => l.habit_id === habit.id && l.status === 'done');
                const logSet = new Set(logs.map((l) => l.completed_date_jalali));

                let completedInMonth = 0;
                for (let d = 1; d <= daysInMonth; d++) {
                  const dStr = `${selectedYear}/${String(selectedMonth).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
                  if (logSet.has(dStr)) completedInMonth++;
                }

                const elapsedDays = isCurrentMonth ? Math.max(1, currentDay) : daysInMonth;
                const rate = Math.min(100, Math.round((completedInMonth / elapsedDays) * 100));

                return (
                  <tr key={habit.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 sticky right-0 bg-slate-900/95 z-10">
                      <div className="flex items-center gap-2">
                        <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]" title={habit.title}>
                          {habit.title}
                        </span>
                      </div>
                    </td>

                    {Array.from({ length: daysInMonth }, (_, idx) => {
                      const dayNum = idx + 1;
                      const dStr = `${selectedYear}/${String(selectedMonth).padStart(2, '0')}/${String(dayNum).padStart(2, '0')}`;
                      const isDone = logSet.has(dStr);
                      const isTodayCol = isCurrentMonth && dayNum === currentDay;
                      const isFuture = isCurrentMonth && dayNum > currentDay;

                      return (
                        <td
                          key={dayNum}
                          onClick={() => setInspectedDate(dStr)}
                          className={`py-1.5 px-0.5 text-center cursor-pointer hover:bg-slate-800/50 ${
                            isTodayCol ? 'bg-amber-500/5' : ''
                          }`}
                        >
                          <div
                            className={`w-5 h-5 mx-auto rounded-md flex items-center justify-center transition-all text-[10px] ${
                              isDone
                                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/20'
                                : isFuture
                                ? 'bg-slate-900/50 border border-slate-850 text-slate-700'
                                : 'bg-slate-800/80 border border-slate-750 text-slate-600'
                            }`}
                            title={`${habit.title} در روز ${toPersianDigits(dayNum)} ${PERSIAN_MONTHS[selectedMonth - 1]}: ${
                              isDone ? 'انجام شد' : isFuture ? 'آینده' : 'ثبت نشده'
                            } (کلیک برای بررسی روز)`}
                          >
                            {isDone ? '✓' : ''}
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-2 px-3 text-center">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          rate >= 80
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : rate >= 50
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {toPersianDigits(rate)}٪
                      </span>
                    </td>
                  </tr>
                );
              })}

              {habits.length === 0 && (
                <tr>
                  <td colSpan={daysInMonth + 2} className="text-center py-6 text-slate-500 text-xs">
                    هنوز عادتی تعریف نشده است. به تب عادات بروید و عادات خود را بسازید!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Day Inspection Modal */}
      {inspectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setInspectedDate(null)}
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-750 rounded-3xl p-5 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>بررسی وقایع و عملکرد روزانه</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                      {formatJalaliReadable(inspectedDate)}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {toPersianDigits(inspectedDate)} • {getPersianDayOfWeekFromJalali(inspectedDate)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedDate(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto space-y-4 py-3 flex-1 pr-1 pl-1">
              {/* Day KPIs Bar */}
              {(() => {
                const dayHabitsDone = habitLogs.filter(
                  (l) => l.completed_date_jalali === inspectedDate && l.status === 'done'
                );
                const dayTasksDone = tasks.filter(
                  (t) => t.status === 'completed' && t.due_date === inspectedDate
                );
                const dayTrades = trades.filter((tr) => tr.date_jalali === inspectedDate);
                const dayPomos = pomodoroSessions.filter((s) =>
                  s.completed_at_jalali.startsWith(inspectedDate)
                );
                const dayPomoMinutes = dayPomos.reduce((acc, s) => acc + s.duration_minutes, 0);
                const dayJournal = journals.find((j) => j.date_jalali === inspectedDate);

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                        <span className="text-[10px] text-amber-300 block">عادات انجام‌شده</span>
                        <span className="text-base font-bold font-mono text-amber-400">
                          {toPersianDigits(dayHabitsDone.length)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                        <span className="text-[10px] text-emerald-300 block">وظایف تکمیل‌شده</span>
                        <span className="text-base font-bold font-mono text-emerald-400">
                          {toPersianDigits(dayTasksDone.length)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
                        <span className="text-[10px] text-purple-300 block">دقایق تمرکز</span>
                        <span className="text-base font-bold font-mono text-purple-400">
                          {toPersianDigits(dayPomoMinutes)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
                        <span className="text-[10px] text-blue-300 block">معاملات ترید</span>
                        <span className="text-base font-bold font-mono text-blue-400">
                          {toPersianDigits(dayTrades.length)}
                        </span>
                      </div>
                    </div>

                    {/* Section 1: Habits Done */}
                    <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Flame className="w-4 h-4" />
                        عادات تکمیل‌شده ({toPersianDigits(dayHabitsDone.length)} مورد):
                      </span>
                      {dayHabitsDone.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">عادتی برای این روز ثبت نشده است.</p>
                      ) : (
                        <div className="space-y-1">
                          {dayHabitsDone.map((log) => {
                            const h = habits.find((item) => item.id === log.habit_id);
                            return (
                              <div
                                key={log.id}
                                className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                              >
                                <span className="font-medium text-slate-200">{h?.title || 'عادت'}</span>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                                  تکمیل شد ✓
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Section 2: Tasks Completed */}
                    <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4" />
                        وظایف اختصاص داده شده ({toPersianDigits(dayTasksDone.length)} مورد):
                      </span>
                      {dayTasksDone.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">وظیفه‌ای برای این تاریخ تکمیل نشده است.</p>
                      ) : (
                        <div className="space-y-1">
                          {dayTasksDone.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                            >
                              <span className="font-medium text-slate-200">{task.title}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                اولویت: {task.priority === 'high' ? 'بالا' : task.priority === 'medium' ? 'متوسط' : 'پایین'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Section 3: Trades */}
                    {dayTrades.length > 0 && (
                      <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
                        <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4" />
                          معاملات ثبت‌شده ({toPersianDigits(dayTrades.length)} معامله):
                        </span>
                        <div className="space-y-1">
                          {dayTrades.map((tr) => (
                            <div
                              key={tr.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-white">{tr.symbol}</span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                    tr.direction === 'long'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {tr.direction}
                                </span>
                              </div>
                              <span
                                className={`font-mono font-bold ${
                                  tr.outcome === 'win'
                                    ? 'text-emerald-400'
                                    : tr.outcome === 'loss'
                                    ? 'text-rose-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {tr.net_pnl > 0 ? `+${tr.net_pnl}$` : `${tr.net_pnl}$`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section 4: Daily Journal Note */}
                    <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4" />
                          یادداشت روزانه و سطح انرژی:
                        </span>
                        {dayJournal && (
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono font-bold">
                            انرژی: {toPersianDigits(dayJournal.energy_score)}/۱۰
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        {dayJournal?.content || 'هیچ یادداشت روزانه‌ای برای این روز ثبت نشده است.'}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setInspectedDate(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
