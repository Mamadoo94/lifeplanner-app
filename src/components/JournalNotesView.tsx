import React, { useState } from 'react';
import {
  BookOpen,
  FolderTree,
  Zap,
  Target,
  Lock,
  Unlock,
  Save,
  Plus,
  Trash2,
  CornerDownLeft,
  Search,
  ChevronDown,
  ChevronLeft,
  X,
  Edit3,
  Calendar,
  History,
  ChevronsUpDown,
  ArrowUpLeft,
  Layers,
  GripVertical,
  ChevronUp,
  CalendarDays,
} from 'lucide-react';
import { DailyJournal, Note, Category } from '../types';
import {
  getTodayJalali,
  getTodayJalaliWithTime,
  toPersianDigits,
  formatJalaliReadable,
  PERSIAN_MONTHS,
  getMonthlyCalendarWeek,
} from '../utils/jalali';
import { soundFx } from '../utils/audio';
import { JalaliDatePickerField } from './JalaliDatePickerModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface JournalNotesViewProps {
  categories: Category[];
  todayJournal: DailyJournal | null;
  onSaveJournal: (journal: Omit<DailyJournal, 'id'>) => Promise<void>;
  allJournals: DailyJournal[];
  onDeleteJournal?: (journalId: number) => Promise<void>;
  notes: Note[];
  onAddNote: (note: Omit<Note, 'id'>) => Promise<void>;
  onUpdateNote: (note: Note) => Promise<void>;
  onDeleteNote: (noteId: number) => Promise<void>;
  onReorderJournals?: (journals: DailyJournal[]) => Promise<void>;
  onReorderNotes?: (notes: Note[]) => Promise<void>;
}

export const JournalNotesView: React.FC<JournalNotesViewProps> = ({
  categories = [],
  todayJournal,
  onSaveJournal,
  allJournals = [],
  onDeleteJournal,
  notes = [],
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onReorderJournals,
  onReorderNotes,
}) => {
  const [subTab, setSubTab] = useState<'journal' | 'notes'>('journal');

  // Journal delete modal state
  const [journalToDelete, setJournalToDelete] = useState<{ id: number; date: string } | null>(null);
  // Note delete modal state
  const [noteToDelete, setNoteToDelete] = useState<{ id: number; title: string } | null>(null);

  const confirmDeleteJournal = async () => {
    if (journalToDelete && onDeleteJournal) {
      await onDeleteJournal(journalToDelete.id);
      soundFx.playDelete();
      if (journalDate === journalToDelete.date) {
        setJournalContent('');
      }
      setJournalToDelete(null);
    }
  };

  // Journal form states
  const [journalDate, setJournalDate] = useState<string>(getTodayJalali());
  const [journalContent, setJournalContent] = useState<string>(
    todayJournal?.content || ''
  );
  const [energyScore, setEnergyScore] = useState<number>(todayJournal?.energy_score ?? 8);
  const [productivityScore, setProductivityScore] = useState<number>(
    todayJournal?.productivity_score ?? 8
  );
  const [isLocked, setIsLocked] = useState<boolean>(todayJournal?.is_locked ?? false);
  const [journalSaveStatus, setJournalSaveStatus] = useState<string>('');
  const [journalSearchQuery, setJournalSearchQuery] = useState<string>('');

  // Monthly & Weekly Grouped Accordion State for Journal History
  const [journalGroupingMode, setJournalGroupingMode] = useState<'grouped' | 'flat'>('grouped');
  const [expandedJournalDates, setExpandedJournalDates] = useState<Set<string>>(new Set());
  const [expandedMonthKeys, setExpandedMonthKeys] = useState<Set<string>>(() => {
    const today = getTodayJalali();
    const parts = today.split('/');
    return new Set([`${parts[0]}/${parts[1]}`]);
  });
  const [expandedWeekKeys, setExpandedWeekKeys] = useState<Set<string>>(() => {
    const today = getTodayJalali();
    const parts = today.split('/');
    const d = parseInt(parts[2], 10) || 1;
    const { weekNum } = getMonthlyCalendarWeek(d);
    return new Set([`${parts[0]}/${parts[1]}_w${weekNum}`]);
  });

  // Handle date selection with auto-load
  const handleSelectDate = (date: string) => {
    setJournalDate(date);
    const j = allJournals.find((item) => item.date_jalali === date);
    if (j) {
      setJournalContent(j.content);
      setEnergyScore(j.energy_score);
      setProductivityScore(j.productivity_score);
      setIsLocked(j.is_locked);
    } else {
      setJournalContent('');
      setEnergyScore(8);
      setProductivityScore(8);
      setIsLocked(false);
    }
  };

  const toggleJournalAccordion = (date: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedJournalDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const toggleMonthAccordion = (monthKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedMonthKeys((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  const toggleWeekAccordion = (weekKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedWeekKeys((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) {
        next.delete(weekKey);
      } else {
        next.add(weekKey);
      }
      return next;
    });
  };

  const toggleAllJournalsAccordion = () => {
    if (expandedMonthKeys.size > 0 || expandedWeekKeys.size > 0 || expandedJournalDates.size > 0) {
      setExpandedMonthKeys(new Set());
      setExpandedWeekKeys(new Set());
      setExpandedJournalDates(new Set());
    } else {
      const allMonths = new Set<string>();
      const allWeeks = new Set<string>();
      const allDates = new Set<string>();
      allJournals.forEach((j) => {
        const parts = j.date_jalali.split('/');
        const mKey = `${parts[0]}/${parts[1]}`;
        const d = parseInt(parts[2], 10) || 1;
        const { weekNum } = getMonthlyCalendarWeek(d);
        allMonths.add(mKey);
        allWeeks.add(`${mKey}_w${weekNum}`);
        allDates.add(j.date_jalali);
      });
      setExpandedMonthKeys(allMonths);
      setExpandedWeekKeys(allWeeks);
      setExpandedJournalDates(allDates);
    }
  };

  // Notes state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNoteCategory, setSelectedNoteCategory] = useState<number | 'all'>('all');
  const [noteGroupingMode, setNoteGroupingMode] = useState<'tree' | 'timeline'>('tree');
  const [expandedNoteMonthKeys, setExpandedNoteMonthKeys] = useState<Set<string>>(() => {
    const today = getTodayJalali();
    const parts = today.split('/');
    return new Set([`${parts[0]}/${parts[1]}`]);
  });
  const [expandedNoteWeekKeys, setExpandedNoteWeekKeys] = useState<Set<string>>(new Set());
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteParentId, setNoteParentId] = useState<number | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategoryId, setNoteCategoryId] = useState<number>(categories[0]?.id || 1);

  // Accordion state for tree notes (default collapsed for high-density view)
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<number>>(new Set());

  const toggleNoteMonthAccordion = (mKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNoteMonthKeys((prev) => {
      const next = new Set(prev);
      if (next.has(mKey)) next.delete(mKey);
      else next.add(mKey);
      return next;
    });
  };

  const toggleNoteWeekAccordion = (wKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNoteWeekKeys((prev) => {
      const next = new Set(prev);
      if (next.has(wKey)) next.delete(wKey);
      else next.add(wKey);
      return next;
    });
  };

  // Handle Journal Save
  const handleSaveJournal = async () => {
    await onSaveJournal({
      date_jalali: journalDate,
      content: journalContent,
      energy_score: energyScore,
      productivity_score: productivityScore,
      is_locked: isLocked,
    });
    soundFx.playCheckmark();
    setJournalSaveStatus('ژورنال با موفقیت ذخیره شد');
    setTimeout(() => setJournalSaveStatus(''), 3000);
  };

  // Load a journal entry into the top editor and scroll smoothly
  const loadJournalEntryToEditor = (j: DailyJournal) => {
    setJournalDate(j.date_jalali);
    setJournalContent(j.content);
    setEnergyScore(j.energy_score);
    setProductivityScore(j.productivity_score);
    setIsLocked(j.is_locked);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Journal Reorder state & handlers
  const [draggedJournalId, setDraggedJournalId] = useState<number | null>(null);
  const [dragOverJournalId, setDragOverJournalId] = useState<number | null>(null);

  const handleMoveJournal = (journalId: number, direction: 'up' | 'down') => {
    const currentIdx = allJournals.findIndex((j) => j.id === journalId);
    if (currentIdx === -1) return;
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= allJournals.length) return;

    const newJournals = [...allJournals];
    const [moved] = newJournals.splice(currentIdx, 1);
    newJournals.splice(targetIdx, 0, moved);
    if (onReorderJournals) {
      onReorderJournals(newJournals);
    }
  };

  const handleDropJournal = (targetJournalId: number) => {
    if (!draggedJournalId || draggedJournalId === targetJournalId) {
      setDraggedJournalId(null);
      setDragOverJournalId(null);
      return;
    }
    const currentIdx = allJournals.findIndex((j) => j.id === draggedJournalId);
    const targetIdx = allJournals.findIndex((j) => j.id === targetJournalId);
    if (currentIdx === -1 || targetIdx === -1) {
      setDraggedJournalId(null);
      setDragOverJournalId(null);
      return;
    }

    const newJournals = [...allJournals];
    const [moved] = newJournals.splice(currentIdx, 1);
    newJournals.splice(targetIdx, 0, moved);
    setDraggedJournalId(null);
    setDragOverJournalId(null);
    if (onReorderJournals) {
      onReorderJournals(newJournals);
    }
  };

  // Note Reorder state & handlers
  const [draggedNoteId, setDraggedNoteId] = useState<number | null>(null);
  const [dragOverNoteId, setDragOverNoteId] = useState<number | null>(null);

  const handleMoveNote = (noteId: number, direction: 'up' | 'down') => {
    const currentIdx = notes.findIndex((n) => n.id === noteId);
    if (currentIdx === -1) return;
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= notes.length) return;

    const newNotes = [...notes];
    const [moved] = newNotes.splice(currentIdx, 1);
    newNotes.splice(targetIdx, 0, moved);
    if (onReorderNotes) {
      onReorderNotes(newNotes);
    }
  };

  const handleDropNote = (targetNoteId: number) => {
    if (!draggedNoteId || draggedNoteId === targetNoteId) {
      setDraggedNoteId(null);
      setDragOverNoteId(null);
      return;
    }
    const currentIdx = notes.findIndex((n) => n.id === draggedNoteId);
    const targetIdx = notes.findIndex((n) => n.id === targetNoteId);
    if (currentIdx === -1 || targetIdx === -1) {
      setDraggedNoteId(null);
      setDragOverNoteId(null);
      return;
    }

    const newNotes = [...notes];
    const [moved] = newNotes.splice(currentIdx, 1);
    newNotes.splice(targetIdx, 0, moved);
    setDraggedNoteId(null);
    setDragOverNoteId(null);
    if (onReorderNotes) {
      onReorderNotes(newNotes);
    }
  };

  // Note Modal triggers
  const openAddNoteModal = (parentId: number | null = null) => {
    setEditingNote(null);
    setNoteParentId(parentId);
    setNoteTitle('');
    setNoteContent('');
    setNoteCategoryId(categories[0]?.id || 1);
    setIsNoteModalOpen(true);
  };

  const openEditNoteModal = (note: Note) => {
    setEditingNote(note);
    setNoteParentId(note.parent_id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteCategoryId(note.category_id);
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    if (editingNote && editingNote.id) {
      await onUpdateNote({
        ...editingNote,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        category_id: noteCategoryId,
        parent_id: noteParentId,
        updated_at_jalali: getTodayJalaliWithTime(),
      });
    } else {
      await onAddNote({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        category_id: noteCategoryId,
        parent_id: noteParentId,
        updated_at_jalali: getTodayJalaliWithTime(),
      });
    }
    setIsNoteModalOpen(false);
  };

  const toggleNoteAccordion = (noteId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const toggleAllNotesAccordion = () => {
    if (expandedNoteIds.size > 0) {
      setExpandedNoteIds(new Set());
    } else {
      setExpandedNoteIds(new Set(notes.map((n) => n.id!).filter(Boolean)));
    }
  };

  // Filter notes
  const rootNotes = notes.filter((n) => n.parent_id === null);
  const getChildNotes = (parentId: number) => notes.filter((n) => n.parent_id === parentId);

  return (
    <div className="space-y-4 pb-24">
      {/* Top Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
          <button
            onClick={() => setSubTab('journal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              subTab === 'journal'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>ژورنال روزانه</span>
          </button>
          <button
            onClick={() => setSubTab('notes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              subTab === 'notes'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>یادداشت‌های درختی</span>
          </button>
        </div>

        {subTab === 'notes' && (
          <button
            onClick={() => openAddNoteModal(null)}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>یادداشت جدید</span>
          </button>
        )}
      </div>

      {/* ===================== TAB 1: DAILY JOURNAL ===================== */}
      {subTab === 'journal' && (
        <div className="space-y-4">
          {/* Active Journal Editor Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">ثبت بازتاب و یادداشت روزانه</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    عملکرد، سطح انرژی، موانع و درس‌های روزانه خود را ثبت کنید
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLocked(!isLocked)}
                  className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isLocked
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title={isLocked ? 'یادداشت قفل است' : 'قفل کردن یادداشت'}
                >
                  {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isLocked ? 'قفل‌شده' : 'عمومی'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveJournal}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>ذخیره گزارش</span>
                </button>
              </div>
            </div>

            {journalSaveStatus && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-2xl animate-fadeIn text-center font-medium">
                {journalSaveStatus}
              </div>
            )}

            {/* Date Picker + Energy & Productivity sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
              {/* Jalali Date Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  تاریخ گزارش روزانه:
                </label>
                <JalaliDatePickerField
                  value={journalDate}
                  onChange={handleSelectDate}
                  label=""
                />
              </div>

              {/* Energy Rating */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    سطح انرژی روزانه:
                  </span>
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    {toPersianDigits(energyScore)} / ۱۰
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={energyScore}
                  onChange={(e) => setEnergyScore(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>بی‌انرژی</span>
                  <span>متوسط</span>
                  <span>پرانرژی</span>
                </div>
              </div>

              {/* Productivity Rating */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-emerald-400" />
                    سطح بهره‌وری روزانه:
                  </span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {toPersianDigits(productivityScore)} / ۱۰
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={productivityScore}
                  onChange={(e) => setProductivityScore(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>کم‌بازده</span>
                  <span>معمولی</span>
                  <span>فوق‌العاده</span>
                </div>
              </div>
            </div>

            {/* Journal Textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                متن گزارش و یادداشت‌های روز:
              </label>
              <textarea
                rows={5}
                value={journalContent}
                onChange={(e) => setJournalContent(e.target.value)}
                placeholder="چه دستاوردهایی داشتم؟ با چه چالش‌هایی مواجه شدم؟ فردا چه چیزی را بهتر انجام خواهم داد؟"
                className="w-full bg-slate-800/80 border border-slate-700 text-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* 3. COLLAPSIBLE ACCORDION JOURNAL HISTORY (MONTHLY & WEEKLY GROUPED) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <History className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">تاریخچه یادداشت‌های پیشین</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {toPersianDigits(allJournals.length)} یادداشت ثبت‌شده
                </span>
              </div>

              {/* View Mode Switcher, Expand/Collapse & Search */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setJournalGroupingMode('grouped')}
                    className={`px-2.5 py-1 rounded-lg transition-all font-medium flex items-center gap-1.5 ${
                      journalGroupingMode === 'grouped'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="دسته‌بندی آکاردئونی بر اساس ماه‌ها و هفته‌های شمسی"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">ماهانه و هفتگی</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJournalGroupingMode('flat')}
                    className={`px-2.5 py-1 rounded-lg transition-all font-medium flex items-center gap-1.5 ${
                      journalGroupingMode === 'flat'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="فهرست یکپارچه زمانی یادداشت‌ها"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">فهرست یکپارچه</span>
                  </button>
                </div>

                {/* Expand / Collapse All */}
                <button
                  type="button"
                  onClick={toggleAllJournalsAccordion}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-750 flex items-center gap-1.5 transition-all"
                  title="باز کردن یا بستن همه یادداشت‌ها و آکاردئون‌ها"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {expandedMonthKeys.size > 0 || expandedWeekKeys.size > 0 || expandedJournalDates.size > 0
                      ? 'جمع‌کردن همه'
                      : 'گسترش همه'}
                  </span>
                </button>

                {/* Search in History */}
                <div className="relative min-w-[170px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={journalSearchQuery}
                    onChange={(e) => {
                      const q = e.target.value;
                      setJournalSearchQuery(q);
                      if (q.trim()) {
                        // Auto-expand all when searching
                        const allMonths = new Set<string>();
                        const allWeeks = new Set<string>();
                        allJournals.forEach((j) => {
                          const parts = j.date_jalali.split('/');
                          const mKey = `${parts[0]}/${parts[1]}`;
                          const d = parseInt(parts[2], 10) || 1;
                          const { weekNum } = getMonthlyCalendarWeek(d);
                          allMonths.add(mKey);
                          allWeeks.add(`${mKey}_w${weekNum}`);
                        });
                        setExpandedMonthKeys(allMonths);
                        setExpandedWeekKeys(allWeeks);
                      }
                    }}
                    placeholder="جستجو در متن یا تاریخ..."
                    className="w-full bg-slate-800/90 border border-slate-700 text-slate-200 text-xs rounded-xl pr-9 pl-7 py-1.5 focus:outline-none focus:border-indigo-500"
                  />
                  {journalSearchQuery && (
                    <button
                      onClick={() => setJournalSearchQuery('')}
                      className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Grouped / Flat Accordion Content */}
            {(() => {
              const sortedJournals = allJournals
                .slice()
                .sort((a, b) => {
                  if (a.sort_order !== undefined && b.sort_order !== undefined) {
                    return a.sort_order - b.sort_order;
                  }
                  return b.date_jalali.localeCompare(a.date_jalali);
                })
                .filter((j) => {
                  if (!journalSearchQuery.trim()) return true;
                  const query = journalSearchQuery.trim().toLowerCase();
                  return (
                    j.date_jalali.includes(query) ||
                    (j.content && j.content.toLowerCase().includes(query))
                  );
                });

              if (allJournals.length === 0) {
                return (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    هنوز هیچ یادداشت روزانه‌ای ثبت نشده است. اولین گزارش امروز خود را در کادر بالا بنویسید و ذخیره کنید.
                  </div>
                );
              }

              if (sortedJournals.length === 0) {
                return (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    هیچ یادداشتی منطبق با عبارت «{journalSearchQuery}» یافت نشد.
                  </div>
                );
              }

              // Card Renderer
              const renderJournalCard = (j: DailyJournal, journalIndex: number, currentList: DailyJournal[]) => {
                const isSelected = j.date_jalali === journalDate;
                const isExpanded = expandedJournalDates.has(j.date_jalali);

                return (
                  <div
                    key={j.id || j.date_jalali}
                    draggable
                    onDragStart={(e) => {
                      if (j.id) {
                        e.dataTransfer.setData('text/plain', j.id.toString());
                        setDraggedJournalId(j.id);
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (j.id && j.id !== draggedJournalId) {
                        setDragOverJournalId(j.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (j.id && dragOverJournalId === j.id) {
                        setDragOverJournalId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (j.id) handleDropJournal(j.id);
                    }}
                    onDragEnd={() => {
                      setDraggedJournalId(null);
                      setDragOverJournalId(null);
                    }}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-500/50 shadow-sm'
                        : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-750'
                    } ${dragOverJournalId === j.id ? 'border-indigo-500 ring-2 ring-indigo-500/30' : ''} ${
                      draggedJournalId === j.id ? 'opacity-40 scale-[0.99]' : ''
                    }`}
                  >
                    {/* Accordion Header Row (High-Density Clickable) */}
                    <div
                      onClick={() => toggleJournalAccordion(j.date_jalali)}
                      className="p-3 cursor-pointer flex items-center justify-between gap-3 select-none"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {/* Toggle Arrow */}
                        <span
                          className={`p-1 rounded-lg bg-slate-800 text-slate-400 transition-transform duration-200 shrink-0 ${
                            isExpanded ? 'rotate-180 text-indigo-400' : ''
                          }`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white">
                              {formatJalaliReadable(j.date_jalali)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({toPersianDigits(j.date_jalali)})
                            </span>
                            {isSelected && (
                              <span className="text-[9px] px-2 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                ویرایشگر بالا
                              </span>
                            )}
                          </div>

                          {/* Truncated preview when collapsed */}
                          {!isExpanded && (
                            <p className="text-xs text-slate-400 truncate max-w-lg mt-0.5">
                              {j.content ? (
                                j.content
                              ) : (
                                <span className="italic text-slate-500">(بدون متن توضیحی)</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Scores, Status Badges & Reorder Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Reorder Buttons & Handle */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/50"
                        >
                          <button
                            type="button"
                            disabled={journalIndex === 0}
                            onClick={() => j.id && handleMoveJournal(j.id, 'up')}
                            className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-400 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                            title="انتقال به بالا"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={journalIndex === currentList.length - 1}
                            onClick={() => j.id && handleMoveJournal(j.id, 'down')}
                            className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-400 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
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

                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-semibold flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          {toPersianDigits(j.energy_score)}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-semibold flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-emerald-400" />
                          {toPersianDigits(j.productivity_score)}
                        </span>
                        {j.is_locked && (
                          <span
                            className="p-1 rounded-lg bg-rose-500/10 text-rose-400"
                            title="قفل‌شده"
                          >
                            <Lock className="w-3 h-3" />
                          </span>
                        )}

                        {onDeleteJournal && j.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setJournalToDelete({ id: j.id!, date: j.date_jalali });
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="حذف این یادداشت روزانه"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Accordion Expanded Content Panel */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-slate-900/60 space-y-3 animate-fadeIn">
                        <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-750">
                          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                            {j.content || (
                              <span className="italic text-slate-500">
                                توضیحی برای این روز ثبت نشده است.
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 flex-wrap text-xs pt-1">
                          <div className="flex items-center gap-4 text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                              انرژی: {toPersianDigits(j.energy_score)} از ۱۰
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5 text-emerald-400" />
                              بهره‌وری: {toPersianDigits(j.productivity_score)} از ۱۰
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {onDeleteJournal && j.id && (
                              <button
                                type="button"
                                onClick={() => setJournalToDelete({ id: j.id!, date: j.date_jalali })}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
                                title="حذف یادداشت این روز"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => loadJournalEntryToEditor(j)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                            >
                              <ArrowUpLeft className="w-3.5 h-3.5" />
                              <span>بارگذاری در ویرایشگر بالا</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              };

              // CASE A: GROUPED VIEW (MONTHLY & WEEKLY ACCORDION)
              if (journalGroupingMode === 'grouped') {
                // Group by month and week
                interface MonthData {
                  monthKey: string;
                  year: number;
                  month: number;
                  monthLabel: string;
                  weeksMap: Map<number, DailyJournal[]>;
                  allMonthJournals: DailyJournal[];
                }

                const monthMap = new Map<string, MonthData>();

                sortedJournals.forEach((j) => {
                  const parts = j.date_jalali.split('/');
                  const y = parseInt(parts[0], 10) || 1405;
                  const m = parseInt(parts[1], 10) || 1;
                  const d = parseInt(parts[2], 10) || 1;
                  const mStr = m < 10 ? `0${m}` : `${m}`;
                  const monthKey = `${y}/${mStr}`;
                  const { weekNum } = getMonthlyCalendarWeek(d);

                  if (!monthMap.has(monthKey)) {
                    const monthName = PERSIAN_MONTHS[m - 1] || `${m}`;
                    monthMap.set(monthKey, {
                      monthKey,
                      year: y,
                      month: m,
                      monthLabel: `${monthName} ${toPersianDigits(y)}`,
                      weeksMap: new Map<number, DailyJournal[]>(),
                      allMonthJournals: [],
                    });
                  }

                  const mData = monthMap.get(monthKey)!;
                  if (!mData.weeksMap.has(weekNum)) {
                    mData.weeksMap.set(weekNum, []);
                  }
                  mData.weeksMap.get(weekNum)!.push(j);
                  mData.allMonthJournals.push(j);
                });

                const sortedMonths = Array.from(monthMap.values()).sort((a, b) =>
                  b.monthKey.localeCompare(a.monthKey)
                );

                return (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {sortedMonths.map((mGroup) => {
                      const isMonthExpanded = expandedMonthKeys.has(mGroup.monthKey);
                      const monthName = PERSIAN_MONTHS[mGroup.month - 1] || `${mGroup.month}`;
                      const totalEntries = mGroup.allMonthJournals.length;
                      const avgEnergy =
                        totalEntries > 0
                          ? Math.round(
                              (mGroup.allMonthJournals.reduce((a, c) => a + c.energy_score, 0) /
                                totalEntries) *
                                10
                            ) / 10
                          : 0;
                      const avgProd =
                        totalEntries > 0
                          ? Math.round(
                              (mGroup.allMonthJournals.reduce((a, c) => a + c.productivity_score, 0) /
                                totalEntries) *
                                10
                            ) / 10
                          : 0;

                      const sortedWeeks = Array.from(mGroup.weeksMap.keys()).sort((a, b) => b - a);

                      return (
                        <div
                          key={mGroup.monthKey}
                          className="rounded-2xl border border-slate-750 bg-slate-900/60 overflow-hidden transition-all"
                        >
                          {/* Month Accordion Header */}
                          <div
                            onClick={() => toggleMonthAccordion(mGroup.monthKey)}
                            className="p-3.5 cursor-pointer flex items-center justify-between gap-3 select-none bg-slate-800/70 hover:bg-slate-800 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`p-1 rounded-lg bg-slate-750 text-slate-300 transition-transform duration-200 ${
                                  isMonthExpanded ? 'rotate-180 text-indigo-400' : ''
                                }`}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </span>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-bold text-white">
                                  {mGroup.monthLabel}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-medium">
                                  {toPersianDigits(totalEntries)} یادداشت
                                </span>
                              </div>
                            </div>

                            {/* Month Stats Badges */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className="hidden sm:flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                میانگین انرژی: {toPersianDigits(avgEnergy)}
                              </span>
                              <span className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                                <Target className="w-3.5 h-3.5 text-emerald-400" />
                                میانگین بهره‌وری: {toPersianDigits(avgProd)}
                              </span>
                            </div>
                          </div>

                          {/* Month Content: Weekly Accordions */}
                          {isMonthExpanded && (
                            <div className="p-3 space-y-2.5 bg-slate-950/40 border-t border-slate-800 animate-fadeIn">
                              {sortedWeeks.map((weekNum) => {
                                const weekKey = `${mGroup.monthKey}_w${weekNum}`;
                                const isWeekExpanded = expandedWeekKeys.has(weekKey);
                                const weekJournals = mGroup.weeksMap.get(weekNum) || [];

                                const weekLabels: Record<number, string> = {
                                  1: `هفته اول (۱ تا ۷ ${monthName})`,
                                  2: `هفته دوم (۸ تا ۱۴ ${monthName})`,
                                  3: `هفته سوم (۱۵ تا ۲۱ ${monthName})`,
                                  4: `هفته چهارم (۲۲ تا ۲۸ ${monthName})`,
                                  5: `هفته پنجم (۲۹ تا پایان ${monthName})`,
                                };
                                const weekLabel = weekLabels[weekNum] || `هفته ${toPersianDigits(weekNum)}`;

                                return (
                                  <div
                                    key={weekKey}
                                    className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden"
                                  >
                                    {/* Week Accordion Header */}
                                    <div
                                      onClick={() => toggleWeekAccordion(weekKey)}
                                      className="p-2.5 cursor-pointer flex items-center justify-between gap-2 select-none bg-slate-850/60 hover:bg-slate-800/80 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`p-1 rounded-md bg-slate-800 text-slate-400 transition-transform duration-200 ${
                                            isWeekExpanded ? 'rotate-180 text-indigo-400' : ''
                                          }`}
                                        >
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        </span>
                                        <span className="text-xs font-semibold text-slate-200">
                                          {weekLabel}
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
                                          {toPersianDigits(weekJournals.length)} روز
                                        </span>
                                      </div>
                                    </div>

                                    {/* Week Content: Individual Daily Journal Cards */}
                                    {isWeekExpanded && (
                                      <div className="p-2.5 space-y-2 border-t border-slate-800/60 bg-slate-900/40 animate-fadeIn">
                                        {weekJournals.map((j, idx) =>
                                          renderJournalCard(j, idx, weekJournals)
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // CASE B: FLAT CONTINUOUS LIST
              return (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {sortedJournals.map((j, idx) => renderJournalCard(j, idx, sortedJournals))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===================== TAB 2: HIERARCHICAL TREE NOTES ===================== */}
      {subTab === 'notes' && (
        <div className="space-y-4">
          {/* Search, Category Filter, View Mode & Accordion Toggle Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-3 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در یادداشت‌ها..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={selectedNoteCategory}
                onChange={(e) =>
                  setSelectedNoteCategory(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  )
                }
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none shrink-0"
              >
                <option value="all">همه دسته‌ها</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Switcher & Expand/Collapse */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Mode Toggle: Tree vs Month/Week */}
              <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setNoteGroupingMode('tree')}
                  className={`px-2.5 py-1 rounded-lg transition-all font-medium flex items-center gap-1.5 ${
                    noteGroupingMode === 'tree'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="نمایش درختی سلسله‌مراتبی والد و فرزند"
                >
                  <FolderTree className="w-3.5 h-3.5" />
                  <span>درخت</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNoteGroupingMode('timeline')}
                  className={`px-2.5 py-1 rounded-lg transition-all font-medium flex items-center gap-1.5 ${
                    noteGroupingMode === 'timeline'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="دسته‌بندی ماهانه و هفتگی بر اساس زمان یادداشت‌ها"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>ماهانه و هفتگی</span>
                </button>
              </div>

              {/* Expand / Collapse All Notes */}
              <button
                type="button"
                onClick={toggleAllNotesAccordion}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-750 flex items-center gap-1.5 transition-all shrink-0"
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {expandedNoteIds.size > 0 ? 'جمع‌کردن متن‌ها' : 'گسترش متن‌ها'}
                </span>
              </button>
            </div>
          </div>

          {/* Notes Content */}
          {(() => {
            const renderNoteCard = (
              parentNote: Note,
              rootIndex: number,
              rootList: Note[],
              showReorderControls: boolean = true
            ) => {
              const childNotes = parentNote.id ? getChildNotes(parentNote.id) : [];
              const isExpanded = parentNote.id ? expandedNoteIds.has(parentNote.id) : false;
              const cat = categories.find((c) => c.id === parentNote.category_id);

              return (
                <div
                  key={parentNote.id}
                  draggable={showReorderControls}
                  onDragStart={(e) => {
                    if (showReorderControls && parentNote.id) {
                      e.dataTransfer.setData('text/plain', parentNote.id.toString());
                      setDraggedNoteId(parentNote.id);
                    }
                  }}
                  onDragOver={(e) => {
                    if (showReorderControls) {
                      e.preventDefault();
                      if (parentNote.id && parentNote.id !== draggedNoteId) {
                        setDragOverNoteId(parentNote.id);
                      }
                    }
                  }}
                  onDragLeave={() => {
                    if (showReorderControls && parentNote.id && dragOverNoteId === parentNote.id) {
                      setDragOverNoteId(null);
                    }
                  }}
                  onDrop={(e) => {
                    if (showReorderControls) {
                      e.preventDefault();
                      if (parentNote.id) handleDropNote(parentNote.id);
                    }
                  }}
                  onDragEnd={() => {
                    if (showReorderControls) {
                      setDraggedNoteId(null);
                      setDragOverNoteId(null);
                    }
                  }}
                  className={`bg-slate-900/90 border rounded-3xl overflow-hidden shadow-sm transition-all ${
                    showReorderControls && dragOverNoteId === parentNote.id
                      ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                      : 'border-slate-800 hover:border-slate-750'
                  } ${showReorderControls && draggedNoteId === parentNote.id ? 'opacity-40 scale-[0.99]' : ''}`}
                >
                  {/* Note Accordion Header */}
                  <div
                    onClick={() => parentNote.id && toggleNoteAccordion(parentNote.id)}
                    className="p-3.5 cursor-pointer flex items-center justify-between gap-3 select-none"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {/* Chevron toggle */}
                      <span
                        className={`p-1 rounded-lg bg-slate-800 text-slate-400 transition-transform duration-200 shrink-0 ${
                          isExpanded ? 'rotate-180 text-indigo-400' : ''
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                            {parentNote.title}
                          </h4>

                          {cat && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                              style={{
                                backgroundColor: `${cat.color}20`,
                                color: cat.color,
                              }}
                            >
                              {cat.title}
                            </span>
                          )}

                          {childNotes.length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {toPersianDigits(childNotes.length)} زیر‌یادداشت
                            </span>
                          )}

                          <span className="text-[10px] text-slate-500 font-mono">
                            {toPersianDigits(parentNote.updated_at_jalali?.split(' ')[0] || '')}
                          </span>
                        </div>

                        {/* Truncated snippet when collapsed */}
                        {!isExpanded && (
                          <p className="text-xs text-slate-400 truncate max-w-md mt-0.5">
                            {parentNote.content || <span className="italic text-slate-500">(بدون متن)</span>}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Reorder Buttons & Actions */}
                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {showReorderControls && (
                        <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/50">
                          <button
                            type="button"
                            disabled={rootIndex === 0}
                            onClick={() => parentNote.id && handleMoveNote(parentNote.id, 'up')}
                            className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-400 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                            title="انتقال به بالا"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={rootIndex === rootList.length - 1}
                            onClick={() => parentNote.id && handleMoveNote(parentNote.id, 'down')}
                            className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-400 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
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
                      )}

                      <button
                        onClick={() => parentNote.id && openAddNoteModal(parentNote.id)}
                        className="p-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors"
                        title="افزودن زیرمجموعه"
                      >
                        <CornerDownLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditNoteModal(parentNote)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="ویرایش"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => parentNote.id && setNoteToDelete({ id: parentNote.id, title: parentNote.title })}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Accordion Panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-slate-900/50 space-y-3 animate-fadeIn">
                      {parentNote.content ? (
                        <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-750">
                          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                            {parentNote.content}
                          </p>
                        </div>
                      ) : null}

                      <span className="text-[10px] text-slate-500 font-mono block">
                        آخرین ویرایش: {toPersianDigits(parentNote.updated_at_jalali)}
                      </span>

                      {/* Nested Child Notes (Hierarchical Sub-Tree) */}
                      {childNotes.length > 0 && (
                        <div className="mr-4 space-y-2 pt-2 border-r-2 border-indigo-500/30 pr-3">
                          <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1 mb-1">
                            <Layers className="w-3.5 h-3.5" />
                            زیرمجموعه‌ها ({toPersianDigits(childNotes.length)}):
                          </div>

                          {childNotes.map((child, childIdx) => (
                            <div
                              key={child.id}
                              className="bg-slate-800/70 border border-slate-750 p-3 rounded-2xl flex items-start justify-between gap-3 hover:border-slate-700 transition-all"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-xs font-bold text-indigo-200">
                                  {child.title}
                                </h5>
                                <p className="text-xs text-slate-300 mt-1 whitespace-pre-line leading-relaxed">
                                  {child.content}
                                </p>
                                <span className="text-[9px] text-slate-500 font-mono mt-1 block">
                                  ویرایش: {toPersianDigits(child.updated_at_jalali)}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {showReorderControls && (
                                  <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700/50">
                                    <button
                                      type="button"
                                      disabled={childIdx === 0}
                                      onClick={() => child.id && handleMoveNote(child.id, 'up')}
                                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-indigo-400 disabled:opacity-25 transition-colors"
                                      title="انتقال به بالا"
                                    >
                                      <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={childIdx === childNotes.length - 1}
                                      onClick={() => child.id && handleMoveNote(child.id, 'down')}
                                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-indigo-400 disabled:opacity-25 transition-colors"
                                      title="انتقال به پایین"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}

                                <button
                                  onClick={() => openEditNoteModal(child)}
                                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
                                  title="ویرایش"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => child.id && setNoteToDelete({ id: child.id, title: child.title })}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            };

            // MODE A: TREE VIEW
            if (noteGroupingMode === 'tree') {
              const filteredRootNotes = rootNotes.filter((n) => {
                if (
                  selectedNoteCategory !== 'all' &&
                  n.category_id !== selectedNoteCategory
                )
                  return false;
                if (
                  searchQuery &&
                  !n.title.includes(searchQuery) &&
                  !n.content.includes(searchQuery)
                )
                  return false;
                return true;
              });

              if (filteredRootNotes.length === 0) {
                return (
                  <div className="text-center py-12 bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-6">
                    <FolderTree className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">یادداشتی در این بخش یافت نشد.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      می‌توانید یادداشت جدید یا زیرمجموعه ایجاد کنید.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-2.5">
                  {filteredRootNotes.map((parentNote, rootIndex, rootList) =>
                    renderNoteCard(parentNote, rootIndex, rootList, true)
                  )}
                </div>
              );
            }

            // MODE B: MONTHLY & WEEKLY HIERARCHICAL GROUPING
            const filteredAllNotes = notes.filter((n) => {
              if (
                selectedNoteCategory !== 'all' &&
                n.category_id !== selectedNoteCategory
              )
                return false;
              if (
                searchQuery &&
                !n.title.includes(searchQuery) &&
                !n.content.includes(searchQuery)
              )
                return false;
              return true;
            });

            if (filteredAllNotes.length === 0) {
              return (
                <div className="text-center py-12 bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-6">
                  <CalendarDays className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">یادداشتی برای نمایش ماهانه/هفتگی یافت نشد.</p>
                </div>
              );
            }

            interface NoteMonthData {
              monthKey: string;
              year: number;
              month: number;
              monthLabel: string;
              weeksMap: Map<number, Note[]>;
              allNotes: Note[];
            }
            const noteMonthsMap = new Map<string, NoteMonthData>();
            filteredAllNotes.forEach((n) => {
              const rawDate = (n.updated_at_jalali || getTodayJalali()).split(' ')[0];
              const parts = rawDate.split('/');
              const y = parseInt(parts[0], 10) || 1405;
              const m = parseInt(parts[1], 10) || 1;
              const d = parseInt(parts[2], 10) || 1;
              const mKey = `${parts[0]}/${parts[1]}`;
              const { weekNum } = getMonthlyCalendarWeek(d);

              if (!noteMonthsMap.has(mKey)) {
                const mName = PERSIAN_MONTHS[m - 1] || 'ماه';
                noteMonthsMap.set(mKey, {
                  monthKey: mKey,
                  year: y,
                  month: m,
                  monthLabel: `${mName} ${toPersianDigits(y)}`,
                  weeksMap: new Map(),
                  allNotes: [],
                });
              }
              const mData = noteMonthsMap.get(mKey)!;
              mData.allNotes.push(n);
              if (!mData.weeksMap.has(weekNum)) {
                mData.weeksMap.set(weekNum, []);
              }
              mData.weeksMap.get(weekNum)!.push(n);
            });

            const sortedMonthKeys = Array.from(noteMonthsMap.keys()).sort((a, b) =>
              b.localeCompare(a)
            );

            return (
              <div className="space-y-3">
                {sortedMonthKeys.map((mKey) => {
                  const mData = noteMonthsMap.get(mKey)!;
                  const isMonthExpanded = expandedNoteMonthKeys.has(mKey);
                  const sortedWeekNums = Array.from(mData.weeksMap.keys()).sort((a, b) => b - a);

                  return (
                    <div
                      key={mKey}
                      className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-all"
                    >
                      {/* Month Accordion Header */}
                      <div
                        onClick={() => toggleNoteMonthAccordion(mKey)}
                        className="p-3.5 bg-slate-850/90 cursor-pointer flex items-center justify-between gap-3 select-none hover:bg-slate-800 transition-colors border-b border-slate-800/60"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`p-1.5 rounded-xl bg-slate-800 text-slate-300 transition-transform duration-200 ${
                              isMonthExpanded ? 'rotate-180 text-indigo-400' : ''
                            }`}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </span>
                          <span className="font-bold text-sm text-white flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-400" />
                            {mData.monthLabel}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                            {toPersianDigits(mData.allNotes.length)} یادداشت
                          </span>
                        </div>
                      </div>

                      {/* Month Expanded Body (Weeks) */}
                      {isMonthExpanded && (
                        <div className="p-3 space-y-2.5 bg-slate-950/40">
                          {sortedWeekNums.map((wNum) => {
                            const weekNotes = mData.weeksMap.get(wNum) || [];
                            const wKey = `${mKey}_w${wNum}`;
                            const isWeekExpanded = expandedNoteWeekKeys.has(wKey);
                            const weekLabels: Record<number, string> = {
                              1: 'هفته اول (۱ تا ۷)',
                              2: 'هفته دوم (۸ تا ۱۴)',
                              3: 'هفته سوم (۱۵ تا ۲۱)',
                              4: 'هفته چهارم (۲۲ تا ۲۸)',
                              5: 'هفته پنجم (۲۹ به بعد)',
                            };

                            return (
                              <div
                                key={wKey}
                                className="border border-slate-800/80 rounded-2xl overflow-hidden bg-slate-900/60 transition-all"
                              >
                                <div
                                  onClick={() => toggleNoteWeekAccordion(wKey)}
                                  className="px-3.5 py-2.5 bg-slate-800/50 cursor-pointer flex items-center justify-between gap-2 select-none hover:bg-slate-800/80 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`p-1 rounded-lg bg-slate-800 text-slate-400 transition-transform duration-150 ${
                                        isWeekExpanded ? 'rotate-180 text-indigo-400' : ''
                                      }`}
                                    >
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="text-xs font-semibold text-slate-200">
                                      {weekLabels[wNum] || `هفته ${toPersianDigits(wNum)}`}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                                    {toPersianDigits(weekNotes.length)} یادداشت
                                  </span>
                                </div>

                                {isWeekExpanded && (
                                  <div className="p-2.5 space-y-2 border-t border-slate-800/60 bg-slate-900/40 animate-fadeIn">
                                    {weekNotes.map((note, idx) =>
                                      renderNoteCard(note, idx, weekNotes, false)
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Note Add/Edit Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingNote
                  ? 'ویرایش یادداشت'
                  : noteParentId
                  ? 'افزودن زیر‌یادداشت (فرزند)'
                  : 'تعریف یادداشت اصلی'}
              </h3>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  عنوان یادداشت *
                </label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="مثلاً: ایده‌های خلاقانه محصول..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  دسته‌بندی
                </label>
                <select
                  value={noteCategoryId}
                  onChange={(e) => setNoteCategoryId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  متن و جزئیات یادداشت
                </label>
                <textarea
                  rows={5}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="متن کامل، نکات کلیدی، لینک‌ها یا خلاصه اطلاعات..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-2xl p-3.5 text-xs leading-relaxed focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/30"
                >
                  {editingNote ? 'ذخیره تغییرات' : 'افزودن یادداشت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Journal Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!journalToDelete}
        title="حذف یادداشت روزانه"
        itemName={journalToDelete ? `یادداشت روز ${toPersianDigits(journalToDelete.date)}` : ''}
        message="آیا از حذف کامل این یادداشت روزانه اطمینان دارید؟ این عملیات غیرقابل بازگشت است."
        onConfirm={confirmDeleteJournal}
        onCancel={() => setJournalToDelete(null)}
      />

      {/* Note Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!noteToDelete}
        title="حذف یادداشت"
        itemName={noteToDelete?.title || ''}
        message="آیا از حذف این یادداشت اطمینان دارید؟ در صورت داشتن زیرمجموعه، زیرمجموعه‌ها نیز تحت تاثیر قرار خواهند گرفت."
        onConfirm={async () => {
          if (noteToDelete) {
            await onDeleteNote(noteToDelete.id);
            soundFx.playDelete();
            setNoteToDelete(null);
          }
        }}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
};
