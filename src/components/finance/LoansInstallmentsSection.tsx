import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Landmark,
  CheckCircle2,
  Bell,
  BellOff,
  Percent,
  TrendingDown,
  Clock,
  X,
  Check,
  Calculator,
} from 'lucide-react';
import { Loan, BankAccount, FinanceTransaction } from '../../types';
import {
  toPersianDigits,
  getTodayJalali,
  getTodayJalaliWithTime,
} from '../../utils/jalali';
import { soundFx } from '../../utils/audio';
import { scheduleLoanReminder, cancelLoanReminder } from '../../utils/loanNotifications';

interface LoansInstallmentsSectionProps {
  loans?: Loan[];
  accounts?: BankAccount[];
  onAddLoan: (loan: Omit<Loan, 'id'>) => Promise<number>;
  onUpdateLoan: (loan: Loan) => Promise<void>;
  onDeleteLoan: (id: number) => Promise<void>;
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id'>) => Promise<void>;
}

export const LoansInstallmentsSection: React.FC<LoansInstallmentsSectionProps> = ({
  loans = [],
  accounts = [],
  onAddLoan,
  onUpdateLoan,
  onDeleteLoan,
  onAddTransaction,
}) => {
  const safeLoans = loans || [];
  const safeAccounts = accounts || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  // Quick Pay Modal
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);
  const [payAccountId, setPayAccountId] = useState<number>(safeAccounts[0]?.id || 1);
  const [recordInAccount, setRecordInAccount] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [bankName, setBankName] = useState('بانک رسالت');
  const [totalAmount, setTotalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('4');
  const [totalInstallments, setTotalInstallments] = useState('24');
  const [paidInstallments, setPaidInstallments] = useState('0');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [dueDayOfMonth, setDueDayOfMonth] = useState('15');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState('2');
  const [linkedAccountId, setLinkedAccountId] = useState<number>(safeAccounts[0]?.id || 1);
  const [startDateJalali, setStartDateJalali] = useState(getTodayJalali());
  const [notes, setNotes] = useState('');

  const today = getTodayJalali();
  const currentDayNum = parseInt(today.substring(8, 10), 10) || 1;

  // Overview metrics
  const activeLoans = safeLoans.filter((l) => l && l.status === 'active');
  const totalMonthlyCommitment = activeLoans.reduce((s, l) => s + (l.monthly_payment || 0), 0);
  const totalRemainingDebt = activeLoans.reduce(
    (s, l) => s + Math.max(0, (l.total_installments - l.paid_installments) * l.monthly_payment),
    0
  );

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingLoan(null);
    setTitle('');
    setBankName('بانک رسالت');
    setTotalAmount('');
    setInterestRate('4');
    setTotalInstallments('24');
    setPaidInstallments('0');
    setMonthlyPayment('');
    setDueDayOfMonth('15');
    setReminderEnabled(true);
    setReminderDaysBefore('2');
    setLinkedAccountId(accounts[0]?.id || 1);
    setStartDateJalali(getTodayJalali());
    setNotes('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (loan: Loan) => {
    setEditingLoan(loan);
    setTitle(loan.title);
    setBankName(loan.bank_name);
    setTotalAmount(String(loan.total_amount));
    setInterestRate(String(loan.interest_rate || 0));
    setTotalInstallments(String(loan.total_installments));
    setPaidInstallments(String(loan.paid_installments));
    setMonthlyPayment(String(loan.monthly_payment));
    setDueDayOfMonth(String(loan.due_day_of_month));
    setReminderEnabled(loan.reminder_enabled !== false);
    setReminderDaysBefore(String(loan.reminder_days_before || 2));
    setLinkedAccountId(loan.linked_account_id || accounts[0]?.id || 1);
    setStartDateJalali(loan.start_date_jalali || getTodayJalali());
    setNotes(loan.notes || '');
    setIsModalOpen(true);
  };

  // Helper to auto-calculate monthly payment if empty
  const autoCalculateMonthly = () => {
    const total = parseInt(totalAmount.replace(/,/g, ''), 10) || 0;
    const count = parseInt(totalInstallments, 10) || 1;
    const rate = parseFloat(interestRate) || 0;
    if (total > 0 && count > 0) {
      // Simplified Iranian loan formula: total with interest / count
      const totalWithInterest = total * (1 + (rate * (count / 12)) / 100);
      const perMonth = Math.round(totalWithInterest / count);
      setMonthlyPayment(String(perMonth));
    }
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTotal = parseInt(totalAmount.replace(/,/g, ''), 10) || 0;
    const cleanMonthly = parseInt(monthlyPayment.replace(/,/g, ''), 10) || 0;
    const cleanTotalInst = parseInt(totalInstallments, 10) || 1;
    const cleanPaidInst = Math.min(cleanTotalInst, parseInt(paidInstallments, 10) || 0);
    const cleanDueDay = Math.max(1, Math.min(31, parseInt(dueDayOfMonth, 10) || 1));

    if (!title.trim() || cleanMonthly <= 0) return;

    if (editingLoan && editingLoan.id) {
      const updated: Loan = {
        ...editingLoan,
        title: title.trim(),
        bank_name: bankName.trim(),
        total_amount: cleanTotal,
        interest_rate: parseFloat(interestRate) || 0,
        total_installments: cleanTotalInst,
        paid_installments: cleanPaidInst,
        monthly_payment: cleanMonthly,
        due_day_of_month: cleanDueDay,
        start_date_jalali: startDateJalali || editingLoan.start_date_jalali || getTodayJalali(),
        reminder_enabled: reminderEnabled,
        reminder_days_before: parseInt(reminderDaysBefore, 10) || 2,
        linked_account_id: linkedAccountId,
        notes: notes.trim() || undefined,
        status: cleanPaidInst >= cleanTotalInst ? 'completed' : 'active',
      };
      await onUpdateLoan(updated);
      if (reminderEnabled) {
        scheduleLoanReminder(updated);
      } else {
        cancelLoanReminder(editingLoan.id);
      }
    } else {
      const newLoan: Omit<Loan, 'id'> = {
        title: title.trim(),
        bank_name: bankName.trim(),
        total_amount: cleanTotal,
        interest_rate: parseFloat(interestRate) || 0,
        total_installments: cleanTotalInst,
        paid_installments: cleanPaidInst,
        monthly_payment: cleanMonthly,
        due_day_of_month: cleanDueDay,
        start_date_jalali: startDateJalali || getTodayJalali(),
        reminder_enabled: reminderEnabled,
        reminder_days_before: parseInt(reminderDaysBefore, 10) || 2,
        linked_account_id: linkedAccountId,
        status: cleanPaidInst >= cleanTotalInst ? 'completed' : 'active',
        created_at: getTodayJalaliWithTime(),
        notes: notes.trim() || undefined,
      };
      const createdId = await onAddLoan(newLoan);
      if (reminderEnabled) {
        scheduleLoanReminder({ ...newLoan, id: createdId });
      }
    }

    soundFx.playAdd();
    resetForm();
  };

  // Pay Installment
  const handleOpenPay = (loan: Loan) => {
    setPayingLoan(loan);
    setPayAccountId(loan.linked_account_id || accounts[0]?.id || 1);
    setRecordInAccount(true);
  };

  const handleConfirmPayInstallment = async () => {
    if (!payingLoan || !payingLoan.id) return;

    const newPaidCount = payingLoan.paid_installments + 1;
    const isCompleted = newPaidCount >= payingLoan.total_installments;

    // 1. Update loan record
    const updatedLoan: Loan = {
      ...payingLoan,
      paid_installments: newPaidCount,
      status: isCompleted ? 'completed' : 'active',
    };
    await onUpdateLoan(updatedLoan);

    // 2. Record transaction in selected bank account
    if (recordInAccount && payAccountId) {
      await onAddTransaction({
        account_id: payAccountId,
        type: 'expense',
        amount: payingLoan.monthly_payment,
        category_name: 'اقساط و تعهدات',
        subcategory_name: `قسط ${payingLoan.bank_name}`,
        description: `پرداخت قسط ${toPersianDigits(newPaidCount)} از ${toPersianDigits(payingLoan.total_installments)} وام ${payingLoan.title}`,
        date_jalali: today,
        time: '12:00',
        created_at: getTodayJalaliWithTime(),
      });
    }

    soundFx.playComplete();
    setPayingLoan(null);
  };

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-amber-400 mb-1">
            <Clock className="w-4 h-4" />
            <span>مجموع اقساط ماه جاری</span>
          </div>
          <div className="text-base sm:text-xl font-black text-amber-400 font-mono" dir="ltr">
            {toPersianDigits(totalMonthlyCommitment.toLocaleString())} تومان
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {toPersianDigits(activeLoans.length)} وام فعال در جریان
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-rose-400 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span>کل بدهی باقیمانده اقساط</span>
          </div>
          <div className="text-base sm:text-xl font-black text-rose-400 font-mono" dir="ltr">
            {toPersianDigits(totalRemainingDebt.toLocaleString())} تومان
          </div>
          <div className="text-[11px] text-slate-400 mt-1">تعهدات آتی وام‌ها</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-xs text-indigo-400 mb-1">
            <CreditCard className="w-4 h-4" />
            <span>مدیریت هوشمند وام‌ها</span>
          </div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all mt-1"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت وام یا تسهیلات جدید</span>
          </button>
        </div>
      </div>

      {/* Loans List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {loans.length === 0 ? (
          <div className="md:col-span-2 p-8 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
            <Landmark className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-xs">هنوز هیچ وام یا قسطی تعریف نشده است.</p>
          </div>
        ) : (
          loans.map((loan) => {
            const isCompleted = loan.status === 'completed';
            const remainingCount = Math.max(0, loan.total_installments - loan.paid_installments);
            const remainingDebt = remainingCount * loan.monthly_payment;
            const progressPercent = Math.min(
              100,
              Math.round((loan.paid_installments / (loan.total_installments || 1)) * 100)
            );
            const daysUntilDue = loan.due_day_of_month - currentDayNum;

            return (
              <div
                key={loan.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isCompleted
                    ? 'bg-slate-950/40 border-slate-900 opacity-60'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/50">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-200">{loan.title}</h4>
                        <span className="text-xs text-slate-400">{loan.bank_name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {loan.reminder_enabled ? (
                        <span
                          className="p-1 text-indigo-400 rounded-lg"
                          title="یادآوری خودکار فعال است"
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="p-1 text-slate-600 rounded-lg">
                          <BellOff className="w-3.5 h-3.5" />
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(loan)}
                        className="p-1 text-slate-400 hover:text-indigo-400 rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => loan.id && onDeleteLoan(loan.id)}
                        className="p-1 text-slate-400 hover:text-red-400 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Monthly Payment and Total */}
                  <div className="grid grid-cols-2 gap-2 py-2 border-y border-slate-800/60 my-2">
                    <div>
                      <span className="text-[11px] text-slate-400 block">مبلغ هر قسط:</span>
                      <span className="text-sm font-black text-amber-400 font-mono" dir="ltr">
                        {toPersianDigits(loan.monthly_payment.toLocaleString())} تومان
                      </span>
                    </div>

                    <div className="text-left">
                      <span className="text-[11px] text-slate-400 block">باقیمانده کل بدهی:</span>
                      <span className="text-sm font-black text-slate-200 font-mono" dir="ltr">
                        {toPersianDigits(remainingDebt.toLocaleString())} تومان
                      </span>
                    </div>
                  </div>

                  {/* Progress of Installments */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>
                        پیشرفت: {toPersianDigits(loan.paid_installments)} از {toPersianDigits(loan.total_installments)} قسط
                      </span>
                      <span className="font-mono">{toPersianDigits(progressPercent)}٪</span>
                    </div>

                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Due Day Notice */}
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                    <span>موعد سررسید: {toPersianDigits(loan.due_day_of_month)} هر ماه</span>
                    {!isCompleted && (
                      <span className="text-amber-400 text-[11px]">
                        {daysUntilDue > 0
                          ? `${toPersianDigits(daysUntilDue)} روز تا موعد`
                          : daysUntilDue === 0
                          ? 'امروز موعد پرداخت است!'
                          : 'موعد فرارسیده'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer / Pay Action */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  {isCompleted ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تسهیلات تسویه شده است</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenPay(loan)}
                      className="w-full py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>پرداخت قسط شماره {toPersianDigits(loan.paid_installments + 1)}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pay Installment Modal */}
      {payingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-400">
                <Check className="w-4 h-4" />
                <span>ثبت پرداخت قسط وام</span>
              </h3>
              <button
                type="button"
                onClick={() => setPayingLoan(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <div>
                عنوان وام: <strong className="text-white">{payingLoan.title}</strong> ({payingLoan.bank_name})
              </div>
              <div>
                شماره قسط پرداختی:{' '}
                <strong className="text-indigo-400 font-mono">
                  {toPersianDigits(payingLoan.paid_installments + 1)}
                </strong>{' '}
                از {toPersianDigits(payingLoan.total_installments)}
              </div>
              <div>
                مبلغ قسط:{' '}
                <strong className="text-amber-400 font-mono">
                  {toPersianDigits(payingLoan.monthly_payment.toLocaleString())} تومان
                </strong>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={recordInAccount}
                  onChange={(e) => setRecordInAccount(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
                />
                <span>کسر خودکار مبلغ از کارت بانکی</span>
              </label>

              {recordInAccount && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">پرداخت از حساب:</label>
                  <select
                    value={payAccountId}
                    onChange={(e) => setPayAccountId(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bank_name} - {acc.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingLoan(null)}
                  className="px-3.5 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayInstallment}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  تأیید پرداخت قسط
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Loan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 my-auto text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-400">
                <Landmark className="w-4 h-4" />
                <span>{editingLoan ? 'ویرایش اطلاعات وام' : 'ثبت وام یا تسهیلات جدید'}</span>
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">عنوان وام</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="وام مسکن، قرض‌الحسنه..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">نام بانک یا صندوق</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="بانک ملت / رسالت..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">مبلغ کل وام (تومان)</label>
                  <input
                    type="text"
                    value={totalAmount ? Number(totalAmount.replace(/,/g, '')).toLocaleString() : ''}
                    onChange={(e) => setTotalAmount(e.target.value.replace(/,/g, ''))}
                    placeholder="100,000,000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-left focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">کارمزد یا سود (درصد)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">تعداد کل اقساط (ماه)</label>
                  <input
                    type="number"
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">اقساط پرداخت شده تاکنون</label>
                  <input
                    type="number"
                    value={paidInstallments}
                    onChange={(e) => setPaidInstallments(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400">مبلغ هر قسط (تومان)</label>
                  <button
                    type="button"
                    onClick={autoCalculateMonthly}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Calculator className="w-3 h-3" />
                    <span>محاسبه خودکار</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={monthlyPayment ? Number(monthlyPayment.replace(/,/g, '')).toLocaleString() : ''}
                  onChange={(e) => setMonthlyPayment(e.target.value.replace(/,/g, ''))}
                  placeholder="4,500,000"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-left focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">روز سررسید هر ماه (۱ تا ۳۱)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDayOfMonth}
                    onChange={(e) => setDueDayOfMonth(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">حساب مرتبط جهت پرداخت</label>
                  <select
                    value={linkedAccountId}
                    onChange={(e) => setLinkedAccountId(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bank_name} - {acc.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
                  />
                  <span>فعال‌سازی اعلان هوشمند سررسید قسط</span>
                </label>

                {reminderEnabled && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>ارسال اعلان:</span>
                    <select
                      value={reminderDaysBefore}
                      onChange={(e) => setReminderDaysBefore(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                    >
                      <option value="0">همان روز سررسید</option>
                      <option value="1">۱ روز قبل از سررسید</option>
                      <option value="2">۲ روز قبل از سررسید</option>
                      <option value="3">۳ روز قبل از سررسید</option>
                    </select>
                  </div>
                )}
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
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  ذخیره اطلاعات وام
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
