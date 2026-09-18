import React, { useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Circle,
  Flame,
  Clock,
  Zap,
  ArrowLeft,
  Plus,
  Play,
  PenLine,
  Target,
} from 'lucide-react';
import { Task, Habit, HabitLog, DailyJournal, Category, ActiveTab } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { soundFx } from '../utils/audio';

interface DashboardViewProps {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  todayJournal: DailyJournal | null;
  pomodoroMinutesToday: number;
  categories: Category[];
  onToggleTask: (taskId: number) => void;
  onToggleHabit: (habitId: number) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tasks,
  habits,
  habitLogs,
  todayJournal,
  pomodoroMinutesToday,
  categories,
  onToggleTask,
  onToggleHabit,
  onNavigateTab,
}) => {
  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // Calculate habit streak: total completed habit logs today vs total habits
  const completedHabitsTodayCount = habits.filter((h) =>
    habitLogs.some((l) => l.habit_id === h.id && l.status === 'done')
  ).length;

  const gaugeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const energy = todayJournal?.energy_score ?? 7;
  const productivity = todayJournal?.productivity_score ?? 8;
  const averageScore = Math.round(((energy + productivity) / 2) * 10); // in percent 0-100%

  // Draw smooth HTML5 Canvas gauge
  useEffect(() => {
    const canvas = gaugeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 160;
    const height = 100;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height - 12;
    const radius = 62;
    const lineWidth = 12;

    // Background Arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 0, false);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Foreground Gradient Arc
    const gradient = ctx.createLinearGradient(0, centerY, width, centerY);
    gradient.addColorStop(0, '#06b6d4'); // cyan
    gradient.addColorStop(0.5, '#3b82f6'); // blue
    gradient.addColorStop(1, '#10b981'); // emerald

    const endAngle = Math.PI + (Math.PI * Math.min(Math.max(averageScore, 0), 100)) / 100;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, endAngle, false);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center indicator text
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${toPersianDigits(averageScore)}٪`, centerX, centerY - 8);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('شاخص عملکرد', centerX, centerY + 8);
  }, [averageScore]);

  const getCategory = (catId: number) => categories.find((c) => c.id === catId);

  return (
    <div className="space-y-5 pb-24">
      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Pending Tasks */}
        <div
          onClick={() => onNavigateTab('tasks')}
          className="cursor-pointer bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-4 transition-all hover:border-blue-500/40 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">کارهای باقیمانده</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white">{toPersianDigits(pendingTasks.length)}</span>
            <span className="text-xs text-slate-500">مورد از {toPersianDigits(tasks.length)}</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{
                width: `${tasks.length ? (completedTasks.length / tasks.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* KPI 2: Active Habits Streak */}
        <div
          onClick={() => onNavigateTab('habits')}
          className="cursor-pointer bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-4 transition-all hover:border-amber-500/40 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">عادات روزانه</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-300">
              {toPersianDigits(completedHabitsTodayCount)}
            </span>
            <span className="text-xs text-slate-500">از {toPersianDigits(habits.length)} تکمیل</span>
          </div>
          <div className="flex items-center gap-1 mt-3">
            <span className="text-xs text-amber-400 font-medium">
              {habits.length > 0 && completedHabitsTodayCount === habits.length
                ? '🔥 تمام عادات امروز پاس شد!'
                : `${toPersianDigits(habits.length - completedHabitsTodayCount)} عادت باقیمانده`}
            </span>
          </div>
        </div>

        {/* KPI 3: Pomodoro Focus Time Today */}
        <div
          onClick={() => onNavigateTab('pomodoro')}
          className="cursor-pointer bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-4 transition-all hover:border-emerald-500/40 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">تمرکز پومودورو امروز</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-300">
              {toPersianDigits(pomodoroMinutesToday)}
            </span>
            <span className="text-xs text-slate-500">دقیقه تمرکز عمیق</span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400">
            <Play className="w-3 h-3 text-emerald-400" />
            <span>شروع جلسه تمرکز جدید</span>
          </div>
        </div>

        {/* KPI 4: Energy / Productivity Gauge */}
        <div
          onClick={() => onNavigateTab('journal')}
          className="cursor-pointer bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-4 transition-all hover:border-indigo-500/40 shadow-sm relative overflow-hidden flex flex-col items-center justify-between"
        >
          <div className="w-full flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">سطح انرژی و کارایی</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="w-full flex justify-center -my-2">
            <canvas ref={gaugeCanvasRef} className="w-[140px] h-[85px]" />
          </div>
          <div className="w-full flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>انرژی: {toPersianDigits(energy)}/۱۰</span>
            <span>بهره‌وری: {toPersianDigits(productivity)}/۱۰</span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's Tasks Checklist */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-5 bg-blue-500 rounded-full" />
              <h2 className="text-base font-bold text-white">وظایف امروز</h2>
              <span className="text-xs bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded-full">
                {toPersianDigits(pendingTasks.length)} باقیمانده
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('tasks')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
            >
              <span>همه وظایف</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {tasks.slice(0, 5).map((task) => {
              const category = getCategory(task.category_id);
              const isDone = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isDone
                      ? 'bg-slate-950/40 border-slate-800/50 text-slate-500'
                      : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-slate-200'
                  }`}
                >
                  <button
                    onClick={() => {
                      if (task.id) {
                        soundFx.playCheckmark();
                        onToggleTask(task.id);
                      }
                    }}
                    className="flex items-center gap-3 text-right flex-1 min-w-0"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 shrink-0 hover:text-blue-400" />
                    )}
                    <span className={`text-sm truncate ${isDone ? 'line-through' : 'font-medium'}`}>
                      {task.title}
                    </span>
                  </button>

                  <div className="flex items-center gap-2 shrink-0 mr-2">
                    {category && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                        style={{
                          backgroundColor: `${category.color}20`,
                          color: category.color,
                        }}
                      >
                        {category.title}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {tasks.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                هیچ وظیفه‌ای ثبت نشده است.
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('tasks')}
            className="w-full mt-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            <span>افزودن کار جدید</span>
          </button>
        </div>

        {/* Today's Habits Tracker */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-5 bg-amber-500 rounded-full" />
              <h2 className="text-base font-bold text-white">عادات روزانه</h2>
              <span className="text-xs bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full">
                {toPersianDigits(completedHabitsTodayCount)} از {toPersianDigits(habits.length)}
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('habits')}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
            >
              <span>مدیریت عادات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {habits.slice(0, 5).map((habit) => {
              const isCompleted = habitLogs.some(
                (l) => l.habit_id === habit.id && l.status === 'done'
              );

              return (
                <div
                  key={habit.id}
                  onClick={() => {
                    if (habit.id) {
                      soundFx.playCheckmark();
                      onToggleHabit(habit.id);
                    }
                  }}
                  className={`cursor-pointer flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isCompleted
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        isCompleted
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                          : 'bg-slate-700/50 text-slate-400'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Flame className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-medium">{habit.title}</span>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-xl font-medium transition-all ${
                      isCompleted
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-700/40 text-slate-400'
                    }`}
                  >
                    {isCompleted ? 'انجام شد' : 'ثبت انجام'}
                  </span>
                </div>
              );
            })}

            {habits.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                هنوز عادتی ثبت نکرده‌اید.
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('habits')}
            className="w-full mt-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>افزودن عادت جدید</span>
          </button>
        </div>
      </div>

      {/* Quick Access to Journal & Pomodoro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={() => onNavigateTab('pomodoro')}
          className="cursor-pointer bg-gradient-to-l from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 hover:border-emerald-500/60 p-4 rounded-3xl flex items-center justify-between transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">تایمر تمرکز پومودورو</h3>
              <p className="text-xs text-slate-400 mt-0.5">جلسه ۲۵ دقیقه‌ای تمرکز عمیق بدون حواس‌پرتی</p>
            </div>
          </div>
          <ArrowLeft className="w-5 h-5 text-emerald-400 transform group-hover:-translate-x-1 transition-transform" />
        </div>

        <div
          onClick={() => onNavigateTab('journal')}
          className="cursor-pointer bg-gradient-to-l from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 hover:border-indigo-500/60 p-4 rounded-3xl flex items-center justify-between transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PenLine className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">ژورنال و یادداشت‌های روزانه</h3>
              <p className="text-xs text-slate-400 mt-0.5">ثبت احوالات، امتیاز انرژی و ایده‌های امروز</p>
            </div>
          </div>
          <ArrowLeft className="w-5 h-5 text-indigo-400 transform group-hover:-translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
};
