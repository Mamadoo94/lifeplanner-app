import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Sparkles,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  SalaryIncomeSchedule,
  SalaryAdvance,
  BankAccount,
  FinanceCategory,
  FinanceTransaction,
} from '../../types';
import {
  toPersianDigits,
  getTodayJalali,
  getTodayJalaliWithTime,
} from '../../utils/jalali';
import { soundFx } from '../../utils/audio';
import { scheduleSalaryReminder } from '../../utils/loanNotifications';

interface SalaryTrackerSectionProps {
  salaries?: SalaryIncomeSchedule[];
  salaryAdvances?: SalaryAdvance[];
  accounts?: BankAccount[];
  categories?: FinanceCategory[];
  onAddSalary: (salary: Omit<SalaryIncomeSchedule, 'id'>) => Promise<void>;
  onUpdateSalary: (salary: SalaryIncomeSchedule) => Promise<void>;
  onDeleteSalary: (id: number) => Promise<void>;
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id'>) => Promise<void>;
  onAddSalaryAdvance?: (advance: Omit<SalaryAdvance, 'id'>) => Promise<void>;
  onUpdateSalaryAdvance?: (advance: SalaryAdvance) => Promise<void>;
  onDeleteSalaryAdvance?: (id: number) => Promise<void>;
}

export const SalaryTrackerSection: React.FC<SalaryTrackerSectionProps> = ({
  salaries = [],
  salaryAdvances = [],
  accounts = [],
  categories = [],
  onAddSalary,
  onUpdateSalary,
  onDeleteSalary,
  onAddTransaction,
  onAddSalaryAdvance,
  onUpdateSalaryAdvance,
  onDeleteSalaryAdvance,
}) => {
  const [subView, setSubView] = useState<'schedule' | 'advances'>('schedule');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SalaryIncomeSchedule | null>(null);

  // Advance Salary Modal State
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceTitle, setAdvanceTitle] = useState('');
  const [advanceEmployer, setAdvanceEmployer] = useState('');
  const [advanceTotalAmount, setAdvanceTotalAmount] = useState('');
  const [advanceMonths, setAdvanceMonths] = useState('3');
  const [advanceMonthlyDeduction, setAdvanceMonthlyDeduction] = useState('');
  const [advanceDate, setAdvanceDate] = useState(getTodayJalali());
  const [advanceNotes, setAdvanceNotes] = useState('');

  const safeSalaries = salaries || [];
  const safeAdvances = salaryAdvances || [];
  const safeAccounts = accounts || [];
  const safeCategories = categories || [];

  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'salary' | 'recurring_income'>('salary');
  const [payerName, setPayerName] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('28');
  const [destinationAccountId, setDestinationAccountId] = useState<number>(safeAccounts[0]?.id || 1);
  const [categoryName, setCategoryName] = useState('حقوق و دستمزد');
  const [subcategoryName, setSubcategoryName] = useState('');
  const [notes, setNotes] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  const today = getTodayJalali();
  const currentMonthPrefix = today.substring(0, 7); // YYYY/MM
  const currentDayNum = parseInt(today.substring(8, 10), 10) || 1;

  // Total Expected Monthly Incomes
  const totalMonthlyIncome = safeSalaries
    .filter((s) => s && s.is_active)
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setTitle('');
    setAmount('');
    setType('salary');
    setPayerName('');
    setDayOfMonth('28');
    setDestinationAccountId(accounts[0]?.id || 1);
    setCategoryName('حقوق و دستمزد');
    setSubcategoryName('');
    setNotes('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: SalaryIncomeSchedule) => {
    setEditingItem(item);
    setTitle(item.title);
    setAmount(String(item.amount));
    setType(item.type);
    setPayerName(item.payer_name || '');
    setDayOfMonth(String(item.day_of_month));
    setDestinationAccountId(item.destination_account_id || accounts[0]?.id || 1);
    setCategoryName(item.category_name || 'حقوق و دستمزد');
    setSubcategoryName(item.subcategory_name || '');
    setNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseInt(amount.replace(/,/g, ''), 10) || 0;
    const cleanDay = Math.max(1, Math.min(31, parseInt(dayOfMonth, 10) || 1));

    if (!title.trim() || cleanAmount <= 0) return;

    if (editingItem && editingItem.id) {
      const updated: SalaryIncomeSchedule = {
        ...editingItem,
        title: title.trim(),
        amount: cleanAmount,
        type,
        payer_name: payerName.trim() || undefined,
        day_of_month: cleanDay,
        destination_account_id: destinationAccountId,
        category_name: categoryName,
        subcategory_name: subcategoryName || undefined,
        notes: notes.trim() || undefined,
      };
      await onUpdateSalary(updated);
      scheduleSalaryReminder(updated);
    } else {
      const newItem: Omit<SalaryIncomeSchedule, 'id'> = {
        title: title.trim(),
        amount: cleanAmount,
        type,
        payer_name: payerName.trim() || undefined,
        day_of_month: cleanDay,
        destination_account_id: destinationAccountId,
        category_name: categoryName,
        subcategory_name: subcategoryName || undefined,
        is_active: true,
        notes: notes.trim() || undefined,
      };
      await onAddSalary(newItem);
    }

    soundFx.playAdd();
    resetForm();
  };

  // Quick Register Income for this month with Advance Salary deduction
  const handleRegisterThisMonth = async (item: SalaryIncomeSchedule) => {
    if (!item.id) return;
    const targetAccount = accounts.find((a) => a.id === item.destination_account_id) || accounts[0];

    // Find any active advance salary matching this employer or general active advance
    const activeAdvance = safeAdvances.find(
      (adv) =>
        adv.status === 'active' &&
        adv.remaining_amount > 0 &&
        (!item.payer_name || !adv.employer_name || adv.employer_name.includes(item.payer_name) || item.payer_name.includes(adv.employer_name))
    ) || safeAdvances.find((adv) => adv.status === 'active' && adv.remaining_amount > 0);

    let advanceDeduction = 0;
    if (activeAdvance) {
      advanceDeduction = Math.min(
        activeAdvance.monthly_deduction || activeAdvance.remaining_amount,
        activeAdvance.remaining_amount,
        item.amount
      );
    }

    const netAmount = item.amount - advanceDeduction;

    const newTx: Omit<FinanceTransaction, 'id'> = {
      account_id: targetAccount?.id || 1,
      type: 'income',
      amount: netAmount,
      category_name: item.category_name || 'حقوق و دستمزد',
      subcategory_name: item.subcategory_name,
      description: advanceDeduction > 0
        ? `واریز ${item.title} - ${currentMonthPrefix} (پس از کسر مساعده ${toPersianDigits(advanceDeduction.toLocaleString())} ت)`
        : `واریز ${item.title} - ${currentMonthPrefix}`,
      date_jalali: today,
      time: '10:00',
      created_at: getTodayJalaliWithTime(),
    };

    await onAddTransaction(newTx);
    await onUpdateSalary({
      ...item,
      last_registered_date: currentMonthPrefix,
    });

    if (activeAdvance && advanceDeduction > 0 && onUpdateSalaryAdvance) {
      const newRemaining = Math.max(0, activeAdvance.remaining_amount - advanceDeduction);
      await onUpdateSalaryAdvance({
        ...activeAdvance,
        remaining_amount: newRemaining,
        status: newRemaining === 0 ? 'settled' : 'active',
      });
    }

    soundFx.playComplete();
    if (advanceDeduction > 0) {
      setActionSuccessMsg(
        `واریز خالص ${item.title} به مبلغ ${toPersianDigits(netAmount.toLocaleString())} ت پس از کسر ${toPersianDigits(advanceDeduction.toLocaleString())} ت مساعده ثبت شد.`
      );
    } else {
      setActionSuccessMsg(`واریز ${item.title} به مبلغ ${toPersianDigits(item.amount.toLocaleString())} ت با موفقیت ثبت شد.`);
    }
    setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  // Advance Salary Handler
  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceTitle.trim() || !advanceTotalAmount) return;
    const totalAmt = parseFloat(advanceTotalAmount.replace(/,/g, '')) || 0;
    const months = parseInt(advanceMonths, 10) || 1;
    const monthlyDed = advanceMonthlyDeduction
      ? parseFloat(advanceMonthlyDeduction.replace(/,/g, ''))
      : Math.round(totalAmt / months);

    if (onAddSalaryAdvance) {
      await onAddSalaryAdvance({
        title: advanceTitle.trim(),
        employer_name: advanceEmployer.trim() || undefined,
        total_amount: totalAmt,
        remaining_amount: totalAmt,
        months_count: months,
        monthly_deduction: monthlyDed,
        receipt_date_jalali: advanceDate || today,
        status: 'active',
        notes: advanceNotes.trim() || undefined,
        created_at: getTodayJalaliWithTime(),
      });
      soundFx.playAdd();
    }

    setIsAdvanceModalOpen(false);
    setAdvanceTitle('');
    setAdvanceEmployer('');
    setAdvanceTotalAmount('');
    setAdvanceMonths('3');
    setAdvanceMonthlyDeduction('');
    setAdvanceNotes('');
  };

  // Available subcategories for chosen category
  const selectedCategoryObj = categories.find((c) => c.title === categoryName);

  // Total Active Advances
  const totalActiveAdvanceRemaining = safeAdvances
    .filter((a) => a.status === 'active')
    .reduce((sum, a) => sum + (a.remaining_amount || 0), 0);
  const totalMonthlyAdvanceDeduction = safeAdvances
    .filter((a) => a.status === 'active')
    .reduce((sum, a) => sum + (a.monthly_deduction || 0), 0);

  return (
    <div className="space-y-4">
      {/* Subtab Toggle: Schedule vs Advances */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setSubView('schedule')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            subView === 'schedule'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>برنامه حقوق ماهانه ({toPersianDigits(safeSalaries.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('advances')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            subView === 'advances'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>دفتر مساعده و پیش‌پرداخت حقوق ({toPersianDigits(safeAdvances.length)})</span>
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-700 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* VIEW 1: MONTHLY SCHEDULE */}
      {subView === 'schedule' && (
        <div className="space-y-4">
          {/* Header Metric & Action */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-400">مجموع درآمدهای منظم ماهانه</span>
                <div className="text-lg sm:text-2xl font-black text-emerald-400 font-mono" dir="ltr">
                  {toPersianDigits(totalMonthlyIncome.toLocaleString())} تومان
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن حقوق / درآمد جدید</span>
            </button>
          </div>

          {/* List of Salaries & Incomes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {safeSalaries.length === 0 ? (
              <div className="md:col-span-2 p-8 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
                <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs">هنوز درآمد یا حقوق ماهانه‌ای ثبت نشده است.</p>
              </div>
            ) : (
              safeSalaries.map((item) => {
                const isRegisteredThisMonth = item.last_registered_date === currentMonthPrefix;
                const daysUntil = item.day_of_month - currentDayNum;
                const targetAcc = accounts.find((a) => a.id === item.destination_account_id);

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      item.is_active
                        ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/40 border-slate-900 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{item.title}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.type === 'salary'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            }`}
                          >
                            {item.type === 'salary' ? 'حقوق ثابت' : 'درآمد تکرارشونده'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => item.id && onDeleteSalary(item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-lg font-black text-emerald-400 font-mono mb-2" dir="ltr">
                        {toPersianDigits(item.amount.toLocaleString())} ت
                      </div>

                      {/* Details */}
                      <div className="space-y-1.5 text-xs text-slate-400">
                        {item.payer_name && (
                          <div className="flex items-center justify-between">
                            <span>پرداخت‌کننده / کارفرما:</span>
                            <span className="text-slate-300 font-medium">{item.payer_name}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span>روز موعد واریز:</span>
                          <span className="text-slate-300 font-bold">
                            {toPersianDigits(item.day_of_month)} هر ماه
                          </span>
                        </div>
                        {targetAcc && (
                          <div className="flex items-center justify-between">
                            <span>حساب مقصد:</span>
                            <span className="text-slate-300">
                              {targetAcc.bank_name} ({targetAcc.title})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status & Action */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <div className="text-[11px]">
                        {isRegisteredThisMonth ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>واریز این ماه ثبت شده است</span>
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {daysUntil > 0
                                ? `${toPersianDigits(daysUntil)} روز تا واریز بعدی`
                                : daysUntil === 0
                                ? 'امروز موعد واریز است!'
                                : 'موعد واریز فرارسیده'}
                            </span>
                          </span>
                        )}
                      </div>

                      {!isRegisteredThisMonth && (
                        <button
                          type="button"
                          onClick={() => handleRegisterThisMonth(item)}
                          className="px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all"
                        >
                          <Check className="w-3 h-3" />
                          <span>ثبت واریز این ماه</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: ADVANCE SALARY LEDGER */}
      {subView === 'advances' && (
        <div className="space-y-4">
          {/* Header Metric & Action */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-400">باقیمانده بازپرداخت مساعده‌ها</span>
                <div className="text-lg sm:text-2xl font-black text-amber-400 font-mono" dir="ltr">
                  {toPersianDigits(totalActiveAdvanceRemaining.toLocaleString())} تومان
                </div>
                <span className="text-[11px] text-slate-400">
                  کسر ماهانه از حقوق: {toPersianDigits(totalMonthlyAdvanceDeduction.toLocaleString())} ت
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAdvanceModalOpen(true)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت مساعده / پیش‌پرداخت جدید</span>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs leading-relaxed">
            💡 <strong className="text-slate-300">توجه مالی:</strong> مساعده دریافتی به عنوان درآمد مجزا در نمودارهای ماهانه محاسبه نمی‌شود تا آمار درآمد سالانه مخدوش نشود، و در موعد واریز حقوق هر ماه به طور خودکار از مبلغ واریزی کسر می‌گردد.
          </div>

          {/* List of Advances */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {safeAdvances.length === 0 ? (
              <div className="md:col-span-2 p-8 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs">هیچ مساعده یا پیش‌پرداخت حقوقی ثبت نشده است.</p>
              </div>
            ) : (
              safeAdvances.map((adv) => (
                <div
                  key={adv.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-bold text-white">{adv.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          adv.status === 'active'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {adv.status === 'active' ? 'در حال کسر' : 'تسویه کامل'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-2">
                      <div>
                        <span>مبلغ کل مساعده:</span>
                        <p className="font-bold text-slate-200">{toPersianDigits(adv.total_amount.toLocaleString())} ت</p>
                      </div>
                      <div>
                        <span>باقیمانده کسر:</span>
                        <p className="font-bold text-amber-400">{toPersianDigits(adv.remaining_amount.toLocaleString())} ت</p>
                      </div>
                      <div>
                        <span>کسر ماهانه:</span>
                        <p className="font-medium text-slate-300">{toPersianDigits((adv.monthly_deduction || 0).toLocaleString())} ت</p>
                      </div>
                      <div>
                        <span>دوره بازپرداخت:</span>
                        <p className="font-medium text-slate-300">{toPersianDigits(adv.months_count || 1)} ماهه</p>
                      </div>
                    </div>

                    {adv.employer_name && (
                      <p className="text-[11px] text-slate-400">کارفرما / منبع: {adv.employer_name}</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">تاریخ دریافت: {adv.receipt_date_jalali}</span>
                    {onDeleteSalaryAdvance && adv.id && (
                      <button
                        type="button"
                        onClick={() => onDeleteSalaryAdvance(adv.id!)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="حذف مساعده"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD ADVANCE SALARY */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>ثبت مساعده / پیش‌پرداخت حقوق چندماهه</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">عنوان مساعده:</label>
                <input
                  type="text"
                  required
                  value={advanceTitle}
                  onChange={(e) => setAdvanceTitle(e.target.value)}
                  placeholder="مثلاً: مساعده خرید تجهیزات / مساعده عید"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">کارفرما / شرکت پرداخت‌کننده:</label>
                <input
                  type="text"
                  value={advanceEmployer}
                  onChange={(e) => setAdvanceEmployer(e.target.value)}
                  placeholder="اختیاری - جهت تطبیق با حقوق ماهانه"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">مبلغ کل مساعده (تومان):</label>
                  <input
                    type="text"
                    required
                    value={advanceTotalAmount}
                    onChange={(e) => setAdvanceTotalAmount(e.target.value)}
                    placeholder="مثلاً: 12000000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">تعداد ماه‌های کسر:</label>
                  <select
                    value={advanceMonths}
                    onChange={(e) => setAdvanceMonths(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="1">۱ ماهه (یکجا)</option>
                    <option value="2">۲ ماهه</option>
                    <option value="3">۳ ماهه</option>
                    <option value="4">۴ ماهه</option>
                    <option value="6">۶ ماهه</option>
                    <option value="12">۱۲ ماهه</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">مبلغ کسر ماهانه (تومان):</label>
                <input
                  type="text"
                  value={advanceMonthlyDeduction}
                  onChange={(e) => setAdvanceMonthlyDeduction(e.target.value)}
                  placeholder="خالی بگذارید تا به طور مساوی تقسیم شود"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">تاریخ دریافت (شمسی):</label>
                <input
                  type="text"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  placeholder="1403/01/01"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  ثبت مساعده
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 my-auto text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-400">
                <Briefcase className="w-4 h-4" />
                <span>{editingItem ? 'ویرایش اطلاعات درآمد' : 'ثبت حقوق یا درآمد جدید'}</span>
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">عنوان (مثلاً حقوق شرکت، اجاره واحد)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="حقوق ماهیانه"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">مبلغ (تومان)</label>
                  <input
                    type="text"
                    value={amount ? Number(amount.replace(/,/g, '')).toLocaleString() : ''}
                    onChange={(e) => setAmount(e.target.value.replace(/,/g, ''))}
                    placeholder="25,000,000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-left focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">نوع درآمد</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="salary">حقوق ثابت ماهانه</option>
                    <option value="recurring_income">درآمد متناوب / جانبی</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">نام واریزکننده / شرکت</label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="اختیاری"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">روز واریز هر ماه (۱ تا ۳۱)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-center focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">حساب بانکی مقصد</label>
                <select
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} - {acc.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">دسته‌بندی</label>
                  <select
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    {safeCategories
                      .filter((c) => c && c.type === 'income')
                      .map((c) => (
                        <option key={c.id} value={c.title}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">زیردسته (اختیاری)</label>
                  <select
                    value={subcategoryName}
                    onChange={(e) => setSubcategoryName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">بدون زیردسته</option>
                    {selectedCategoryObj?.subcategories?.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3.5 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  ذخیره اطلاعات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
