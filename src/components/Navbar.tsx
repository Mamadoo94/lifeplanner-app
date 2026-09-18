import React, { useState, useEffect } from 'react';
import { Calendar, Settings, Bell, BellRing, BellOff, Menu } from 'lucide-react';
import { getTodayFullString } from '../utils/jalali';
import { notificationSystem } from '../utils/notifications';

interface NavbarProps {
  onOpenCategoryManager?: () => void;
  onToggleSidebar?: () => void;
  onOpenSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCategoryManager, onToggleSidebar, onOpenSettings }) => {
  const dateStr = getTodayFullString();
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setNotifPerm(notificationSystem.getPermission());
  }, []);

  const handleToggleNotif = async () => {
    const res = await notificationSystem.requestPermission();
    setNotifPerm(res);
    if (res === 'granted') {
      notificationSystem.triggerAlert({
        title: 'اعلان‌ها با موفقیت فعال شدند 🔔',
        body: 'از این پس یادآورها و آلارم‌های وظایف و عادات به موقع پخش خواهند شد.',
        sound: 'chime',
      });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 px-4 py-2.5 shadow-sm">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Navigation Toggle & Minimalist Date Header */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              id="navbar-hamburger-btn"
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/70 transition-colors flex items-center justify-center"
              title="باز کردن منوی سایدبار"
              aria-label="باز کردن منوی سایدبار"
            >
              <Menu className="w-5 h-5 text-indigo-400" />
            </button>
          )}

          {/* Clean Date Header */}
          <div className="flex items-center gap-2 text-slate-200">
            <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide">
              {dateStr}
            </span>
          </div>
        </div>

        {/* Essential View Controls Only */}
        <div className="flex items-center gap-2">
          {/* Notification Permission Toggle */}
          {notifPerm !== 'unsupported' && (
            <button
              onClick={handleToggleNotif}
              id="toggle-notifications-navbar-btn"
              className={`p-2 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-medium ${
                notifPerm === 'granted'
                  ? 'bg-slate-800/80 text-emerald-400 border-emerald-500/30 hover:bg-slate-750'
                  : notifPerm === 'denied'
                  ? 'bg-slate-800/80 text-rose-400 border-rose-500/30 hover:bg-slate-750'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/40 hover:bg-amber-500/20 animate-pulse'
              }`}
              title={
                notifPerm === 'granted'
                  ? 'اعلان‌ها و آلارم‌ها فعال هستند (برای تست کلیک کنید)'
                  : notifPerm === 'denied'
                  ? 'اعلان‌ها در مرورگر مسدود شده‌اند'
                  : 'فعال‌سازی اعلان‌ها و آلارم زمان‌بندی'
              }
            >
              {notifPerm === 'granted' ? (
                <BellRing className="w-4 h-4 text-emerald-400" />
              ) : notifPerm === 'denied' ? (
                <BellOff className="w-4 h-4 text-rose-400" />
              ) : (
                <Bell className="w-4 h-4 text-amber-400" />
              )}
              <span className="hidden sm:inline">
                {notifPerm === 'granted' ? 'اعلان‌ها فعال' : notifPerm === 'denied' ? 'اعلان مسدود' : 'فعال‌سازی اعلان'}
              </span>
            </button>
          )}

          {onOpenCategoryManager && (
            <button
              onClick={onOpenCategoryManager}
              id="manage-categories-navbar-btn"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition-colors border border-slate-700/60 flex items-center gap-1.5 text-xs font-medium"
              title="مدیریت دسته‌ها و برچسب‌ها"
            >
              <Settings className="w-4 h-4 text-purple-400" />
              <span className="hidden md:inline">دسته‌ها و تگ‌ها</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              id="app-settings-navbar-btn"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-amber-300 transition-colors border border-slate-700/60 flex items-center gap-1.5 text-xs font-medium"
              title="تنظیمات درون‌برنامه‌ای، مجوزها و الگوهای پیامک"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">تنظیمات</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
