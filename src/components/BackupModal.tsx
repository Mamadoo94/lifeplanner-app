import React, { useState } from 'react';
import { X, HardDriveDownload, Upload, Check, AlertTriangle, FileJson, GitMerge, RefreshCw } from 'lucide-react';
import { dbInstance } from '../db/indexedDB';
import { toPersianDigits } from '../utils/jalali';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
}) => {
  const [importStatus, setImportStatus] = useState<string>('');
  const [isError, setIsError] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      const json = await dbInstance.exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lifeplanner_backup_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsError(false);
      setImportStatus('فایل پشتیبان با موفقیت دانلود شد');
      setTimeout(() => setImportStatus(''), 4000);
    } catch {
      setIsError(true);
      setImportStatus('خطا در خروجی گرفتن از پایگاه داده');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const result = await dbInstance.importData(text, restoreMode);
        setIsProcessing(false);
        if (result.success) {
          setIsError(false);
          const { added, updated, preserved } = result.stats;
          if (restoreMode === 'merge') {
            setImportStatus(
              `ادغام هوشمند با موفقیت انجام شد: ${toPersianDigits(added)} مورد جدید اضافه شد، ${toPersianDigits(updated)} وضعیت به‌روزرسانی شد و ${toPersianDigits(preserved)} مورد قبلی حفظ گردید.`
            );
          } else {
            setImportStatus(`تمام داده‌ها با موفقیت جایگزین شدند (${toPersianDigits(added)} رکورد).`);
          }
          onDataRestored();
          setTimeout(() => {
            setImportStatus('');
            onClose();
          }, 2500);
        } else {
          setIsError(true);
          setImportStatus('فرمت فایل پشتیبان نامعتبر است.');
        }
      } catch {
        setIsProcessing(false);
        setIsError(true);
        setImportStatus('خطا در خواندن یا پردازش فایل پشتیبان.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDriveDownload className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">پشتیبان‌گیری و ادغام هوشمند داده‌ها</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-white"
            aria-label="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-400 leading-relaxed">
            تمامی اطلاعات شما در دیتابیس لوکال ذخیره می‌شود. با قابلیت <strong>«ادغام هوشمند (Smart Merge)»</strong>، می‌توانید فایل پشتیبان گوشی یا سیستم دیگر را وارد کنید؛ اطلاعات قبلی شما پاک نمی‌شود و موارد جدید یا تیک‌خورده به‌طور خودکار ادغام می‌شوند.
          </p>

          {/* Mode Selector */}
          <div className="p-3 bg-slate-850 rounded-2xl border border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-300 block">
              نحوه بازیابی اطلاعات:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRestoreMode('merge')}
                className={`p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 ${
                  restoreMode === 'merge'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <GitMerge className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-bold text-xs">ادغام هوشمند (پیش‌فرض)</span>
                  <span className="text-[10px] opacity-75">حفظ داده‌ها + همگام‌سازی تیک‌ها</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRestoreMode('overwrite')}
                className={`p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 ${
                  restoreMode === 'overwrite'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <RefreshCw className="w-4 h-4 text-rose-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-bold text-xs">جایگزینی کامل</span>
                  <span className="text-[10px] opacity-75">پاکسازی و بازنویسی دیتابیس</span>
                </div>
              </button>
            </div>
          </div>

          {importStatus && (
            <div
              className={`p-3 rounded-xl font-medium border flex items-center gap-2 leading-relaxed ${
                isError
                  ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
              }`}
            >
              {isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
              <span>{importStatus}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleExport}
              className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 flex flex-col items-center justify-center gap-2 transition-colors group"
            >
              <FileJson className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="font-bold">دریافت فایل پشتیبان (JSON)</span>
            </button>

            <label className="cursor-pointer p-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 flex flex-col items-center justify-center gap-2 transition-colors group text-center">
              <Upload className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span className="font-bold">
                {restoreMode === 'merge' ? 'ادغام هوشمند از فایل' : 'بازیابی و جایگزینی'}
              </span>
              <input
                type="file"
                accept=".json"
                disabled={isProcessing}
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/60">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};

