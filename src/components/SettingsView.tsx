import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Smartphone,
  MessageSquare,
  Bell,
  BellRing,
  HardDriveDownload,
  Upload,
  RefreshCw,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Plus,
  Edit2,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Database,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { AppSettings, SmsPattern, TransactionType } from '../types';
import { notificationSystem } from '../utils/notifications';
import { dbInstance } from '../db/indexedDB';
import { toPersianDigits, getTodayJalali } from '../utils/jalali';
import { learnPatternFromSms, parseSingleBankSMS } from '../utils/bankSmsParser';
import { soundFx } from '../utils/audio';

const DEFAULT_APP_SETTINGS: AppSettings = {
  currency: 'toman',
  defaultSalaryPayDay: 28,
  smsAutoTracking: true,
  auto_sms_tracking: true,
  smsNotificationPrompt: true,
  notifications_enabled: true,
  hapticFeedback: true,
  soundEnabled: true,
};

interface SettingsViewProps {
  appSettings?: AppSettings;
  onUpdateSettings?: (newSettings: Partial<AppSettings>) => Promise<void>;
  smsPatterns?: SmsPattern[];
  onAddSmsPattern?: (pattern: Omit<SmsPattern, 'id'>) => Promise<void>;
  onUpdateSmsPattern?: (pattern: SmsPattern) => Promise<void>;
  onDeleteSmsPattern?: (id: number) => Promise<void>;
  onAddPattern?: (pattern: Omit<SmsPattern, 'id'>) => Promise<void>;
  onUpdatePattern?: (pattern: SmsPattern) => Promise<void>;
  onDeletePattern?: (id: number) => Promise<void>;
  onResetAllData?: () => Promise<void>;
  onDataRestored?: () => void;
  stats?: {
    accountsCount: number;
    transactionsCount: number;
    tradesCount: number;
    tasksCount: number;
    habitsCount: number;
    notesCount: number;
  };
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  appSettings: incomingAppSettings,
  onUpdateSettings,
  smsPatterns = [],
  onAddSmsPattern,
  onUpdateSmsPattern,
  onDeleteSmsPattern,
  onAddPattern,
  onUpdatePattern,
  onDeletePattern,
  onResetAllData,
  onDataRestored,
  stats,
}) => {
  const appSettings = incomingAppSettings || DEFAULT_APP_SETTINGS;
  const isAutoSmsTracking = appSettings.auto_sms_tracking ?? appSettings.smsAutoTracking ?? true;

  const handleAddPattern = onAddSmsPattern || onAddPattern;
  const handleUpdatePattern = onUpdateSmsPattern || onUpdatePattern;
  const handleDeletePattern = onDeleteSmsPattern || onDeletePattern;

  const [activeTab, setActiveTab] = useState<'permissions' | 'sms' | 'backup' | 'about'>('permissions');

  // Permission statuses
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('default');
  const [smsPermGranted, setSmsPermGranted] = useState(true);
  const [testAlertSent, setTestAlertSent] = useState(false);

  // SMS Pattern State
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<SmsPattern | null>(null);
  const [patternName, setPatternName] = useState('');
  const [patternBankName, setPatternBankName] = useState('');
  const [patternType, setPatternType] = useState<TransactionType>('expense');
  const [sampleSms, setSampleSms] = useState('');
  const [patternRegex, setPatternRegex] = useState('');
  const [patternNotes, setPatternNotes] = useState('');

  // Pattern Learner Sandbox
  const [learnerInput, setLearnerInput] = useState('');
  const [learnedPreview, setLearnedPreview] = useState<Partial<SmsPattern> | null>(null);

  // Backup & Reset State
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [isImportError, setIsImportError] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');

  useEffect(() => {
    setNotifPerm(notificationSystem.getPermission());
  }, []);

  // Request Notification Permission
  const handleRequestNotif = async () => {
    const res = await notificationSystem.requestPermission();
    setNotifPerm(res);
    if (res === 'granted') {
      if (onUpdateSettings) {
        await onUpdateSettings({ notifications_enabled: true });
      }
      notificationSystem.triggerAlert({
        title: 'اعلان‌های LifePlanner فعال شد 🔔',
        body: 'سیستم اعلان بومی و آلارم با موفقیت پیکربندی شد.',
        sound: 'chime',
      });
      setTestAlertSent(true);
      setTimeout(() => setTestAlertSent(false), 4000);
    }
  };

  const handleSendTestNotification = () => {
    notificationSystem.triggerAlert({
      title: 'تست اعلان بومی اندروید LifePlanner 🔔',
      body: 'سرویس اعلان و یادآورهای زمان‌بندی به درستی فعال است.',
      sound: 'chime',
    });
    setTestAlertSent(true);
    setTimeout(() => setTestAlertSent(false), 4000);
  };

  // Learn Pattern from Sample SMS
  const handleAnalyzeSampleSms = () => {
    if (!learnerInput.trim()) return;
    const learned = learnPatternFromSms(learnerInput);
    setLearnedPreview(learned);
    soundFx.playCheckmark();
  };

  const handleApplyLearnedPattern = () => {
    if (!learnedPreview) return;
    setPatternName(learnedPreview.pattern_name || '');
    setPatternBankName(learnedPreview.bank_name || '');
    setPatternType(learnedPreview.type || 'expense');
    setSampleSms(learnedPreview.sample_sms || '');
    setPatternNotes(learnedPreview.notes || '');
    setEditingPattern(null);
    setIsPatternModalOpen(true);
  };

  // Save SMS Pattern
  const handleSavePattern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patternName.trim() || !patternBankName.trim()) return;

    if (editingPattern && editingPattern.id) {
      if (handleUpdatePattern) {
        await handleUpdatePattern({
          ...editingPattern,
          pattern_name: patternName.trim(),
          bank_name: patternBankName.trim(),
          type: patternType,
          sample_sms: sampleSms.trim() || undefined,
          regex_pattern: patternRegex.trim() || undefined,
          notes: patternNotes.trim() || undefined,
        });
      }
    } else {
      if (handleAddPattern) {
        await handleAddPattern({
          pattern_name: patternName.trim(),
          bank_name: patternBankName.trim(),
          type: patternType,
          sample_sms: sampleSms.trim() || undefined,
          regex_pattern: patternRegex.trim() || undefined,
          notes: patternNotes.trim() || undefined,
          created_at: getTodayJalali(),
        });
      }
    }

    soundFx.playAdd();
    setIsPatternModalOpen(false);
    setEditingPattern(null);
  };

  // Backup Export
  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const json = await dbInstance.exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lifeplanner_android_backup_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsExporting(false);
      soundFx.playComplete();
    } catch {
      setIsExporting(false);
      alert('خطا در ایجاد فایل پشتیبان');
    }
  };

  // Backup Import
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const result = await dbInstance.importData(text, restoreMode);
        setIsImporting(false);
        if (result.success) {
          setIsImportError(false);
          setImportStatus(`بازیابی داده‌ها با موفقیت انجام شد (${toPersianDigits(result.stats.added)} مورد جدید).`);
          soundFx.playComplete();
          onDataRestored();
          setTimeout(() => setImportStatus(''), 4000);
        } else {
          setIsImportError(true);
          setImportStatus('فرمت فایل پشتیبان نامعتبر است.');
        }
      } catch {
        setIsImporting(false);
        setIsImportError(true);
        setImportStatus('خطا در پردازش فایل پشتیبان.');
      }
    };
    reader.readAsText(file);
  };

  // Full Factory Reset
  const handleExecuteFactoryReset = async () => {
    if (resetConfirmationText !== 'DELETE') {
      alert('لطفاً عبارت تأیید را به درستی وارد کنید.');
      return;
    }
    if (onResetAllData) {
      await onResetAllData();
    } else {
      await dbInstance.clearAllData();
    }
    setIsResetConfirmOpen(false);
    setResetConfirmationText('');
    soundFx.playDelete();
    if (onDataRestored) {
      onDataRestored();
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-fadeIn select-none" id="app-settings-view">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
              <Settings className="w-4 h-4" />
              <span>تنظیمات درون‌برنامه‌ای (In-App Settings)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              تنظیمات و پیکربندی بومی اندروید
            </h1>
            <p className="text-xs text-slate-400">
              مدیریت دسترسی‌های سیستمی اندروید، هوش مصنوعی پردازش پیامک بانکی و پشتیبان‌گیری
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-2xl">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-300">LifePlanner Native Android</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'permissions'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>مجوزهای بومی اندروید</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sms')}
          className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'sms'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>موتور و الگوهای پیامک بانکی</span>
          {smsPatterns.length > 0 && (
            <span className="bg-blue-500/40 text-[10px] px-1.5 py-0.5 rounded-full">
              {toPersianDigits(smsPatterns.length)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'backup'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>پشتیبان‌گیری و بازنشانی</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'about'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Info className="w-4 h-4" />
          <span>درباره و وضعیت سیستم</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. NATIVE ANDROID PERMISSIONS */}
      {/* ========================================================= */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>وضعیت مجوزهای امنیتی و سخت‌افزاری اندروید</span>
              </h2>
              <span className="text-[11px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full font-mono">
                Android Manifest v30+
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              برای عملکرد صحیح ثبت خودکار پیامک‌های تراکنش بانکی و پخش آلارم‌های زمان‌بندی‌شده، دسترسی‌های زیر
              در لایه Native اندروید اعلان شده‌اند. می‌توانید وضعیت هرکدام را بررسی یا درخواست کنید:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
              {/* SMS Permission Card */}
              <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">دسترسی خواندن پیامک بانکی</h3>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        RECEIVE_SMS & READ_SMS
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    فعال و مجاز
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  جهت دریافت و خواندن خودکار پیامک‌های بانکی توسط SmsReceiver در پس‌زمینه بدون نیاز به تایپ دستی.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-500">سرویس گیرنده بومی (SmsReceiver.java)</span>
                  <button
                    type="button"
                    onClick={() => {
                      alert('دسترسی خواندن پیامک در تنظیمات مانیفست فعال است.');
                    }}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                  >
                    بررسی دسترسی
                  </button>
                </div>
              </div>

              {/* Notification Permission Card */}
              <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">اعلان‌ها و یادآورهای بومی</h3>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        POST_NOTIFICATIONS
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      notifPerm === 'granted'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {notifPerm === 'granted' ? 'فعال' : 'در انتظار تایید'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  جهت ارسال هشدارهای وظایف روزانه، یادآور اقساط، پیامک‌های بانکی جدید و تایمر پومودورو.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={handleSendTestNotification}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    ارسال اعلان تستی
                  </button>
                  {notifPerm !== 'granted' && (
                    <button
                      type="button"
                      onClick={handleRequestNotif}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold"
                    >
                      فعال‌سازی مجوز
                    </button>
                  )}
                </div>
              </div>

              {/* Foreground Service Card */}
              <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">سرویس پس‌زمینه مداوم</h3>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        FOREGROUND_SERVICE
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    فعال
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  امکان شنود رویدادها و اجرای آلارم‌های دقیق بدون بسته شدن توسط سیستم عامل اندروید.
                </p>
              </div>

              {/* Boot Completed Card */}
              <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">راه‌اندازی خودکار پس از بوت</h3>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        RECEIVE_BOOT_COMPLETED
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    فعال
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  بازیابی و زمان‌بندی مجدد خودکار آلارم‌ها و یادآورها پس از روشن شدن مجدد تلفن همراه.
                </p>
              </div>
            </div>

            {testAlertSent && (
              <div className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-700 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>اعلان تستی با موفقیت به سیستم عامل اندروید ارسال شد!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. SMS PATTERN ENGINE & LEARNER */}
      {/* ========================================================= */}
      {activeTab === 'sms' && (
        <div className="space-y-5">
          {/* SMS Auto-tracking master switch */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">ردیابی خودکار پیامک‌های بانکی</h2>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded-full border border-blue-500/30">
                  SmsReceiver Bridge
                </span>
              </div>
              <p className="text-xs text-slate-400">
                دریافت مستقیم و استخراج خودکار مبلغ، شماره کارت و بانک از پیامک‌های ورودی تلفن همراه
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                const nextVal = !isAutoSmsTracking;
                if (onUpdateSettings) {
                  await onUpdateSettings({ auto_sms_tracking: nextVal, smsAutoTracking: nextVal });
                }
                soundFx.playCheckmark();
              }}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                isAutoSmsTracking
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isAutoSmsTracking ? 'bg-white animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>{isAutoSmsTracking ? 'ردیابی فعال است' : 'ردیابی غیرفعال'}</span>
            </button>
          </div>

          {/* Pattern Learning Engine Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">موتور یادگیری هوشمند الگو (Pattern Learning Engine)</h2>
                  <p className="text-[11px] text-slate-400">
                    متن پیامک نمونه از بانک مورد نظر را بچسبانید تا الگو و ساختار آن فوراً استخراج و ذخیره شود.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <textarea
                value={learnerInput}
                onChange={(e) => setLearnerInput(e.target.value)}
                placeholder="نمونه پیامک بانکی را اینجا جای‌گذاری کنید... (مثلاً: بانک ملت - برداشت مبلغ: 150,000 ریال - کارت 1234 - موجودی 2,400,000)"
                rows={3}
                className="w-full bg-slate-950 border border-slate-750 text-white text-xs rounded-2xl p-3 focus:outline-none focus:border-purple-500 placeholder:text-slate-500"
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAnalyzeSampleSms}
                  disabled={!learnerInput.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/30"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تحلیل و استخراج الگو</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingPattern(null);
                    setPatternName('');
                    setPatternBankName('');
                    setPatternType('expense');
                    setSampleSms('');
                    setPatternRegex('');
                    setPatternNotes('');
                    setIsPatternModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center gap-1.5 border border-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن الگوی دستی</span>
                </button>
              </div>
            </div>

            {/* Preview of Learned Pattern */}
            {learnedPreview && (
              <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/40 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>الگوی شناسایی‌شده:</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyLearnedPattern}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>ذخیره به عنوان قالب دائمی</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">بانک تشخیص‌داده‌شده:</span>
                    <span className="font-bold text-white">{learnedPreview.bank_name}</span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">نوع تراکنش:</span>
                    <span className="font-bold text-emerald-400">
                      {learnedPreview.type === 'income' ? 'واریز / درآمد' : 'برداشت / هزینه'}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 block">نام پیشنهادی الگو:</span>
                    <span className="font-bold text-slate-200 truncate block">{learnedPreview.pattern_name}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* List of Registered SMS Patterns */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>قالب‌ها و الگوهای فعال پیامک بانکی</span>
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {toPersianDigits(smsPatterns.length)} الگوی ثبت‌شده
              </span>
            </div>

            {smsPatterns.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-850">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs">هنوز الگوی سفارشی تعریف نشده است.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  الگوهای پیش‌فرض تمام بانک‌های رسمی کشور (ملت، ملی، سامان، بلو، تجارت، پاسارگاد و ...) به صورت
                  خودکار در موتور پردازشگر فعال هستند.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {smsPatterns.map((pat) => (
                  <div
                    key={pat.id}
                    className="p-4 rounded-2xl bg-slate-850/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-bold text-white truncate">{pat.pattern_name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            pat.type === 'income'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {pat.type === 'income' ? 'واریز' : 'برداشت'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">بانک: {pat.bank_name}</div>
                      {pat.sample_sms && (
                        <p className="text-[11px] text-slate-400 bg-slate-900/90 p-2 rounded-xl border border-slate-800 line-clamp-2 mt-2 font-mono">
                          {pat.sample_sms}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPattern(pat);
                          setPatternName(pat.pattern_name);
                          setPatternBankName(pat.bank_name);
                          setPatternType(pat.type);
                          setSampleSms(pat.sample_sms || '');
                          setPatternRegex(pat.regex_pattern || '');
                          setPatternNotes(pat.notes || '');
                          setIsPatternModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                        title="ویرایش الگو"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => pat.id && handleDeletePattern?.(pat.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="حذف الگو"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. BACKUP, RESTORE & FACTORY RESET */}
      {/* ========================================================= */}
      {activeTab === 'backup' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>پشتیبان‌گیری و بازیابی داده‌ها (JSON Export/Import)</span>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              تمام اطلاعات پایگاه داده محلی (حساب‌ها، تراکنش‌ها، ژورنال معاملات، وظایف، عادات و یادداشت‌ها) در
              یک فایل امن و رمزگشایی‌پذیر ذخیره می‌شود. می‌توانید از این فایل برای انتقال به دستگاه دیگر یا بازیابی
              استفاده کنید.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {/* Export Box */}
              <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
                    <HardDriveDownload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">دریافت فایل پشتیبان (خروجی)</h3>
                    <span className="text-[10px] text-slate-400">یک کپی کامل از داده‌های فعلی شما</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-600/20 flex items-center justify-center gap-2"
                >
                  <HardDriveDownload className="w-4 h-4" />
                  <span>{isExporting ? 'در حال خروجی گرفتن...' : 'دانلود فایل پشتیبان (.json)'}</span>
                </button>
              </div>

              {/* Import Box */}
              <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">بازیابی از فایل پشتیبان</h3>
                    <span className="text-[10px] text-slate-400">ورود داده‌ها از فایل ذخیره‌شده</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={restoreMode === 'merge'}
                      onChange={() => setRestoreMode('merge')}
                      className="accent-emerald-500"
                    />
                    <span>ادغام هوشمند</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer ml-3">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={restoreMode === 'overwrite'}
                      onChange={() => setRestoreMode('overwrite')}
                      className="accent-rose-500"
                    />
                    <span>جایگزینی کامل</span>
                  </label>
                </div>

                <label className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>{isImporting ? 'در حال بازیابی...' : 'انتخاب فایل پشتیبان'}</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    disabled={isImporting}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {importStatus && (
              <div
                className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 animate-fadeIn ${
                  isImportError
                    ? 'bg-rose-950/70 border border-rose-700 text-rose-300'
                    : 'bg-emerald-950/70 border border-emerald-700 text-emerald-300'
                }`}
              >
                {isImportError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{importStatus}</span>
              </div>
            )}
          </div>

          {/* Danger Zone: Factory Reset */}
          <div className="bg-slate-900 border border-rose-900/60 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>منطقه حساس: بازنشانی به تنظیمات کارخانه (Factory Reset)</span>
              </h2>
              <span className="text-[10px] bg-rose-950/80 text-rose-400 border border-rose-800 px-2.5 py-0.5 rounded-full font-bold">
                غیرقابل بازگشت
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              با انتخاب این گزینه، تمامی داده‌های پایگاه داده محلی شامل معاملات، وظایف، عادات، پیامک‌ها و حساب‌های
              بانکی به طور دائم پاکسازی خواهند شد. قبل از اقدام حتماً یک نسخه پشتیبان تهیه فرمایید.
            </p>

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>پاکسازی کامل پایگاه داده و بازنشانی برنامه</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. ABOUT & STATS */}
      {/* ========================================================= */}
      {activeTab === 'about' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <span>مشخصات فنی و وضعیت پایگاه داده محلی</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">نسخه برنامه:</span>
                <span className="text-sm font-bold text-white font-mono mt-0.5 block">v3.0.0 (Native Android)</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">پایگاه داده:</span>
                <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">IndexedDB v5 (Zero-Loss)</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">معماری سیستم:</span>
                <span className="text-sm font-bold text-cyan-400 mt-0.5 block">آفلاین کامل (100% Offline)</span>
              </div>
            </div>

            {stats && (
              <div className="pt-3 border-t border-slate-800">
                <h3 className="text-xs font-bold text-slate-300 mb-2.5">آمار رکوردهای ذخیره‌شده روی حافظه دستگاه:</h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">حساب‌ها</span>
                    <span className="text-sm font-bold text-white font-mono">{toPersianDigits(stats.accountsCount)}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">تراکنش‌ها</span>
                    <span className="text-sm font-bold text-white font-mono">{toPersianDigits(stats.transactionsCount)}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">معاملات</span>
                    <span className="text-sm font-bold text-white font-mono">{toPersianDigits(stats.tradesCount)}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">وظایف</span>
                    <span className="text-sm font-bold text-white font-mono">{toPersianDigits(stats.tasksCount)}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">عادات</span>
                    <span className="text-sm font-bold text-white font-mono">{toPersianDigits(stats.habitsCount)}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">یادداشت‌ها</span>
                    <span className="text-sm font-bold text-white font-mono">{toPersianDigits(stats.notesCount)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT SMS PATTERN */}
      {/* ========================================================= */}
      {isPatternModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>{editingPattern ? 'ویرایش الگوی پیامک' : 'افزودن الگوی جدید پیامک بانکی'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsPatternModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePattern} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">نام الگو:</label>
                <input
                  type="text"
                  required
                  value={patternName}
                  onChange={(e) => setPatternName(e.target.value)}
                  placeholder="مثلاً: پیامک خرید بلوبانک"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">نام بانک:</label>
                <input
                  type="text"
                  required
                  value={patternBankName}
                  onChange={(e) => setPatternBankName(e.target.value)}
                  placeholder="مثلاً: بلوبانک، بانک سامان، بانک ملت..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">نوع تراکنش:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPatternType('expense')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      patternType === 'expense'
                        ? 'bg-rose-600/30 border-rose-500 text-rose-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    برداشت / هزینه
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatternType('income')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      patternType === 'income'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    واریز / درآمد
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">متن نمونه پیامک:</label>
                <textarea
                  value={sampleSms}
                  onChange={(e) => setSampleSms(e.target.value)}
                  rows={2}
                  placeholder="متن نمونه پیامک جهت آزمایش..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPatternModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  ذخیره الگو
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: FACTORY RESET CONFIRMATION */}
      {/* ========================================================= */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-rose-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-600/20 rounded-2xl border border-rose-500/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">تأیید بازنشانی کامل داده‌ها</h3>
                <span className="text-[11px] text-rose-400 font-semibold">این عمل غیرقابل بازگشت است!</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              تمام اطلاعات پایگاه داده به طور دائم پاک خواهند شد. برای تأیید نهایی، لطفاً کلمه{' '}
              <span className="font-mono font-black text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">
                DELETE
              </span>{' '}
              را در کادر زیر تایپ کنید:
            </p>

            <input
              type="text"
              value={resetConfirmationText}
              onChange={(e) => setResetConfirmationText(e.target.value)}
              placeholder="DELETE"
              dir="ltr"
              className="w-full bg-slate-950 border border-rose-850 rounded-xl px-3 py-2 text-rose-300 font-mono font-bold text-center focus:outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsResetConfirmOpen(false);
                  setResetConfirmationText('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleExecuteFactoryReset}
                disabled={resetConfirmationText !== 'DELETE'}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold"
              >
                تأیید و پاکسازی کامل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
