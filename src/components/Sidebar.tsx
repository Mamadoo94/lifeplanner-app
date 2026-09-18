import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Flame,
  BookOpen,
  TrendingUp,
  Wallet,
  Timer,
  BarChart3,
  Settings,
  X,
  Sparkles,
  HardDriveDownload,
  Smartphone,
  Layers,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { ActiveTab } from '../types';
import { toPersianDigits } from '../utils/jalali';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  pendingTasksCount: number;
  todayPendingHabitsCount?: number;
  onOpenBackup: () => void;
  onOpenApkGuide: () => void;
}

interface NavItemConfig {
  id: ActiveTab;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: string;
  color: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onToggle,
  activeTab,
  onChangeTab,
  pendingTasksCount,
  todayPendingHabitsCount = 0,
  onOpenBackup,
  onOpenApkGuide,
}) => {
  const navItems: NavItemConfig[] = [
    {
      id: 'dashboard',
      label: 'داشبورد اصلی',
      sublabel: 'نمای کلی و امروز',
      icon: LayoutDashboard,
      color: 'text-blue-400 group-hover:text-blue-300',
    },
    {
      id: 'tasks',
      label: 'مدیریت وظایف',
      sublabel: 'امروز، هفته، ماه و آرشیو',
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      color: 'text-emerald-400 group-hover:text-emerald-300',
    },
    {
      id: 'habits',
      label: 'عادات و روتین‌ها',
      sublabel: 'پایبندی، آکاردئون و زنجیره',
      icon: Flame,
      badge: todayPendingHabitsCount > 0 ? todayPendingHabitsCount : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      color: 'text-amber-400 group-hover:text-amber-300',
    },
    {
      id: 'journal',
      label: 'ژورنال و یادداشت‌ها',
      sublabel: 'ثبت روزانه و پوشه‌بندی درختی',
      icon: BookOpen,
      color: 'text-indigo-400 group-hover:text-indigo-300',
    },
    {
      id: 'trade',
      label: 'ژورنال ترید حرفه‌ای',
      sublabel: 'استراتژی، پیش‌نویس، اسکرین‌شات',
      icon: TrendingUp,
      color: 'text-purple-400 group-hover:text-purple-300',
    },
    {
      id: 'finance',
      label: 'امور مالی و پیامک بانکی',
      sublabel: 'حساب‌ها، کارت‌ها و استخراج خودکار',
      icon: Wallet,
      color: 'text-cyan-400 group-hover:text-cyan-300',
    },
    {
      id: 'pomodoro',
      label: 'تایمر تمرکز پومودورو',
      sublabel: 'تکنیک گوجه‌فرنگی و آمار تمرکز',
      icon: Timer,
      color: 'text-rose-400 group-hover:text-rose-300',
    },
    {
      id: 'stats',
      label: 'آمار و ماتریس پایبندی',
      sublabel: 'نقشه حرارتی ماهانه و تحلیل',
      icon: BarChart3,
      color: 'text-teal-400 group-hover:text-teal-300',
    },
    {
      id: 'settings',
      label: 'تنظیمات درون‌برنامه‌ای',
      sublabel: 'دسترسی‌ها، الگوهای پیامک و پایگاه داده',
      icon: Settings,
      color: 'text-amber-400 group-hover:text-amber-300',
    },
  ];

  const handleItemClick = (tab: ActiveTab) => {
    onChangeTab(tab);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop Overlay (Mobile & Tablet) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-over Sidebar Drawer */}
      <aside
        id="app-main-sidebar"
        className={`fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] bg-slate-900/98 border-l border-slate-800 text-slate-100 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out select-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="منوی اصلی لایف‌پلانر"
      >
        {/* Header Branding */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-teal-400 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-white tracking-tight">لایف‌پلانر</h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-mono">
                  Android
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">برنامه جامع زندگی، کار و ترید</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="بستن منو"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>بخش‌های برنامه</span>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                id={`sidebar-nav-${item.id}`}
                onClick={() => handleItemClick(item.id)}
                className={`w-full text-right flex items-center justify-between p-3 rounded-2xl transition-all group ${
                  isActive
                    ? 'bg-gradient-to-l from-indigo-600/30 to-blue-600/10 border border-indigo-500/40 text-white shadow-md shadow-indigo-950/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-750 group-hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold leading-tight">{item.label}</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5 leading-tight">
                      {item.sublabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        item.badgeColor || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {toPersianDigits(item.badge)}
                    </span>
                  )}
                  <ChevronLeft
                    className={`w-4 h-4 transition-transform ${
                      isActive
                        ? 'text-indigo-400 -translate-x-1'
                        : 'text-slate-600 group-hover:text-slate-400 group-hover:-translate-x-0.5'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick Utility Section at Bottom */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900/95 space-y-2.5">
          <div className="text-[11px] font-bold text-slate-400 px-1 flex items-center justify-between">
            <span>ابزارهای داده و خروجی</span>
            <span className="text-[10px] text-emerald-400 font-mono">آفلاین</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onOpenBackup();
                if (window.innerWidth < 1024) onClose();
              }}
              id="sidebar-backup-btn"
              className="p-2.5 rounded-2xl bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-cyan-500/40 text-slate-200 hover:text-white flex flex-col items-start gap-1 text-xs font-medium transition-all group shadow-sm"
              title="پشتیبان‌گیری و ادغام هوشمند داده‌ها (JSON)"
            >
              <div className="flex items-center gap-1.5 w-full">
                <HardDriveDownload className="w-4 h-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-cyan-300 truncate">پشتیبان‌گیری</span>
              </div>
              <span className="text-[10px] text-slate-400 font-normal">خروجی و بازیابی JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenApkGuide();
                if (window.innerWidth < 1024) onClose();
              }}
              id="sidebar-apk-btn"
              className="p-2.5 rounded-2xl bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-emerald-500/40 text-slate-200 hover:text-white flex flex-col items-start gap-1 text-xs font-medium transition-all group shadow-sm"
              title="راهنمای ساخت APK با AppMint"
            >
              <div className="flex items-center gap-1.5 w-full">
                <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-emerald-300 truncate">خروجی APK</span>
              </div>
              <span className="text-[10px] text-slate-400 font-normal">راهنمای پکیج اندروید</span>
            </button>
          </div>

          <div className="px-2 pt-1 text-center">
            <span className="text-[10px] text-slate-400 font-mono">
              LifePlanner v2.5 • Android Native Edition
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
