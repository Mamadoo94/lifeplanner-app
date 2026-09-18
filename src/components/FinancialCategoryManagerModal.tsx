import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Palette,
  Tag,
  AlertTriangle,
  ShoppingBag,
  Car,
  Home,
  Coffee,
  HeartPulse,
  BookOpen,
  Briefcase,
  Zap,
  TrendingUp,
  DollarSign,
  PlusCircle,
  CreditCard,
  Landmark,
  Film,
  Gift,
  Wrench,
  Utensils,
  Plane,
  Sparkles,
  Smartphone,
  Shield,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  MoreHorizontal,
  FolderPlus,
} from 'lucide-react';
import { FinanceCategory, FinanceTransaction, TransactionType } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { soundFx } from '../utils/audio';

interface FinancialCategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: FinanceCategory[];
  transactions: FinanceTransaction[];
  onAddCategory: (category: Omit<FinanceCategory, 'id'>) => Promise<void>;
  onUpdateCategory: (category: FinanceCategory) => Promise<void>;
  onDeleteCategory: (categoryId: number) => Promise<void>;
  onReassignAndDeleteCategory: (
    oldCatId: number,
    oldCatName: string,
    newCatName: string,
    newCatId?: number
  ) => Promise<void>;
}

export const CATEGORY_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
  '#64748b', // slate
];

export const CATEGORY_ICONS: { name: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: 'ShoppingBag', label: 'خرید و فروشگاه', icon: ShoppingBag },
  { name: 'Utensils', label: 'رستوران و غذا', icon: Utensils },
  { name: 'Coffee', label: 'کافه و نوشیدنی', icon: Coffee },
  { name: 'Car', label: 'حمل‌ونقل و خودرو', icon: Car },
  { name: 'Home', label: 'مسکن و قبوض', icon: Home },
  { name: 'HeartPulse', label: 'سلامت و درمان', icon: HeartPulse },
  { name: 'Tag', label: 'پوشاک و مد', icon: Tag },
  { name: 'BookOpen', label: 'آموزش و کتاب', icon: BookOpen },
  { name: 'Briefcase', label: 'شغل و حقوق', icon: Briefcase },
  { name: 'TrendingUp', label: 'سرمایه‌گذاری و سود', icon: TrendingUp },
  { name: 'CreditCard', label: 'اقساط و کارت', icon: CreditCard },
  { name: 'Landmark', label: 'بانک و وام', icon: Landmark },
  { name: 'Zap', label: 'پاداش و درآمد جانبی', icon: Zap },
  { name: 'Smartphone', label: 'اینترنت و شارژ', icon: Smartphone },
  { name: 'Plane', label: 'سفر و گردشگری', icon: Plane },
  { name: 'Film', label: 'سرگرمی و سینما', icon: Film },
  { name: 'Gift', label: 'هدیه و کادو', icon: Gift },
  { name: 'Wrench', label: 'تعمیرات و خدمات', icon: Wrench },
  { name: 'Shield', label: 'بیمه و تضمین', icon: Shield },
  { name: 'Sparkles', label: 'زیبایی و مراقبت', icon: Sparkles },
  { name: 'DollarSign', label: 'ارز و دارایی', icon: DollarSign },
  { name: 'MoreHorizontal', label: 'سایر و متفرقه', icon: MoreHorizontal },
];

export function renderCategoryIcon(iconName?: string, className: string = 'w-4 h-4') {
  const found = CATEGORY_ICONS.find((i) => i.name === iconName);
  if (found) {
    const IconComp = found.icon;
    return <IconComp className={className} />;
  }
  return <ShoppingBag className={className} />;
}

export const FinancialCategoryManagerModal: React.FC<FinancialCategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  transactions,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReassignAndDeleteCategory,
}) => {
  const [activeTypeTab, setActiveTypeTab] = useState<TransactionType>('expense');

  // Form Mode
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinanceCategory | null>(null);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formColor, setFormColor] = useState(CATEGORY_COLORS[0]);
  const [formIcon, setFormIcon] = useState('ShoppingBag');
  const [formSubcategories, setFormSubcategories] = useState<string[]>([]);
  const [newSubcatInput, setNewSubcatInput] = useState('');
  const [formError, setFormError] = useState('');

  // Reassignment Modal State (Smart Fallback on deletion)
  const [reassignState, setReassignState] = useState<{
    targetCat: FinanceCategory;
    affectedCount: number;
    replacementCatName: string;
  } | null>(null);

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) => c.type === activeTypeTab);

  // Reset form
  const resetForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    setFormTitle('');
    setFormColor(CATEGORY_COLORS[0]);
    setFormIcon('ShoppingBag');
    setFormSubcategories([]);
    setNewSubcatInput('');
    setFormError('');
  };

  const handleStartAdd = () => {
    resetForm();
    setIsFormOpen(true);
    setFormColor(activeTypeTab === 'expense' ? '#f59e0b' : '#10b981');
    setFormIcon(activeTypeTab === 'expense' ? 'ShoppingBag' : 'Briefcase');
  };

  const handleStartEdit = (cat: FinanceCategory) => {
    setEditingCategory(cat);
    setFormTitle(cat.title);
    setFormColor(cat.color || CATEGORY_COLORS[0]);
    setFormIcon(cat.icon || 'ShoppingBag');
    setFormSubcategories(cat.subcategories ? [...cat.subcategories] : []);
    setIsFormOpen(true);
    setFormError('');
  };

  const handleAddSubcategory = () => {
    const trimmed = newSubcatInput.trim();
    if (!trimmed) return;
    if (formSubcategories.includes(trimmed)) {
      setFormError('این زیردسته قبلاً اضافه شده است.');
      return;
    }
    setFormSubcategories([...formSubcategories, trimmed]);
    setNewSubcatInput('');
    setFormError('');
  };

  const handleRemoveSubcategory = (sub: string) => {
    setFormSubcategories(formSubcategories.filter((s) => s !== sub));
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const titleTrimmed = formTitle.trim();
    if (!titleTrimmed) {
      setFormError('عنوان دسته‌بندی الزامی است.');
      return;
    }

    // Check duplicate name in same type
    const isDuplicate = categories.some(
      (c) =>
        c.type === activeTypeTab &&
        c.title.trim().toLowerCase() === titleTrimmed.toLowerCase() &&
        c.id !== editingCategory?.id
    );

    if (isDuplicate) {
      setFormError('دسته‌بندی با این عنوان در این بخش وجود دارد.');
      return;
    }

    try {
      if (editingCategory && editingCategory.id) {
        await onUpdateCategory({
          ...editingCategory,
          title: titleTrimmed,
          color: formColor,
          icon: formIcon,
          subcategories: formSubcategories,
        });
      } else {
        await onAddCategory({
          title: titleTrimmed,
          type: activeTypeTab,
          color: formColor,
          icon: formIcon,
          subcategories: formSubcategories,
        });
      }
      soundFx.playAdd();
      resetForm();
    } catch {
      setFormError('خطا در ذخیره دسته‌بندی.');
    }
  };

  // Smart Fallback Deletion check
  const handleDeleteClick = (cat: FinanceCategory) => {
    if (!cat.id) return;

    // Count affected transactions
    const affected = transactions.filter(
      (tx) =>
        (tx.category_id && tx.category_id === cat.id) ||
        (tx.category_name && tx.category_name.trim() === cat.title.trim())
    );

    if (affected.length === 0) {
      // Safe to delete directly
      onDeleteCategory(cat.id);
      soundFx.playDelete();
    } else {
      // Find candidate replacement categories of same type
      const candidates = categories.filter((c) => c.type === cat.type && c.id !== cat.id);
      const fallbackName = candidates[0]?.title || (cat.type === 'expense' ? 'سایر هزینه‌ها' : 'سایر واریزها');

      setReassignState({
        targetCat: cat,
        affectedCount: affected.length,
        replacementCatName: fallbackName,
      });
    }
  };

  const handleConfirmReassignAndDelete = async () => {
    if (!reassignState || !reassignState.targetCat.id) return;
    const { targetCat, replacementCatName } = reassignState;

    const replacementCat = categories.find(
      (c) => c.type === targetCat.type && c.title.trim() === replacementCatName.trim()
    );

    await onReassignAndDeleteCategory(
      targetCat.id,
      targetCat.title,
      replacementCatName,
      replacementCat?.id
    );

    soundFx.playComplete();
    setReassignState(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto text-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">مدیریت دسته‌بندی‌ها و زیردسته‌ها</h2>
              <p className="text-xs text-slate-400">شخصی‌سازی رنگ، آیکون و تفکیک هزینه‌ها و درآمدها</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Type Selector Tabs */}
        <div className="px-4 sm:px-5 pt-3 flex items-center justify-between border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTypeTab('expense');
                resetForm();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTypeTab === 'expense'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>هزینه‌ها (برداشت)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTypeTab('income');
                resetForm();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTypeTab === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>درآمدها (واریز)</span>
            </button>
          </div>

          {!isFormOpen && (
            <button
              type="button"
              onClick={handleStartAdd}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>دسته‌بندی جدید</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Add / Edit Category Form Panel */}
          {isFormOpen && (
            <form onSubmit={handleSaveCategory} className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <FolderPlus className="w-4 h-4" />
                  {editingCategory ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی جدید'} ({activeTypeTab === 'expense' ? 'هزینه' : 'درآمد'})
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  انصراف
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title & Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">عنوان دسته‌بندی اصلی</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="مثال: خوراک و سوپرمارکت"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">پیش‌نمایش نماد و رنگ</label>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 h-[38px]">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: formColor }}
                    >
                      {renderCategoryIcon(formIcon, 'w-3.5 h-3.5')}
                    </div>
                    <span className="text-xs font-bold text-slate-200 truncate">
                      {formTitle.trim() || 'عنوان دسته‌بندی'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Color Palette Picker */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">رنگ شاخص در نمودارها</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center ${
                        formColor === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {formColor === c && <Check className="w-3 h-3 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">آیکون شاخص</label>
                <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-900 border border-slate-800 rounded-xl">
                  {CATEGORY_ICONS.map((item) => {
                    const IconComp = item.icon;
                    const isSelected = formIcon === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        title={item.label}
                        onClick={() => setFormIcon(item.name)}
                        className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subcategories Editor */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">زیردسته‌های این گروه (اختیاری)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newSubcatInput}
                    onChange={(e) => setNewSubcatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubcategory();
                      }
                    }}
                    placeholder="مثلاً: سوپرمارکت، رستوران، میوه..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubcategory}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن</span>
                  </button>
                </div>

                {/* Subcategories Chips */}
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-900/60 border border-slate-800/80 rounded-xl">
                  {formSubcategories.length === 0 ? (
                    <span className="text-[11px] text-slate-500 italic">هنوز زیردسته‌ای تعریف نشده است.</span>
                  ) : (
                    formSubcategories.map((sub) => (
                      <span
                        key={sub}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-300"
                      >
                        <span>{sub}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubcategory(sub)}
                          className="hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Submit / Cancel buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingCategory ? 'ثبت تغییرات' : 'افزودن دسته‌بندی'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Categories List */}
          <div className="space-y-2.5">
            {filteredCategories.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                <Layers className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                <p className="text-xs">هیچ دسته‌بندی در این بخش ثبت نشده است.</p>
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const txCount = transactions.filter(
                  (t) =>
                    (t.category_id && t.category_id === cat.id) ||
                    (t.category_name && t.category_name.trim() === cat.title.trim())
                ).length;

                return (
                  <div
                    key={cat.id}
                    className="p-3 bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 rounded-2xl transition-all flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                          style={{ backgroundColor: cat.color || '#3b82f6' }}
                        >
                          {renderCategoryIcon(cat.icon, 'w-4 h-4')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-200">
                              {cat.title}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                              {toPersianDigits(txCount)} تراکنش
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/50 rounded-lg transition-colors"
                          title="ویرایش"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(cat)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Subcategories list */}
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/50">
                        <span className="text-[10px] text-slate-500 font-medium">زیردسته‌ها:</span>
                        {cat.subcategories.map((sub) => (
                          <span
                            key={sub}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            تعداد کل: {toPersianDigits(filteredCategories.length)} دسته‌بندی
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
          >
            بستن
          </button>
        </div>

        {/* Smart Fallback Reassignment Modal */}
        {reassignState && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm">
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 text-slate-100">
              <div className="flex items-center gap-3 text-amber-400">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">انتقال هوشمند تراکنش‌های متصل</h3>
                  <p className="text-xs text-slate-400">جلوگیری از بی‌دسته‌بندی شدن تراکنش‌ها</p>
                </div>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                دسته‌بندی <strong className="text-amber-300">«{reassignState.targetCat.title}»</strong> دارای{' '}
                <strong className="text-white font-mono">{toPersianDigits(reassignState.affectedCount)}</strong> تراکنش
                ثبت‌شده است. برای حفظ یکپارچگی گزارش‌ها، تراکنش‌ها را به دسته‌بندی زیر منتقل کنید:
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">انتخاب دسته‌بندی جایگزین:</label>
                <select
                  value={reassignState.replacementCatName}
                  onChange={(e) =>
                    setReassignState({
                      ...reassignState,
                      replacementCatName: e.target.value,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {categories
                    .filter((c) => c.type === reassignState.targetCat.type && c.id !== reassignState.targetCat.id)
                    .map((c) => (
                      <option key={c.id} value={c.title}>
                        {c.title}
                      </option>
                    ))}
                  <option value={reassignState.targetCat.type === 'expense' ? 'سایر هزینه‌ها' : 'سایر واریزها'}>
                    {reassignState.targetCat.type === 'expense' ? 'سایر هزینه‌ها (عمومی)' : 'سایر واریزها (عمومی)'}
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignState(null)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReassignAndDelete}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>انتقال و حذف دسته‌بندی</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
