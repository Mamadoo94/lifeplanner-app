import React, { useState } from 'react';
import {
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Edit3,
  Calendar,
  Tag,
  AlertCircle,
  Timer,
  X,
  Check,
  Settings2,
  FolderPlus,
  PlusCircle,
  Clock,
  Layers,
  TrendingUp,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Archive,
  RotateCcw,
  CheckCheck,
  Inbox,
} from 'lucide-react';
import { Task, Category, Attribute, TaskPriority, TaskStatus } from '../types';
import {
  getTodayJalali,
  getTodayJalaliWithTime,
  toPersianDigits,
  formatJalaliReadable,
  isDateInCurrentWeekJalali,
  isDateInCurrentMonthJalali,
  getCurrentJalaliMonthInfo,
} from '../utils/jalali';
import { soundFx } from '../utils/audio';
import { CategoryManagerModal } from './CategoryManagerModal';
import { JalaliDatePickerField } from './JalaliDatePickerModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface TasksViewProps {
  tasks: Task[];
  categories: Category[];
  attributes: Attribute[];
  taskAttributesMap: Record<number, number[]>; // taskId -> attributeIds[]
  onAddTask: (task: Omit<Task, 'id'>, attributeIds: number[]) => Promise<void>;
  onUpdateTask: (task: Task, attributeIds: number[]) => Promise<void>;
  onDeleteTask: (taskId: number) => Promise<void>;
  onToggleTask: (taskId: number) => void;
  onStartPomodoroForTask: (taskId: number) => void;
  onAddCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  onUpdateCategory?: (category: Category) => Promise<void>;
  onDeleteCategory: (categoryId: number) => Promise<void>;
  onAddAttribute: (attribute: Omit<Attribute, 'id'>) => Promise<void>;
  onUpdateAttribute?: (attribute: Attribute) => Promise<void>;
  onDeleteAttribute: (attributeId: number) => Promise<void>;
  onReorderTasks?: (tasks: Task[]) => Promise<void>;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  categories,
  attributes,
  taskAttributesMap,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
  onStartPomodoroForTask,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddAttribute,
  onUpdateAttribute,
  onDeleteAttribute,
  onReorderTasks,
}) => {
  // Drag and drop / Reordering states
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null);

  // Sub-view: Active Tasks vs Dedicated Task Archive
  const [taskSubView, setTaskSubView] = useState<'active' | 'archive'>('active');

  // Filters (Default timeframe is Daily/Today as requested)
  const [filterTimeFrame, setFilterTimeFrame] = useState<'all' | 'today' | 'weekly' | 'monthly'>('today');
  const [archiveTimeFrame, setArchiveTimeFrame] = useState<'all' | 'today' | 'weekly' | 'monthly'>('weekly');
  const [filterStatus, setFilterStatus] = useState<'all' | TaskStatus>('all');
  const [filterCategory, setFilterCategory] = useState<number | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Global Confirm Delete states
  const [taskToDelete, setTaskToDelete] = useState<{ id: number; title: string } | null>(null);
  const [attrToDelete, setAttrToDelete] = useState<{ id: number; title: string } | null>(null);

  // New Attribute inline state
  const [newAttrTitle, setNewAttrTitle] = useState('');
  const [isAddingAttr, setIsAddingAttr] = useState(false);

  // Deduplicate categories and attributes
  const uniqueCategories: Category[] = categories.filter(
    (c, index, self) => index === self.findIndex((t) => t.title.trim() === c.title.trim())
  );
  const uniqueAttributes: Attribute[] = attributes.filter(
    (a, index, self) => index === self.findIndex((t) => t.title.trim() === a.title.trim())
  );

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<number>(uniqueCategories[0]?.id || 1);
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formDueDate, setFormDueDate] = useState<string>(getTodayJalali());
  const [formDueTime, setFormDueTime] = useState<string>('');
  const [formSelectedAttrIds, setFormSelectedAttrIds] = useState<number[]>([]);

  const openAddModal = () => {
    setEditingTask(null);
    setFormTitle('');
    setFormCategoryId(uniqueCategories[0]?.id || 1);
    setFormPriority('medium');
    setFormDueDate(getTodayJalali());
    setFormDueTime('');
    setFormSelectedAttrIds([]);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormCategoryId(task.category_id);
    setFormPriority(task.priority);
    setFormDueDate(task.due_date);
    setFormDueTime(task.due_time || '');
    setFormSelectedAttrIds(task.id ? taskAttributesMap[task.id] || [] : []);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingTask && editingTask.id) {
      await onUpdateTask(
        {
          ...editingTask,
          title: formTitle.trim(),
          category_id: formCategoryId,
          priority: formPriority,
          due_date: formDueDate,
          due_time: formDueTime.trim() || undefined,
        },
        formSelectedAttrIds
      );
    } else {
      await onAddTask(
        {
          title: formTitle.trim(),
          category_id: formCategoryId,
          priority: formPriority,
          due_date: formDueDate,
          due_time: formDueTime.trim() || undefined,
          status: 'pending',
          created_at: getTodayJalaliWithTime(),
        },
        formSelectedAttrIds
      );
    }
    setIsModalOpen(false);
  };

  const toggleAttributeSelection = (attrId: number) => {
    setFormSelectedAttrIds((prev) =>
      prev.includes(attrId) ? prev.filter((id) => id !== attrId) : [...prev, attrId]
    );
  };

  const handleAddNewAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAttrTitle.trim();
    if (!trimmed) return;

    if (uniqueAttributes.some((a) => a.title.trim().toLowerCase() === trimmed.toLowerCase())) {
      setNewAttrTitle('');
      setIsAddingAttr(false);
      return;
    }

    await onAddAttribute({
      title: trimmed,
      icon: 'Tag',
    });
    setNewAttrTitle('');
    setIsAddingAttr(false);
  };

  // 1. Time-frame base filtering
  const timeframeTasks = tasks.filter((t) => {
    if (filterTimeFrame === 'today') {
      const today = getTodayJalali();
      // STRICT MATCHING: Only display tasks whose due date strictly equals TODAY'S exact Jalali date.
      // Do NOT leak tasks scheduled for tomorrow (e.g., 21 شهریور) or future dates into the "امروز/روزانه" view.
      if (t.due_date && t.due_date.trim()) {
        const cleanDueDate = t.due_date.split(' ')[0].trim();
        return cleanDueDate === today;
      }
      // If task has no due_date at all, only match if created today
      const cleanCreated = t.created_at ? t.created_at.split(' ')[0].trim() : '';
      return cleanCreated === today;
    }
    if (filterTimeFrame === 'weekly') {
      return isDateInCurrentWeekJalali(t.due_date);
    }
    if (filterTimeFrame === 'monthly') {
      return isDateInCurrentMonthJalali(t.due_date);
    }
    return true;
  });

  // Calculate completion percentage for the selected timeframe
  const timeframeTotalCount = timeframeTasks.length;
  const timeframeCompletedCount = timeframeTasks.filter((t) => t.status === 'completed').length;
  const timeframeCompletionRate =
    timeframeTotalCount > 0 ? Math.round((timeframeCompletedCount / timeframeTotalCount) * 100) : 0;

  // Category completion progress breakdown for selected timeframe
  const categoryProgressData = uniqueCategories
    .map((c) => {
      const catTasks = timeframeTasks.filter((t) => t.category_id === c.id);
      const completed = catTasks.filter((t) => t.status === 'completed').length;
      const total = catTasks.length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        category: c,
        total,
        completed,
        rate,
      };
    })
    .filter((item) => item.total > 0);

  // Apply secondary filters (status, category, priority)
  const filteredTasks = timeframeTasks.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterCategory !== 'all' && t.category_id !== filterCategory) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const pendingTasksCount = tasks.filter((t) => t.status === 'pending').length;
  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;

  // Active view displays pending tasks by default (completed tasks move directly to Task Archive)
  const activeDisplayTasks = filteredTasks.filter((t) => {
    if (filterStatus === 'all') return t.status === 'pending';
    return t.status === filterStatus;
  });

  // Dedicated Archive tasks filtered by archiveTimeFrame
  const archivedDisplayTasks = tasks.filter((t) => {
    if (t.status !== 'completed') return false;
    if (archiveTimeFrame === 'today') {
      const today = getTodayJalali();
      if (t.due_date && t.due_date.trim()) {
        return t.due_date.split(' ')[0].trim() === today;
      }
      return (t.created_at || '').split(' ')[0].trim() === today;
    }
    if (archiveTimeFrame === 'weekly') {
      return isDateInCurrentWeekJalali(t.due_date);
    }
    if (archiveTimeFrame === 'monthly') {
      return isDateInCurrentMonthJalali(t.due_date);
    }
    return true; // 'all'
  });

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return { label: 'فوری و اضطراری', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
      case 'high':
        return { label: 'اولویت بالا', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'medium':
        return { label: 'اولویت متوسط', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
      case 'low':
        return { label: 'اولویت پایین', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
    }
  };

  const handleMoveTask = (taskId: number, direction: 'up' | 'down') => {
    const currentIdx = tasks.findIndex((t) => t.id === taskId);
    if (currentIdx === -1) return;
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= tasks.length) return;

    const newTasks = [...tasks];
    const [moved] = newTasks.splice(currentIdx, 1);
    newTasks.splice(targetIdx, 0, moved);
    if (onReorderTasks) {
      onReorderTasks(newTasks);
    }
  };

  const handleDropTask = (targetTaskId: number) => {
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }
    const currentIdx = tasks.findIndex((t) => t.id === draggedTaskId);
    const targetIdx = tasks.findIndex((t) => t.id === targetTaskId);
    if (currentIdx === -1 || targetIdx === -1) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }

    const newTasks = [...tasks];
    const [moved] = newTasks.splice(currentIdx, 1);
    newTasks.splice(targetIdx, 0, moved);
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    if (onReorderTasks) {
      onReorderTasks(newTasks);
    }
  };

  const getTimeframeLabel = () => {
    switch (filterTimeFrame) {
      case 'today':
        return 'امروز و روزانه';
      case 'weekly':
        return 'هفتگی (این هفته)';
      case 'monthly':
        return 'ماهانه (این ماه)';
      case 'all':
        return 'همه زمان‌ها';
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header & Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">مدیریت وظایف</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ثبت، اولویت‌بندی و پیگیری کارهای روزمره با دسته‌بندی و ویژگی‌ها
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
            id="add-task-button"
            className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>وظیفه جدید</span>
          </button>
        </div>
      </div>

      {/* TOP VIEW SWITCHER: Active Tasks vs Dedicated Task Archive */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <button
          type="button"
          onClick={() => setTaskSubView('active')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            taskSubView === 'active'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>وظایف جاری</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              taskSubView === 'active' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {toPersianDigits(pendingTasksCount)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTaskSubView('archive')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            taskSubView === 'archive'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>آرشیو وظایف (تکمیل‌شده)</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              taskSubView === 'archive' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {toPersianDigits(completedTasksCount)}
          </span>
        </button>
      </div>

      {/* ======================= ACTIVE TASKS VIEW ======================= */}
      {taskSubView === 'active' && (
        <div className="space-y-4 animate-fadeIn">
          {/* 1. DEDICATED TIME-FRAME FILTER BAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>بازه زمانی وظایف:</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {toPersianDigits(timeframeTasks.length)} وظیفه در بازه {getTimeframeLabel()}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 bg-slate-800/60 p-1.5 rounded-2xl border border-slate-750">
          {[
            { id: 'today', label: 'امروز/روزانه' },
            { id: 'weekly', label: 'هفتگی' },
            { id: 'monthly', label: 'ماهانه' },
            { id: 'all', label: 'همه' },
          ].map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => setFilterTimeFrame(tf.id as any)}
              className={`py-2 px-1 text-center text-xs font-semibold rounded-xl transition-all ${
                filterTimeFrame === tf.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Category Completion Progress Indicator Bar for selected timeframe */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">
                درصد تکمیل کل ({getTimeframeLabel()}):
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-emerald-400 font-mono">
                {toPersianDigits(timeframeCompletionRate)}٪
              </span>
              <span className="text-slate-400 text-[11px]">
                ({toPersianDigits(timeframeCompletedCount)} از {toPersianDigits(timeframeTotalCount)})
              </span>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${timeframeCompletionRate}%` }}
            />
          </div>

          {/* Per-Category Completion Progress Bars */}
          {categoryProgressData.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {categoryProgressData.map(({ category, total, completed, rate }) => (
                <div
                  key={category.id}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 font-medium text-slate-200">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: category.color || '#3b82f6' }}
                      />
                      <span className="truncate max-w-[120px]">{category.title}</span>
                    </span>
                    <span className="text-slate-400">
                      {toPersianDigits(completed)}/{toPersianDigits(total)} ({toPersianDigits(rate)}٪)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${rate}%`,
                        backgroundColor: category.color || '#3b82f6',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Secondary Status & Priority Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3 space-y-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white font-semibold'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            همه وضعیت‌ها ({timeframeTasks.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              filterStatus === 'pending'
                ? 'bg-amber-600 text-white font-semibold'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            در انتظار انجام ({timeframeTasks.filter((t) => t.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              filterStatus === 'completed'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            تکمیل شده ({timeframeTasks.filter((t) => t.status === 'completed').length})
          </button>
        </div>

        {/* Category & Priority Filters */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60 flex-wrap">
          <select
            value={filterCategory}
            onChange={(e) =>
              setFilterCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="all">همه دسته‌ها</option>
            {uniqueCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) =>
              setFilterPriority(e.target.value === 'all' ? 'all' : (e.target.value as TaskPriority))
            }
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="all">همه اولویت‌ها</option>
            <option value="urgent">فوری و اضطراری</option>
            <option value="high">اولویت بالا</option>
            <option value="medium">اولویت متوسط</option>
            <option value="low">اولویت پایین</option>
          </select>
        </div>
      </div>

      {/* Active Tasks List */}
      <div className="space-y-2.5">
        {activeDisplayTasks.map((task, taskIndex) => {
          const cat = uniqueCategories.find((c) => c.id === task.category_id);
          const pBadge = getPriorityBadge(task.priority);
          const attrIds = task.id ? taskAttributesMap[task.id] || [] : [];
          const taskAttrs = uniqueAttributes.filter((a) => a.id && attrIds.includes(a.id));
          const isDone = task.status === 'completed';

          return (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => {
                if (task.id) {
                  e.dataTransfer.setData('text/plain', task.id.toString());
                  setDraggedTaskId(task.id);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (task.id && task.id !== draggedTaskId) {
                  setDragOverTaskId(task.id);
                }
              }}
              onDragLeave={() => {
                if (task.id && dragOverTaskId === task.id) {
                  setDragOverTaskId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (task.id) handleDropTask(task.id);
              }}
              onDragEnd={() => {
                setDraggedTaskId(null);
                setDragOverTaskId(null);
              }}
              className={`p-3.5 sm:p-4 rounded-3xl border transition-all ${
                isDone
                  ? 'bg-slate-900/40 border-slate-800/60 opacity-75'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              } ${dragOverTaskId === task.id ? 'border-blue-500 ring-2 ring-blue-500/30' : ''} ${
                draggedTaskId === task.id ? 'opacity-40 scale-[0.99]' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Checkbox button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (task.id) {
                        soundFx.playCheckmark();
                        onToggleTask(task.id);
                      }
                    }}
                    className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
                    title={isDone ? 'بازگرداندن به در انتظار' : 'تکمیل کردن وظیفه'}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <h3
                      className={`text-sm font-bold truncate ${
                        isDone ? 'line-through text-slate-400' : 'text-slate-100'
                      }`}
                    >
                      {task.title}
                    </h3>

                    {/* Meta info tags */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                      {cat && (
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium"
                          style={{
                            backgroundColor: `${cat.color}20`,
                            color: cat.color,
                          }}
                        >
                          {cat.title}
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${pBadge.color}`}
                      >
                        {pBadge.label}
                      </span>

                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>{formatJalaliReadable(task.due_date)}</span>
                      </span>

                      {task.due_time && (
                        <span
                          className="flex items-center gap-1 text-[11px] text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/25"
                          title="ساعت سررسید و آلارم"
                        >
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>{toPersianDigits(task.due_time)}</span>
                        </span>
                      )}

                      {/* Attributes */}
                      {taskAttrs.map((attr) => (
                        <span
                          key={attr.id}
                          className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] border border-slate-700 flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5 text-slate-400" />
                          <span>{attr.title}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions & Reordering */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Reorder Buttons & Handle */}
                  <div className="flex items-center bg-slate-800/60 rounded-xl p-0.5 border border-slate-700/50">
                    <button
                      type="button"
                      disabled={taskIndex === 0}
                      onClick={() => task.id && handleMoveTask(task.id, 'up')}
                      className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                      title="انتقال به بالا"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={taskIndex === filteredTasks.length - 1}
                      onClick={() => task.id && handleMoveTask(task.id, 'down')}
                      className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
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

                  {!isDone && (
                    <button
                      onClick={() => task.id && onStartPomodoroForTask(task.id)}
                      className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors"
                      title="شروع پومودورو برای این وظیفه"
                    >
                      <Timer className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(task)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="ویرایش"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (task.id) {
                        setTaskToDelete({ id: task.id, title: task.title });
                      }
                    }}
                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {activeDisplayTasks.length === 0 && (
          <div className="text-center py-12 bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-6">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-slate-400">هیچ وظیفه فعالی در این بازه زمانی پیدا نشد.</p>
            <p className="text-xs text-slate-500 mt-1">
              وظایف تکمیل‌شده به بخش «آرشیو وظایف» منتقل شده‌اند.
            </p>
          </div>
        )}
      </div>
    </div>
  )}

      {/* ======================= DEDICATED TASK ARCHIVE VIEW ======================= */}
      {taskSubView === 'archive' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Archive Filter Bar (Weekly & Monthly Focus) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <CheckCheck className="w-4 h-4" />
                <span>فیلتر بازه زمانی آرشیو وظایف:</span>
              </div>
              <span className="text-[11px] text-slate-400">
                {toPersianDigits(archivedDisplayTasks.length)} وظیفه تکمیل‌شده
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 bg-slate-800/60 p-1.5 rounded-2xl border border-slate-750">
              {[
                { id: 'weekly', label: 'هفتگی (این هفته)' },
                { id: 'monthly', label: 'ماهانه (این ماه)' },
                { id: 'today', label: 'امروز' },
                { id: 'all', label: 'همه آرشیو' },
              ].map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setArchiveTimeFrame(tf.id as any)}
                  className={`py-2 px-1 text-center text-xs font-semibold rounded-xl transition-all ${
                    archiveTimeFrame === tf.id
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Archived Tasks List */}
          <div className="space-y-2.5">
            {archivedDisplayTasks.map((task) => {
              const cat = uniqueCategories.find((c) => c.id === task.category_id);
              const pBadge = getPriorityBadge(task.priority);
              const attrIds = task.id ? taskAttributesMap[task.id] || [] : [];
              const taskAttrs = uniqueAttributes.filter((a) => a.id && attrIds.includes(a.id));

              return (
                <div
                  key={task.id}
                  className="p-3.5 sm:p-4 rounded-3xl border border-slate-800/70 bg-slate-900/60 transition-all hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5 text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-5 h-5 fill-emerald-500/20" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold truncate line-through text-slate-400">
                          {task.title}
                        </h3>

                        <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                          {cat && (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium"
                              style={{
                                backgroundColor: `${cat.color}15`,
                                color: cat.color,
                              }}
                            >
                              {cat.title}
                            </span>
                          )}

                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border opacity-75 ${pBadge.color}`}
                          >
                            {pBadge.label}
                          </span>

                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Calendar className="w-3 h-3" />
                            <span>سررسید: {formatJalaliReadable(task.due_date)}</span>
                          </span>

                          {taskAttrs.map((attr) => (
                            <span
                              key={attr.id}
                              className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 text-[10px] border border-slate-700 flex items-center gap-1"
                            >
                              <Tag className="w-2.5 h-2.5 text-slate-400" />
                              <span>{attr.title}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Restore / Unarchive Task Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (task.id) {
                            soundFx.playCheckmark();
                            onToggleTask(task.id);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
                        title="بازگردانی به وظایف جاری"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                        <span className="hidden sm:inline">بازگردانی</span>
                      </button>

                      {/* Delete permanently */}
                      <button
                        type="button"
                        onClick={() => {
                          if (task.id) {
                            setTaskToDelete({ id: task.id, title: task.title });
                          }
                        }}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        title="حذف از آرشیو"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {archivedDisplayTasks.length === 0 && (
              <div className="text-center py-12 bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-6">
                <Archive className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">
                  هیچ وظیفه تکمیل‌شده‌ای در این بازه زمانی وجود ندارد.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  پس از انجام هر وظیفه در بخش «وظایف جاری»، به‌صورت خودکار به این آرشیو منتقل می‌شود.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingTask ? 'ویرایش وظیفه' : 'تعریف وظیفه جدید'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  عنوان وظیفه *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثلاً: طراحی پروتوتایپ صفحه اصلی..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      دسته‌بندی
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>مدیریت دسته‌ها</span>
                    </button>
                  </div>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500"
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
                    اولویت
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="urgent">فوری و اضطراری</option>
                    <option value="high">بالا</option>
                    <option value="medium">متوسط</option>
                    <option value="low">پایین</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <JalaliDatePickerField
                  label="تاریخ سررسید (شمسی)"
                  value={formDueDate}
                  onChange={(date) => setFormDueDate(date)}
                  id="task-due-date-picker"
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    ساعت سررسید / آلارم (اختیاری)
                  </label>
                  <input
                    type="time"
                    value={formDueTime}
                    onChange={(e) => setFormDueTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {['09:00', '14:30', '18:00', '21:00'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormDueTime(t)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors ${
                          formDueTime === t
                            ? 'bg-blue-600 text-white font-bold border-blue-500'
                            : 'bg-slate-800/80 text-slate-400 border-slate-750 hover:text-slate-200'
                        }`}
                      >
                        {toPersianDigits(t)}
                      </button>
                    ))}
                    {formDueTime && (
                      <button
                        type="button"
                        onClick={() => setFormDueTime('')}
                        className="text-[10px] px-1.5 py-0.5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                      >
                        پاک کردن
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Attributes (ویژگی‌ها) Selection & Management */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-400" />
                    ویژگی‌ها و برچسب‌های تکمیلی
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingAttr(!isAddingAttr)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>افزودن ویژگی جدید</span>
                  </button>
                </div>

                {/* Add new attribute inline input */}
                {isAddingAttr && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-800 border border-slate-700 animate-fadeIn">
                    <input
                      type="text"
                      value={newAttrTitle}
                      onChange={(e) => setNewAttrTitle(e.target.value)}
                      placeholder="عنوان ویژگی جدید (مثلاً: نیاز به تماس، خرید آنلاین...)"
                      className="flex-1 bg-slate-900 border border-slate-750 text-slate-150 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewAttribute}
                      disabled={!newAttrTitle.trim()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50"
                    >
                      ثبت
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingAttr(false);
                        setNewAttrTitle('');
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Attributes List: selectable chips with delete option */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {uniqueAttributes.map((attr) => {
                    const isSelected = attr.id ? formSelectedAttrIds.includes(attr.id) : false;
                    return (
                      <div
                        key={attr.id}
                        className={`group px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => attr.id && toggleAttributeSelection(attr.id)}
                          className="flex items-center gap-1 focus:outline-none"
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          <span>{attr.title}</span>
                        </button>

                        {/* Delete attribute button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (attr.id) {
                              setAttrToDelete({ id: attr.id, title: attr.title });
                            }
                          }}
                          className="text-slate-400 hover:text-rose-400 p-0.5 rounded opacity-60 group-hover:opacity-100 transition-opacity"
                          title="حذف این ویژگی"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  {uniqueAttributes.length === 0 && (
                    <span className="text-[11px] text-slate-500 py-1">
                      هیچ ویژگی‌ای ثبت نشده است. روی "افزودن ویژگی جدید" بزنید.
                    </span>
                  )}
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
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/30"
                >
                  {editingTask ? 'ذخیره تغییرات' : 'افزودن وظیفه'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category & Attribute Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={uniqueCategories}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
        onSelectCategory={(newCatId) => setFormCategoryId(newCatId)}
        attributes={uniqueAttributes}
        onAddAttribute={onAddAttribute}
        onUpdateAttribute={onUpdateAttribute}
        onDeleteAttribute={onDeleteAttribute}
      />

      {/* Confirm Task Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!taskToDelete}
        title="حذف وظیفه"
        itemName={taskToDelete?.title}
        message="آیا از حذف این وظیفه اطمینان دارید؟ این عملیات قابل بازگشت نیست."
        onConfirm={() => {
          if (taskToDelete) {
            onDeleteTask(taskToDelete.id);
            setTaskToDelete(null);
          }
        }}
        onCancel={() => setTaskToDelete(null)}
      />

      {/* Confirm Attribute Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!attrToDelete}
        title="حذف ویژگی"
        itemName={attrToDelete?.title}
        message="آیا از حذف این ویژگی اطمینان دارید؟ انتساب این ویژگی از تمام وظایف برداشته می‌شود."
        onConfirm={() => {
          if (attrToDelete) {
            onDeleteAttribute(attrToDelete.id);
            setFormSelectedAttrIds((prev) => prev.filter((id) => id !== attrToDelete.id));
            setAttrToDelete(null);
          }
        }}
        onCancel={() => setAttrToDelete(null)}
      />
    </div>
  );
};
