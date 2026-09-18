import React, { useState } from 'react';
import { X, Plus, Trash2, Tag, Check, Palette, Bookmark, Edit2 } from 'lucide-react';
import { Category, Attribute } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onAddCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  onUpdateCategory?: (category: Category) => Promise<void>;
  onDeleteCategory: (categoryId: number) => Promise<void>;
  onSelectCategory?: (categoryId: number) => void;
  attributes?: Attribute[];
  onAddAttribute?: (attribute: Omit<Attribute, 'id'>) => Promise<void>;
  onUpdateAttribute?: (attribute: Attribute) => Promise<void>;
  onDeleteAttribute?: (attributeId: number) => Promise<void>;
  initialTab?: 'categories' | 'attributes';
}

export const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ef4444', // red
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#f97316', // orange
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onSelectCategory,
  attributes = [],
  onAddAttribute,
  onUpdateAttribute,
  onDeleteAttribute,
  initialTab = 'categories',
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'attributes'>(initialTab);

  // Category Form
  const [newCatTitle, setNewCatTitle] = useState('');
  const [selectedCatColor, setSelectedCatColor] = useState(PRESET_COLORS[0]);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatColor, setEditingCatColor] = useState<string>(PRESET_COLORS[0]);

  // Attribute Form
  const [newAttrTitle, setNewAttrTitle] = useState('');
  const [selectedAttrColor, setSelectedAttrColor] = useState(PRESET_COLORS[2]);
  const [editingAttrId, setEditingAttrId] = useState<number | null>(null);
  const [editingAttrColor, setEditingAttrColor] = useState<string>(PRESET_COLORS[2]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Confirm delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'category' | 'attribute';
    id: number;
    title: string;
  } | null>(null);

  if (!isOpen) return null;

  // Handle Add Category
  const handleAddCat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatTitle.trim();
    if (!trimmed) return;

    if (categories.some((c) => c.title.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('این دسته‌بندی قبلاً اضافه شده است');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onAddCategory({
        title: trimmed,
        color: selectedCatColor,
        icon: 'Tag',
      });
      setNewCatTitle('');
    } catch {
      setErrorMsg('خطا در ثبت دسته‌بندی');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Category Color Update
  const handleChangeCatColor = async (cat: Category, newColor: string) => {
    if (onUpdateCategory && cat.id) {
      await onUpdateCategory({ ...cat, color: newColor });
      setEditingCatId(null);
    }
  };

  // Handle Add Attribute
  const handleAddAttr = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAttrTitle.trim();
    if (!trimmed || !onAddAttribute) return;

    if (attributes.some((a) => a.title.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('این برچسب/ویژگی قبلاً ثبت شده است');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onAddAttribute({
        title: trimmed,
        color: selectedAttrColor,
        icon: 'Tag',
      });
      setNewAttrTitle('');
    } catch {
      setErrorMsg('خطا در ثبت ویژگی');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Attribute Color Update
  const handleChangeAttrColor = async (attr: Attribute, newColor: string) => {
    if (onUpdateAttribute && attr.id) {
      await onUpdateAttribute({ ...attr, color: newColor });
      setEditingAttrId(null);
    }
  };

  const handleDeleteCategory = async (catId: number) => {
    if (categories.length <= 1) {
      setErrorMsg('حداقل باید یک دسته‌بندی در برنامه باقی بماند');
      return;
    }
    setErrorMsg('');
    await onDeleteCategory(catId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">مدیریت دسته‌ها و برچسب‌ها</h3>
              <p className="text-[11px] text-slate-400">
                شخصی‌سازی عناوین و پالت رنگی اختصاصی
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-1 border-b border-slate-800/80 bg-slate-900/60">
          <button
            type="button"
            onClick={() => {
              setActiveTab('categories');
              setErrorMsg('');
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'categories'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>دسته‌بندی‌ها ({categories.length})</span>
          </button>

          {onAddAttribute && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('attributes');
                setErrorMsg('');
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'attributes'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white bg-slate-800/50'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>ویژگی‌ها و برچسب‌ها ({attributes.length})</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs text-center">
              {errorMsg}
            </div>
          )}

          {/* ================= CATEGORIES TAB ================= */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              {/* Add Category Form */}
              <form
                onSubmit={handleAddCat}
                className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-2xl space-y-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCatTitle}
                    onChange={(e) => setNewCatTitle(e.target.value)}
                    placeholder="عنوان دسته‌بندی جدید (مثلاً: پروژه‌ها، کتاب، ورزش...)"
                    className="flex-1 bg-slate-850 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !newCatTitle.trim()}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1 transition-colors shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن دسته</span>
                  </button>
                </div>

                {/* Color Selection */}
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1.5 flex items-center gap-1">
                    <Palette className="w-3 h-3 text-slate-400" />
                    انتخاب رنگ دسته:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedCatColor(color)}
                        className={`w-6 h-6 rounded-lg transition-transform flex items-center justify-center ${
                          selectedCatColor === color
                            ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {selectedCatColor === color && (
                          <Check className="w-3.5 h-3.5 text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              {/* Categories List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                  <span>دسته‌بندی‌های فعال</span>
                  <span className="text-[10px] text-slate-500">برای تغییر رنگ روی دایره کلیک کنید</span>
                </div>

                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/70 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-2.5 flex-1 cursor-pointer"
                          onClick={() => {
                            if (cat.id && onSelectCategory) {
                              onSelectCategory(cat.id);
                              onClose();
                            }
                          }}
                        >
                          <span
                            className="w-4 h-4 rounded-full shrink-0 shadow"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-xs font-semibold text-slate-200">
                            {cat.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (editingCatId === cat.id) {
                                setEditingCatId(null);
                              } else {
                                setEditingCatId(cat.id || null);
                                setEditingCatColor(cat.color);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title="تغییر رنگ دسته"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (!cat.id) return;
                              if (categories.length <= 1) {
                                setErrorMsg('حداقل باید یک دسته‌بندی در برنامه باقی بماند');
                                return;
                              }
                              setDeleteTarget({ type: 'category', id: cat.id, title: cat.title });
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="حذف این دسته"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Color Palette expansion when editing */}
                      {editingCatId === cat.id && (
                        <div className="pt-2 border-t border-slate-750 flex items-center gap-2 flex-wrap animate-fadeIn">
                          <span className="text-[10px] text-slate-400">رنگ جدید:</span>
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleChangeCatColor(cat, c)}
                              className={`w-5 h-5 rounded-md transition-transform ${
                                cat.color === c ? 'scale-110 ring-2 ring-white' : 'hover:scale-105'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= ATTRIBUTES TAB ================= */}
          {activeTab === 'attributes' && (
            <div className="space-y-4">
              {/* Add Attribute Form */}
              <form
                onSubmit={handleAddAttr}
                className="bg-slate-800/60 border border-slate-700/60 p-3.5 rounded-2xl space-y-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newAttrTitle}
                    onChange={(e) => setNewAttrTitle(e.target.value)}
                    placeholder="عنوان برچسب جدید (مثلاً: تماس ضروری، مطالعه، سبک...)"
                    className="flex-1 bg-slate-850 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !newAttrTitle.trim()}
                    className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1 transition-colors shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن برچسب</span>
                  </button>
                </div>

                {/* Attribute Color Selection */}
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1.5 flex items-center gap-1">
                    <Palette className="w-3 h-3 text-slate-400" />
                    انتخاب رنگ برچسب:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedAttrColor(color)}
                        className={`w-6 h-6 rounded-lg transition-transform flex items-center justify-center ${
                          selectedAttrColor === color
                            ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {selectedAttrColor === color && (
                          <Check className="w-3.5 h-3.5 text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              {/* Attributes List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                  <span>برچسب‌های موجود</span>
                  <span className="text-[10px] text-slate-500">مشترک در وظایف و آنالیز</span>
                </div>

                <div className="space-y-2">
                  {attributes.map((attr) => (
                    <div
                      key={attr.id}
                      className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/70 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: attr.color || '#8b5cf6' }}
                          />
                          <span className="text-xs font-semibold text-slate-200">
                            {attr.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (editingAttrId === attr.id) {
                                setEditingAttrId(null);
                              } else {
                                setEditingAttrId(attr.id || null);
                                setEditingAttrColor(attr.color || '#8b5cf6');
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                            title="تغییر رنگ برچسب"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {onDeleteAttribute && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!attr.id) return;
                                setDeleteTarget({ type: 'attribute', id: attr.id, title: attr.title });
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="حذف این برچسب"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Attribute color palette when editing */}
                      {editingAttrId === attr.id && (
                        <div className="pt-2 border-t border-slate-750 flex items-center gap-2 flex-wrap animate-fadeIn">
                          <span className="text-[10px] text-slate-400">رنگ جدید:</span>
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleChangeAttrColor(attr, c)}
                              className={`w-5 h-5 rounded-md transition-transform ${
                                (attr.color || '#8b5cf6') === c
                                  ? 'scale-110 ring-2 ring-white'
                                  : 'hover:scale-105'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium"
          >
            بستن
          </button>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        title={deleteTarget?.type === 'category' ? 'تایید حذف دسته‌بندی' : 'تایید حذف برچسب'}
        itemName={deleteTarget?.title}
        message={
          deleteTarget?.type === 'category'
            ? 'آیا از حذف این دسته‌بندی اطمینان دارید؟ تمام وظایف و عادات مرتبط ممکن است به دسته‌بندی پیش‌فرض منتقل شوند.'
            : 'آیا از حذف این ویژگی/برچسب اطمینان دارید؟'
        }
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'category') {
            await handleDeleteCategory(deleteTarget.id);
          } else if (onDeleteAttribute) {
            await onDeleteAttribute(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
