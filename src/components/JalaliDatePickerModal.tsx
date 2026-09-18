import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  PERSIAN_MONTHS,
  toPersianDigits,
  getTodayJalali,
  parseJalali,
  formatJalali,
  getDaysInJalaliMonth,
  getJalaliMonthStartOffset,
  formatJalaliReadable,
} from '../utils/jalali';

interface JalaliDatePickerModalProps {
  isOpen: boolean;
  value: string; // YYYY/MM/DD
  onChange: (date: string) => void;
  onClose: () => void;
  title?: string;
}

const WEEKDAY_NAMES_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export const JalaliDatePickerModal: React.FC<JalaliDatePickerModalProps> = ({
  isOpen,
  value,
  onChange,
  onClose,
  title = 'انتخاب تاریخ شمسی',
}) => {
  const initialDate = parseJalali(value || getTodayJalali());
  const [viewYear, setViewYear] = useState<number>(initialDate.year);
  const [viewMonth, setViewMonth] = useState<number>(initialDate.month);
  const todayStr = getTodayJalali();
  const todayParsed = parseJalali(todayStr);

  if (!isOpen) return null;

  const daysInCurrentMonth = getDaysInJalaliMonth(viewYear, viewMonth);
  const startOffset = getJalaliMonthStartOffset(viewYear, viewMonth);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const selected = formatJalali(viewYear, viewMonth, day);
    onChange(selected);
    onClose();
  };

  const handleSelectToday = () => {
    onChange(todayStr);
    onClose();
  };

  const handleSelectTomorrow = () => {
    // Tomorrow calculation
    let y = todayParsed.year;
    let m = todayParsed.month;
    let d = todayParsed.day + 1;
    const maxDays = getDaysInJalaliMonth(y, m);
    if (d > maxDays) {
      d = 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    onChange(formatJalali(y, m, d));
    onClose();
  };

  const selectedParsed = parseJalali(value);

  // Generate Year range
  const currentYear = todayParsed.year;
  const yearOptions: number[] = [];
  for (let y = currentYear - 5; y <= currentYear + 5; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">
                انتخاب شده: {formatJalaliReadable(value)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Month & Year Bar */}
        <div className="p-3 bg-slate-850/70 border-b border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="ماه قبل"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            {/* Month Dropdown */}
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-white font-bold text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {PERSIAN_MONTHS.map((mName, idx) => (
                <option key={mName} value={idx + 1}>
                  {mName}
                </option>
              ))}
            </select>

            {/* Year Dropdown */}
            <select
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-white font-bold text-xs rounded-xl px-2 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {toPersianDigits(y)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="ماه بعد"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {WEEKDAY_NAMES_SHORT.map((w, idx) => (
              <span
                key={w}
                className={`text-[11px] font-bold py-1 ${
                  idx === 6 ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {w}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots for offset */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-9" />
            ))}

            {/* Month Days */}
            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected =
                selectedParsed.year === viewYear &&
                selectedParsed.month === viewMonth &&
                selectedParsed.day === dayNum;

              const isToday =
                todayParsed.year === viewYear &&
                todayParsed.month === viewMonth &&
                todayParsed.day === dayNum;

              const isFriday = (startOffset + i) % 7 === 6;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/40 ring-2 ring-blue-400'
                      : isToday
                      ? 'bg-slate-800 border border-blue-500/60 text-blue-300 font-bold hover:bg-blue-600 hover:text-white'
                      : isFriday
                      ? 'text-rose-400 hover:bg-slate-800 hover:text-rose-300'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {toPersianDigits(dayNum)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Presets */}
        <div className="p-3 bg-slate-850/60 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelectToday}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-[11px] text-blue-400 font-medium transition-colors"
            >
              امروز
            </button>
            <button
              type="button"
              onClick={handleSelectTomorrow}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-[11px] text-emerald-400 font-medium transition-colors"
            >
              فردا
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
};

interface JalaliDatePickerFieldProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  className?: string;
  id?: string;
}

export const JalaliDatePickerField: React.FC<JalaliDatePickerFieldProps> = ({
  value,
  onChange,
  label,
  className = '',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        id={id}
        onClick={() => setIsOpen(true)}
        className="w-full bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-100 rounded-2xl px-3.5 py-2.5 text-xs flex items-center justify-between transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          <span className="font-semibold">{formatJalaliReadable(value)}</span>
        </div>

        <span className="text-[10px] text-slate-400 font-mono bg-slate-750 px-2 py-0.5 rounded-lg border border-slate-700">
          {toPersianDigits(value)}
        </span>
      </button>

      <JalaliDatePickerModal
        isOpen={isOpen}
        value={value}
        onChange={onChange}
        onClose={() => setIsOpen(false)}
        title={label ? `انتخاب ${label}` : undefined}
      />
    </div>
  );
};
