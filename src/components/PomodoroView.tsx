import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  CheckCircle,
  Circle,
  Briefcase,
  Coffee,
  Sparkles,
  Clock,
  Plus,
  Trash2,
  Calendar,
  X,
  Target,
  Flame,
  CheckSquare,
  Zap,
} from 'lucide-react';
import { Task, Habit, PomodoroSession, Category, TaskPriority } from '../types';
import { toPersianDigits, getTodayJalaliWithTime, getTodayJalali, getLastNDaysJalali, formatJalaliReadable } from '../utils/jalali';
import { soundFx } from '../utils/audio';
import { notificationSystem } from '../utils/notifications';

interface PomodoroViewProps {
  tasks: Task[];
  habits?: Habit[];
  categories: Category[];
  selectedTaskId: number | null;
  selectedHabitId?: number | null;
  targetType?: 'task' | 'habit';
  onSelectTask: (taskId: number | null) => void;
  onSelectHabit?: (habitId: number | null) => void;
  onChangeTargetType?: (type: 'task' | 'habit') => void;
  onSessionCompleted: (session: Omit<PomodoroSession, 'id'>) => Promise<void>;
  recentSessions: PomodoroSession[];
  allSessions?: PomodoroSession[];
  onAddTask: (task: Omit<Task, 'id'>, attributeIds: number[]) => Promise<void>;
  onDeleteTask: (taskId: number) => Promise<void>;
  onToggleTask: (taskId: number) => void;
}

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

const MODE_DURATIONS: Record<TimerMode, number> = {
  work: 25 * 60, // 25 minutes
  shortBreak: 5 * 60, // 5 minutes
  longBreak: 15 * 60, // 15 minutes
};

export const PomodoroView: React.FC<PomodoroViewProps> = ({
  tasks = [],
  habits = [],
  categories = [],
  selectedTaskId,
  selectedHabitId = null,
  targetType = 'task',
  onSelectTask,
  onSelectHabit,
  onChangeTargetType,
  onSessionCompleted,
  recentSessions = [],
  allSessions = [],
  onAddTask,
  onDeleteTask,
  onToggleTask,
}) => {
  const [activeTargetTab, setActiveTargetTab] = useState<'task' | 'habit'>(targetType || 'task');

  useEffect(() => {
    if (targetType) {
      setActiveTargetTab(targetType);
    }
  }, [targetType]);

  const handleSwitchTargetTab = (tab: 'task' | 'habit') => {
    setActiveTargetTab(tab);
    if (onChangeTargetType) {
      onChangeTargetType(tab);
    }
  };
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState<number>(MODE_DURATIONS.work);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedSessionsCount, setCompletedSessionsCount] = useState<number>(0);

  // Quick-add task inside Pomodoro
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);
  const [quickTitle, setQuickTitle] = useState<string>('');
  const [quickPriority, setQuickPriority] = useState<TaskPriority>('medium');
  const [quickCategoryId, setQuickCategoryId] = useState<number>(categories[0]?.id || 1);

  // History filters
  const [historyDateFilter, setHistoryDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [historyTargetFilter, setHistoryTargetFilter] = useState<string>('all');
  const [historyPage, setHistoryPage] = useState<number>(1);
  const PAGE_SIZE = 8;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetEndTimeRef = useRef<number | null>(null);

  // Switch mode
  const switchMode = (newMode: TimerMode) => {
    setIsRunning(false);
    targetEndTimeRef.current = null;
    setMode(newMode);
    setTimeLeft(MODE_DURATIONS[newMode]);
  };

  // Toggle play/pause with timestamp delta anchoring
  const togglePlayPause = () => {
    if (!isRunning) {
      targetEndTimeRef.current = Date.now() + timeLeft * 1000;
      setIsRunning(true);
    } else {
      if (targetEndTimeRef.current) {
        const remaining = Math.max(0, Math.round((targetEndTimeRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);
      }
      targetEndTimeRef.current = null;
      setIsRunning(false);
    }
  };

  // Continuous background-accurate timer tick using timestamp delta comparison
  useEffect(() => {
    if (!isRunning) {
      targetEndTimeRef.current = null;
      return;
    }

    if (!targetEndTimeRef.current) {
      targetEndTimeRef.current = Date.now() + timeLeft * 1000;
    }

    const checkTimer = () => {
      if (!targetEndTimeRef.current) return;
      const remaining = Math.max(0, Math.round((targetEndTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setIsRunning(false);
        targetEndTimeRef.current = null;

        // Trigger loud audio alarm chime
        soundFx.playAlarm();

        const currentTargetTitle =
          activeTargetTab === 'task'
            ? tasks.find((t) => t.id === selectedTaskId)?.title
            : habits?.find((h) => h.id === selectedHabitId)?.title;

        // Native system notification & hardware vibration
        notificationSystem.triggerAlert({
          title: mode === 'work' ? 'پایان زمان تمرکز پومودورو! 🔔' : 'پایان زمان استراحت! 🔔',
          body:
            mode === 'work'
              ? currentTargetTitle
                ? `جلسه تمرکز روی «${currentTargetTitle}» به پایان رسید. وقت استراحت است!`
                : 'جلسه تمرکز ۲۵ دقیقه‌ای پومودورو به پایان رسید. وقت استراحت است!'
              : 'زمان استراحت به پایان رسید. آماده جلسه تمرکز بعدی باشید!',
          sound: 'alarm',
        });

        if (mode === 'work') {
          setCompletedSessionsCount((prev) => prev + 1);
          // Log to IndexedDB
          onSessionCompleted({
            task_id: activeTargetTab === 'task' ? selectedTaskId : null,
            habit_id: activeTargetTab === 'habit' ? selectedHabitId : null,
            target_type: activeTargetTab,
            duration_minutes: 25,
            completed_at_jalali: getTodayJalaliWithTime(),
          });
          // Auto-switch to short or long break
          const nextBreak = (completedSessionsCount + 1) % 4 === 0 ? 'longBreak' : 'shortBreak';
          setMode(nextBreak);
          setTimeLeft(MODE_DURATIONS[nextBreak]);
        } else {
          // Break finished
          setMode('work');
          setTimeLeft(MODE_DURATIONS.work);
        }
      }
    };

    // Run tick check frequently (300ms) for smooth second updates
    const interval = setInterval(checkTimer, 300);

    // Re-synchronize immediately when the tab or window becomes visible/focused
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTimer();
      }
    };
    const handleWindowFocus = () => {
      checkTimer();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [
    isRunning,
    mode,
    selectedTaskId,
    selectedHabitId,
    activeTargetTab,
    completedSessionsCount,
    onSessionCompleted,
    tasks,
    habits,
  ]);

  // Reset timer
  const handleReset = () => {
    setIsRunning(false);
    targetEndTimeRef.current = null;
    setTimeLeft(MODE_DURATIONS[mode]);
  };

  // Skip
  const handleSkip = () => {
    setIsRunning(false);
    targetEndTimeRef.current = null;
    if (mode === 'work') {
      switchMode('shortBreak');
    } else {
      switchMode('work');
    }
  };

  // Draw circular timer on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 260;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, size, size);

    const center = size / 2;
    const radius = 105;
    const lineWidth = 14;
    const totalDuration = MODE_DURATIONS[mode];
    const progress = 1 - timeLeft / totalDuration;

    // Background track
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#1e293b'; // slate-800
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Progress Arc
    let strokeColor = '#3b82f6';
    if (activeTargetTab === 'habit') strokeColor = '#f59e0b';
    if (mode === 'shortBreak') strokeColor = '#10b981';
    if (mode === 'longBreak') strokeColor = '#8b5cf6';

    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + 2 * Math.PI * progress;

    ctx.beginPath();
    ctx.arc(center, center, radius, startAngle, endAngle);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  }, [timeLeft, mode, activeTargetTab]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const currentTask = tasks.find((t) => t.id === selectedTaskId);
  const currentHabit = habits.find((h) => h.id === selectedHabitId);

  // Handle Quick Add Task for this week
  const handleCreateQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    await onAddTask(
      {
        title: quickTitle.trim(),
        category_id: quickCategoryId || categories[0]?.id || 1,
        priority: quickPriority,
        due_date: getTodayJalali(),
        status: 'pending',
        created_at: getTodayJalaliWithTime(),
      },
      []
    );

    setQuickTitle('');
    setIsAddingTask(false);
  };

  const getPriorityLabel = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return { label: 'فوری', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' };
      case 'high':
        return { label: 'بالا', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
      case 'medium':
        return { label: 'متوسط', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' };
      case 'low':
        return { label: 'پایین', color: 'text-slate-400 border-slate-600/30 bg-slate-700/20' };
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-white tracking-tight">تایمر تمرکز عمیق (پومودورو)</h2>
        <p className="text-xs text-slate-400 mt-1">
          جلسات تمرکز ۲۵ دقیقه‌ای برای دستیابی به جریان کاری (Flow State)
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-center gap-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl">
        <button
          onClick={() => switchMode('work')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            mode === 'work'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>تمرکز (۲۵ دقیقه)</span>
        </button>

        <button
          onClick={() => switchMode('shortBreak')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            mode === 'shortBreak'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Coffee className="w-3.5 h-3.5" />
          <span>استراحت کوتاه (۵ دقیقه)</span>
        </button>

        <button
          onClick={() => switchMode('longBreak')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            mode === 'longBreak'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>استراحت بلند (۱۵ دقیقه)</span>
        </button>
      </div>

      {/* Circular Canvas Timer */}
      <div className="relative flex items-center justify-center my-2">
        <canvas ref={canvasRef} className="w-[260px] h-[260px]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-5xl font-black text-white font-mono tracking-tight">
            {toPersianDigits(timeFormatted)}
          </span>
          <span
            className={`text-xs mt-2 font-medium px-3 py-1 rounded-full border max-w-[220px] truncate ${
              mode === 'work'
                ? activeTargetTab === 'habit' && currentHabit
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : currentTask
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  : 'bg-slate-700/40 text-slate-300 border-slate-600'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}
          >
            {mode === 'work'
              ? activeTargetTab === 'habit'
                ? currentHabit
                  ? `عادت: ${currentHabit.title}`
                  : 'جلسه تمرکز آزاد (عادت)'
                : currentTask
                ? `وظیفه: ${currentTask.title}`
                : 'جلسه تمرکز عمومی'
              : 'زمان تنفس و استراحت'}
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleReset}
          className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700"
          title="تنظیم مجدد زمان"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={togglePlayPause}
          id="toggle-pomodoro-btn"
          className={`px-8 py-3.5 rounded-2xl text-white font-bold text-sm shadow-xl flex items-center gap-2 transition-all transform active:scale-95 ${
            isRunning
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              : mode === 'work'
              ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
              : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-5 h-5" />
              <span>توقف موقت</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-white" />
              <span>شروع تمرکز</span>
            </>
          )}
        </button>

        <button
          onClick={handleSkip}
          className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700"
          title="رد کردن این مرحله"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Focus Target Selector: Tasks vs Habits with Tab Switch */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-white">انتخاب هدف تمرکز جلسه</h3>
              <p className="text-[11px] text-slate-400">یک وظیفه یا یک عادت را برای هدایت انرژی خود متصل کنید</p>
            </div>
          </div>

          {/* Toggle Tab: Tasks vs Habits */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-2xl border border-slate-700/80 self-start sm:self-auto">
            <button
              type="button"
              id="pomodoro-target-task-tab"
              onClick={() => handleSwitchTargetTab('task')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTargetTab === 'task'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>وظایف ({toPersianDigits(tasks.filter((t) => t.status === 'pending').length)})</span>
            </button>
            <button
              type="button"
              id="pomodoro-target-habit-tab"
              onClick={() => handleSwitchTargetTab('habit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTargetTab === 'habit'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>عادات ({toPersianDigits(habits.length)})</span>
            </button>
          </div>
        </div>

        {/* TAB 1: TASKS LIST */}
        {activeTargetTab === 'task' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                روی هر وظیفه کلیک کنید تا به هدف تمرکز تبدیل شود؛ با پایان پومودورو می‌توانید آن را تکمیل نمایید.
              </span>
              <button
                type="button"
                onClick={() => setIsAddingTask(!isAddingTask)}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-medium flex items-center gap-1 transition-all shrink-0 mr-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن وظیفه</span>
              </button>
            </div>

        {/* Inline Add Task Form */}
        {isAddingTask && (
          <form
            onSubmit={handleCreateQuickTask}
            className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3 animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">افزودن وظیفه جدید به این هفته</span>
              <button
                type="button"
                onClick={() => setIsAddingTask(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              required
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="عنوان وظیفه (مثلاً: آماده‌سازی گزارش هفتگی...)"
              className="w-full bg-slate-900 border border-slate-750 text-slate-150 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={quickPriority}
                onChange={(e) => setQuickPriority(e.target.value as TaskPriority)}
                className="bg-slate-900 border border-slate-750 text-slate-300 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="urgent">فوری و اضطراری</option>
                <option value="high">اولویت بالا</option>
                <option value="medium">اولویت متوسط</option>
                <option value="low">اولویت پایین</option>
              </select>

              <select
                value={quickCategoryId}
                onChange={(e) => setQuickCategoryId(Number(e.target.value))}
                className="bg-slate-900 border border-slate-750 text-slate-300 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingTask(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-750 text-slate-400 text-xs"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                افزودن به لیست
              </button>
            </div>
          </form>
        )}

        {/* Free Focus Choice */}
        <div
          onClick={() => onSelectTask(null)}
          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            selectedTaskId === null
              ? 'bg-blue-950/30 border-blue-500/50 ring-1 ring-blue-500/40'
              : 'bg-slate-800/30 border-slate-800 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                selectedTaskId === null ? 'border-blue-400 bg-blue-500' : 'border-slate-600'
              }`}
            >
              {selectedTaskId === null && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <span className="text-xs font-medium text-slate-300">تمرکز آزاد و عمومی (بدون وظیفه مشخص)</span>
          </div>
          <span className="text-[10px] text-slate-500">حالت پیش‌فرض</span>
        </div>

        {/* Task Items */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {tasks
            .filter((t) => t.status === 'pending')
            .map((task) => {
              const isSelected = selectedTaskId === task.id;
              const cat = categories.find((c) => c.id === task.category_id);
              const pInfo = getPriorityLabel(task.priority);

              return (
                <div
                  key={task.id}
                  onClick={() => task.id && onSelectTask(task.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/40'
                      : 'bg-slate-800/50 border-slate-750 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                        isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-600'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {task.title}
                        </span>
                        {cat && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                            style={{
                              backgroundColor: `${cat.color}20`,
                              color: cat.color,
                            }}
                          >
                            {cat.title}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className={`px-1.5 py-0.2 rounded border font-medium ${pInfo.color}`}>
                          {pInfo.label}
                        </span>
                        <span className="text-slate-500 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {formatJalaliReadable(task.due_date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions on task inside Pomodoro */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Mark complete */}
                    <button
                      type="button"
                      onClick={() => {
                        if (task.id) {
                          soundFx.playCheckmark();
                          onToggleTask(task.id);
                          if (selectedTaskId === task.id) onSelectTask(null);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      title="تکمیل وظیفه"
                    >
                      <Circle className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete / remove task */}
                    <button
                      type="button"
                      onClick={() => {
                        if (task.id) {
                          onDeleteTask(task.id);
                          if (selectedTaskId === task.id) onSelectTask(null);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="کم کردن / حذف وظیفه از لیست"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {tasks.filter((t) => t.status === 'pending').length === 0 && (
              <div className="text-center py-5 text-slate-500 text-xs bg-slate-800/30 rounded-2xl">
                هیچ وظیفه فعالی وجود ندارد. از دکمه «افزودن وظیفه» استفاده کنید.
              </div>
            )}
          </div>
        </div>
      )}

        {/* TAB 2: HABITS LIST */}
        {activeTargetTab === 'habit' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                با انتخاب هر عادت، این جلسه پومودورو به آن متصل می‌شود. با اتمام موفقیت‌آمیز جلسه ۲۵ دقیقه‌ای،
                این عادت <strong>به‌صورت خودکار</strong> برای امروز تیک خواهد خورد!
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {habits.map((habit) => {
                const isSelected = selectedHabitId === habit.id;
                const cat = categories.find((c) => c.id === habit.category_id);
                const freqLabel =
                  habit.target_frequency === 'weekly'
                    ? 'هفتگی'
                    : habit.target_frequency === 'monthly'
                    ? 'ماهانه'
                    : 'روزانه';

                return (
                  <div
                    key={habit.id}
                    onClick={() => {
                      if (onSelectHabit) {
                        onSelectHabit(isSelected ? null : habit.id || null);
                      }
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-600/15 border-amber-500/50 shadow-sm'
                        : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-750'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold'
                            : 'border-slate-600 text-slate-500'
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5 fill-current" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {habit.title}
                          </span>
                          {cat && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                              style={{
                                backgroundColor: `${cat.color}20`,
                                color: cat.color,
                              }}
                            >
                              {cat.title}
                            </span>
                          )}
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                            تکرار {freqLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected ? (
                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          <span>هدف فعال</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 hover:text-amber-300">
                          انتخاب برای تمرکز
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {habits.length === 0 && (
                <div className="text-center py-5 text-slate-500 text-xs bg-slate-800/30 rounded-2xl">
                  هیچ عادتی تعریف نشده است. ابتدا در بخش «عادات» عادت‌های خود را ثبت کنید.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Comprehensive Session History & Navigation */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        {/* Header & Quick Stats */}
        {(() => {
          const sessionsPool = allSessions.length > 0 ? allSessions : recentSessions;
          const todayJalali = getTodayJalali();
          const last7 = new Set(getLastNDaysJalali(7));
          const last30 = new Set(getLastNDaysJalali(30));

          // Filter
          const filtered = sessionsPool.filter((s) => {
            // Target filter
            if (historyTargetFilter === 'tasks' && !s.task_id) return false;
            if (historyTargetFilter === 'habits' && (!s.habit_id && s.target_type !== 'habit')) return false;
            if (historyTargetFilter.startsWith('task_')) {
              const tid = Number(historyTargetFilter.replace('task_', ''));
              if (s.task_id !== tid) return false;
            }
            if (historyTargetFilter.startsWith('habit_')) {
              const hid = Number(historyTargetFilter.replace('habit_', ''));
              if (s.habit_id !== hid) return false;
            }

            // Date filter
            const sDate = s.completed_at_jalali.split(' ')[0] || s.completed_at_jalali;
            if (historyDateFilter === 'today') {
              return s.completed_at_jalali.startsWith(todayJalali);
            }
            if (historyDateFilter === '7days') {
              return last7.has(sDate);
            }
            if (historyDateFilter === '30days') {
              return last30.has(sDate);
            }
            return true;
          });

          // Sort descending
          const sorted = filtered.slice().sort((a, b) => b.completed_at_jalali.localeCompare(a.completed_at_jalali));

          // Total focus minutes
          const totalMinutes = filtered.reduce((acc, cur) => acc + (cur.duration_minutes || 25), 0);
          const totalHours = Math.floor(totalMinutes / 60);
          const remainingMinutes = totalMinutes % 60;

          // Pagination
          const totalPages = Math.ceil(sorted.length / PAGE_SIZE) || 1;
          const validPage = Math.min(Math.max(1, historyPage), totalPages);
          const paginated = sorted.slice((validPage - 1) * PAGE_SIZE, validPage * PAGE_SIZE);

          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">تاریخچه جامع جلسات تمرکز</h3>
                    <p className="text-[11px] text-slate-400">مرور، فیلتر و آمار دقیق جلسات پایان‌یافته</p>
                  </div>
                </div>

                {/* Summary badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                    <span className="text-slate-400">جلسات: </span>
                    <span className="font-bold text-white">{toPersianDigits(filtered.length)}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                    <span className="text-emerald-400">کل زمان: </span>
                    <span className="font-bold">
                      {totalHours > 0
                        ? `${toPersianDigits(totalHours)} ساعت و ${toPersianDigits(remainingMinutes)} دقیقه`
                        : `${toPersianDigits(totalMinutes)} دقیقه`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Filters Bar: Date & Linked Target (Task or Habit) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-800/40 p-3 rounded-2xl border border-slate-800">
                {/* Date Filter Buttons */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1.5">بازه زمانی تاریخ:</label>
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'all', label: 'همه زمان‌ها' },
                      { id: 'today', label: 'امروز' },
                      { id: '7days', label: '۷ روز اخیر' },
                      { id: '30days', label: '۳۰ روز اخیر' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => {
                          setHistoryDateFilter(btn.id as any);
                          setHistoryPage(1);
                        }}
                        className={`flex-1 py-1.5 text-center text-[11px] font-medium rounded-xl transition-all ${
                          historyDateFilter === btn.id
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Linked Target Filter (Tasks / Habits) */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1.5">فیلتر هدف متصل:</label>
                  <select
                    value={historyTargetFilter}
                    onChange={(e) => {
                      setHistoryTargetFilter(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">همه اهداف و جلسات آزاد</option>
                    <option value="tasks">📌 فقط وظایف (همه)</option>
                    <option value="habits">🔥 فقط عادات (همه)</option>
                    <optgroup label="وظایف تفکیکی">
                      {tasks.map((t) => (
                        <option key={`t_${t.id}`} value={`task_${t.id}`}>
                          وظیفه: {t.title} {t.status === 'completed' ? '(تکمیل شده)' : ''}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="عادات تفکیکی">
                      {habits.map((h) => (
                        <option key={`h_${h.id}`} value={`habit_${h.id}`}>
                          عادت: {h.title}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Sessions List */}
              <div className="space-y-2">
                {paginated.map((session, idx) => {
                  const isHabitSession = session.target_type === 'habit' || !!session.habit_id;
                  const task = session.task_id ? tasks.find((t) => t.id === session.task_id) : null;
                  const habit = session.habit_id ? habits.find((h) => h.id === session.habit_id) : null;
                  const cat = isHabitSession && habit
                    ? categories.find((c) => c.id === habit.category_id)
                    : task
                    ? categories.find((c) => c.id === task.category_id)
                    : null;

                  const [datePart, timePart] = session.completed_at_jalali.includes(' ')
                    ? session.completed_at_jalali.split(' ')
                    : [session.completed_at_jalali, ''];

                  return (
                    <div
                      key={session.id || idx}
                      className="p-3 rounded-2xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 ${
                            isHabitSession
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                              : task
                              ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          }`}
                        >
                          {isHabitSession ? (
                            <Flame className="w-4 h-4" />
                          ) : task ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-white truncate">
                              {isHabitSession
                                ? habit
                                  ? habit.title
                                  : 'جلسه تمرکز عادت'
                                : task
                                ? task.title
                                : 'جلسه تمرکز آزاد (عمومی)'}
                            </span>

                            {/* Badge: Task vs Habit */}
                            {isHabitSession ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                عادت
                              </span>
                            ) : task ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                وظیفه
                              </span>
                            ) : null}

                            {cat && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  backgroundColor: `${cat.color || '#3b82f6'}20`,
                                  color: cat.color || '#60a5fa',
                                  border: `1px solid ${cat.color || '#3b82f6'}40`,
                                }}
                              >
                                {cat.title}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            {formatJalaliReadable(datePart)}
                            {timePart && ` — ساعت ${toPersianDigits(timePart)}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono font-medium text-slate-300">
                          {toPersianDigits(session.duration_minutes || 25)} دقیقه
                        </span>
                        <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-1 rounded-xl">
                          تکمیل‌شده
                        </span>
                      </div>
                    </div>
                  );
                })}

                {filtered.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-xs bg-slate-800/20 rounded-2xl">
                    هیچ جلسه‌ای با فیلترهای انتخابی یافت نشد.
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                  <span>
                    صفحه {toPersianDigits(validPage)} از {toPersianDigits(totalPages)} (مجموع{' '}
                    {toPersianDigits(filtered.length)} جلسه)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={validPage <= 1}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:pointer-events-none text-slate-200"
                    >
                      صفحه قبلی
                    </button>
                    <button
                      type="button"
                      disabled={validPage >= totalPages}
                      onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:pointer-events-none text-slate-200"
                    >
                      صفحه بعدی
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
};
