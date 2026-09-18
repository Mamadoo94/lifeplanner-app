import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Layers,
  Filter,
  Search,
  Check,
  X,
  Building2,
  RefreshCw,
  Coins,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Briefcase,
  Users,
  Landmark,
  Tag,
  Smartphone,
  PieChart,
  TrendingUp,
} from 'lucide-react';
import {
  BankAccount,
  FinanceTransaction,
  FinanceCategory,
  SalaryIncomeSchedule,
  LedgerParty,
  LedgerEntry,
  Loan,
  SalaryAdvance,
  SmsPattern,
  ParsedBankSMS,
  TransactionType,
} from '../types';
import {
  getTodayJalali,
  getTodayJalaliWithTime,
  toPersianDigits,
  formatJalaliReadable,
  isDateInCurrentWeekJalali,
  isDateInCurrentMonthJalali,
} from '../utils/jalali';
import { parseMultipleBankSMS } from '../utils/bankSmsParser';
import { soundFx } from '../utils/audio';
import { autoBalancePartyAccount } from '../utils/partyBalancing';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { JalaliDatePickerField } from './JalaliDatePickerModal';
import { FinancialCategoryManagerModal } from './FinancialCategoryManagerModal';
import { FinancialAnalyticsSection } from './finance/FinancialAnalyticsSection';
import { SalaryTrackerSection } from './finance/SalaryTrackerSection';
import { LedgerPartiesSection } from './finance/LedgerPartiesSection';
import { LoansInstallmentsSection } from './finance/LoansInstallmentsSection';
import { registerSmsActionListener, registerSmsListener, simulateNativeSmsInterception } from '../utils/nativeSms';

export type FinanceSubTab =
  | 'overview'
  | 'analytics'
  | 'salaries'
  | 'ledger'
  | 'loans'
  | 'transactions'
  | 'accounts'
  | 'sms_parser';

interface FinanceViewProps {
  accounts: BankAccount[];
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  salaries: SalaryIncomeSchedule[];
  salaryAdvances?: SalaryAdvance[];
  parties: LedgerParty[];
  ledgerEntries: LedgerEntry[];
  loans: Loan[];
  smsPatterns?: SmsPattern[];
  onAddAccount: (account: Omit<BankAccount, 'id'>) => Promise<void>;
  onUpdateAccount: (account: BankAccount) => Promise<void>;
  onDeleteAccount: (id: number) => Promise<void>;
  onAddTransaction: (transaction: Omit<FinanceTransaction, 'id'>) => Promise<void>;
  onDeleteTransaction: (id: number) => Promise<void>;
  onBatchAddTransactions: (transactions: Omit<FinanceTransaction, 'id'>[]) => Promise<void>;
  onAddCategory: (cat: Omit<FinanceCategory, 'id'>) => Promise<void>;
  onUpdateCategory: (cat: FinanceCategory) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
  onReassignAndDeleteCategory: (deletedCatId: number, targetCatId: number) => Promise<void>;
  onAddSalary: (salary: Omit<SalaryIncomeSchedule, 'id'>) => Promise<void>;
  onUpdateSalary: (salary: SalaryIncomeSchedule) => Promise<void>;
  onDeleteSalary: (id: number) => Promise<void>;
  onAddSalaryAdvance?: (advance: Omit<SalaryAdvance, 'id'>) => Promise<void>;
  onUpdateSalaryAdvance?: (advance: SalaryAdvance) => Promise<void>;
  onDeleteSalaryAdvance?: (id: number) => Promise<void>;
  onAddParty: (party: Omit<LedgerParty, 'id'>) => Promise<void>;
  onUpdateParty: (party: LedgerParty) => Promise<void>;
  onDeleteParty: (id: number) => Promise<void>;
  onAddLedgerEntry: (entry: Omit<LedgerEntry, 'id'>) => Promise<void>;
  onDeleteLedgerEntry: (id: number, partyId: number) => Promise<void>;
  onAddLoan: (loan: Omit<Loan, 'id'>) => Promise<void>;
  onUpdateLoan: (loan: Loan) => Promise<void>;
  onDeleteLoan: (id: number) => Promise<void>;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  accounts,
  transactions,
  categories,
  salaries,
  salaryAdvances = [],
  parties,
  ledgerEntries,
  loans,
  smsPatterns = [],
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onAddTransaction,
  onDeleteTransaction,
  onBatchAddTransactions,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReassignAndDeleteCategory,
  onAddSalary,
  onUpdateSalary,
  onDeleteSalary,
  onAddSalaryAdvance,
  onUpdateSalaryAdvance,
  onDeleteSalaryAdvance,
  onAddParty,
  onUpdateParty,
  onDeleteParty,
  onAddLedgerEntry,
  onDeleteLedgerEntry,
  onAddLoan,
  onUpdateLoan,
  onDeleteLoan,
}) => {
  // Navigation / Tabs within Finance
  const [activeSubTab, setActiveSubTab] = useState<FinanceSubTab>('overview');
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [smsBannerInfo, setSmsBannerInfo] = useState<string | null>(null);

  // Filter States
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [accountFilter, setAccountFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Deletions
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);

  // Confirm Delete states
  const [accountToDelete, setAccountToDelete] = useState<{ id: number; title: string } | null>(null);
  const [txToDelete, setTxToDelete] = useState<{ id: number; title: string; amount: number } | null>(null);

  // SMS Parser States
  const [rawSmsInput, setRawSmsInput] = useState('');
  const [parsedSmsList, setParsedSmsList] = useState<ParsedBankSMS[]>([]);
  const [smsCommitStatus, setSmsCommitStatus] = useState<string>('');

  // Form: Account
  const [accountBankName, setAccountBankName] = useState('بلوبانک');
  const [accountTitle, setAccountTitle] = useState('');
  const [accountCardNumber, setAccountCardNumber] = useState('');
  const [accountBalance, setAccountBalance] = useState('');
  const [accountColor, setAccountColor] = useState('#3b82f6');

  // Form: Transaction
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txAccountId, setTxAccountId] = useState<number>(accounts[0]?.id || 1);
  const [txAmount, setTxAmount] = useState('');
  const [txCategoryName, setTxCategoryName] = useState('');
  const [txSubcategory, setTxSubcategory] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(getTodayJalali());
  const [txTime, setTxTime] = useState('');
  const [txPartyId, setTxPartyId] = useState<string>('');

  // Matching categories for current txType + requested financial categories
  const matchingCategories = useMemo(() => {
    const list = [...categories.filter((c) => c.type === txType)];
    const essentialTitles = ['وام‌ها و اقساط', 'بدهی‌ها', 'طلب‌ها', 'حساب اشخاص'];
    essentialTitles.forEach((title, idx) => {
      if (!list.some((c) => c.title === title)) {
        list.push({
          id: -100 - idx,
          title,
          type: txType,
          icon: 'Users',
          color: '#6366f1',
          subcategories: [],
          created_at: '',
        });
      }
    });
    return list;
  }, [categories, txType]);

  // Selected category object
  const selectedCategoryObj = useMemo(() => {
    return categories.find((c) => c.title === txCategoryName);
  }, [categories, txCategoryName]);

  // Register Native Bank SMS Interception and interactive action listeners
  useEffect(() => {
    const unsubAction = registerSmsActionListener((action) => {
      if (action.action === 'register') {
        const isExp = action.type === 'expense';
        setTxType(isExp ? 'expense' : 'income');
        if (action.amount) {
          setTxAmount(action.amount.toLocaleString());
        }
        if (action.date_jalali) {
          setTxDate(action.date_jalali);
        }
        if (action.time) {
          setTxTime(action.time);
        }
        if (action.bankName) {
          setTxDescription(`تراکنش ${action.bankName}`);
          const matchedAcc = accounts.find((a) =>
            a.bank_name.toLowerCase().includes(action.bankName!.toLowerCase()) ||
            action.bankName!.toLowerCase().includes(a.bank_name.toLowerCase())
          );
          if (matchedAcc && matchedAcc.id) {
            setTxAccountId(matchedAcc.id);
          }
        }
        setSmsBannerInfo(`دریافت شده از پیامک بانکی (${action.bankName || 'بانک'}). اطلاعات به طور خودکار در فرم تکمیل شد.`);
        setIsAddTxOpen(true);
        soundFx.playChime();
      }
    });

    const unsubIncoming = registerSmsListener(({ raw, parsed }) => {
      if (parsed) {
        setSmsBannerInfo(`پیامک بانکی جدید از ${parsed.bankName}: مبلغ ${parsed.amount.toLocaleString()} تومان`);
      } else {
        setSmsBannerInfo(`پیامک بانکی جدید: ${raw.body.substring(0, 35)}...`);
      }
      soundFx.playNotification();
    });

    return () => {
      unsubAction();
      unsubIncoming();
    };
  }, [accounts]);

  // Salary deposit transaction handler
  const handleDepositSalary = async (salary: SalaryIncomeSchedule, accountId: number) => {
    await onAddTransaction({
      account_id: accountId,
      type: 'income',
      amount: salary.amount,
      category_name: 'حقوق و دستمزد',
      description: `واریز ${salary.title}`,
      date_jalali: getTodayJalali(),
      time: '',
      source: 'manual',
    });
    soundFx.playSuccess();
  };

  // Loan installment payment transaction handler
  const handlePayInstallment = async (loan: Loan, accountId: number, installmentAmount: number) => {
    await onAddTransaction({
      account_id: accountId,
      type: 'expense',
      amount: installmentAmount,
      category_name: 'وام و اقساط',
      description: `پرداخت قسط وام: ${loan.title} (قسط ${(loan.paid_installments || 0) + 1} از ${loan.total_installments})`,
      date_jalali: getTodayJalali(),
      time: '',
      source: 'manual',
    });
    const updatedPaid = (loan.paid_installments || 0) + 1;
    const isFinished = updatedPaid >= loan.total_installments;
    await onUpdateLoan({
      ...loan,
      paid_installments: updatedPaid,
      status: isFinished ? 'paid' : 'active',
    });
    soundFx.playSuccess();
  };

  // Total Balance calculation across all accounts
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [accounts]);

  // Today string
  const today = getTodayJalali();

  // Summary Metrics
  const metrics = useMemo(() => {
    let todayExpense = 0;
    let todayIncome = 0;
    let monthExpense = 0;
    let monthIncome = 0;

    transactions.forEach((tx) => {
      if (tx.date_jalali === today) {
        if (tx.type === 'expense') todayExpense += tx.amount;
        else todayIncome += tx.amount;
      }
      if (isDateInCurrentMonthJalali(tx.date_jalali)) {
        if (tx.type === 'expense') monthExpense += tx.amount;
        else monthIncome += tx.amount;
      }
    });

    return {
      todayExpense,
      todayIncome,
      monthExpense,
      monthIncome,
    };
  }, [transactions, today]);

  // Trading capital vs general cash calculation
  const tradingCapital = useMemo(() => {
    const tradingAccounts = accounts.filter((acc) => {
      const text = `${acc.title} ${acc.bank_name}`.toLowerCase();
      return text.includes('ترید') || text.includes('معاملاتی') || text.includes('سرمایه') || text.includes('بروکر') || text.includes('ارز');
    });
    if (tradingAccounts.length > 0) {
      return tradingAccounts.reduce((s, a) => s + (a.balance || 0), 0);
    }
    // Default fallback: secondary account if available
    return accounts.length > 1 ? accounts[1].balance || 0 : 0;
  }, [accounts]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Time filter
      if (timeFilter === 'today' && tx.date_jalali !== today) return false;
      if (timeFilter === 'week' && !isDateInCurrentWeekJalali(tx.date_jalali)) return false;
      if (timeFilter === 'month' && !isDateInCurrentMonthJalali(tx.date_jalali)) return false;

      // Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

      // Account filter
      if (accountFilter !== 'all' && tx.account_id !== accountFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const catMatch = (tx.category_name || '').toLowerCase().includes(q);
        const amtMatch = String(tx.amount).includes(q);
        if (!descMatch && !catMatch && !amtMatch) return false;
      }

      return true;
    }).sort((a, b) => b.date_jalali.localeCompare(a.date_jalali) || (b.id || 0) - (a.id || 0));
  }, [transactions, timeFilter, typeFilter, accountFilter, searchQuery, today]);

  // -------------------------------------------------------------
  // HANDLERS: SMS PARSER
  // -------------------------------------------------------------
  const handleParseSms = () => {
    if (!rawSmsInput.trim()) return;
    const results = parseMultipleBankSMS(rawSmsInput, accounts);
    setParsedSmsList(results);
    soundFx.playAdd();
  };

  const handleUpdateParsedItem = (id: string, updates: Partial<ParsedBankSMS>) => {
    setParsedSmsList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleRemoveParsedItem = (id: string) => {
    setParsedSmsList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCommitParsedSms = async () => {
    if (parsedSmsList.length === 0) return;

    const toCommit: Omit<FinanceTransaction, 'id'>[] = parsedSmsList.map((item) => ({
      account_id: item.matchedAccountId || accounts[0]?.id || 1,
      type: item.type,
      amount: item.amount,
      category_name: item.type === 'expense' ? 'خرید و هزینه' : 'واریز به حساب',
      description: item.description || `تراکنش ${item.bankName}`,
      date_jalali: item.date_jalali,
      time: item.time,
      balance_after: item.balance_after,
      raw_sms: item.raw_sms,
      created_at: getTodayJalaliWithTime(),
    }));

    await onBatchAddTransactions(toCommit);
    soundFx.playComplete();
    setSmsCommitStatus(`${toPersianDigits(toCommit.length)} تراکنش با موفقیت ثبت و بالانس حساب‌ها به‌روزرسانی شد.`);
    setParsedSmsList([]);
    setRawSmsInput('');
    setTimeout(() => {
      setSmsCommitStatus('');
      setActiveSubTab('transactions');
    }, 2000);
  };

  // -------------------------------------------------------------
  // HANDLERS: ACCOUNTS
  // -------------------------------------------------------------
  const openAddAccountModal = () => {
    setEditingAccount(null);
    setAccountBankName('بلوبانک');
    setAccountTitle('');
    setAccountCardNumber('');
    setAccountBalance('');
    setAccountColor('#3b82f6');
    setIsAddAccountOpen(true);
  };

  const openEditAccountModal = (acc: BankAccount) => {
    setEditingAccount(acc);
    setAccountBankName(acc.bank_name);
    setAccountTitle(acc.title);
    setAccountCardNumber(acc.card_number || '');
    setAccountBalance(String(acc.balance || 0));
    setAccountColor(acc.color || '#3b82f6');
    setIsAddAccountOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountTitle.trim() && !accountBankName.trim()) return;

    const parsedBal = parseInt(accountBalance.replace(/,/g, ''), 10) || 0;

    if (editingAccount && editingAccount.id) {
      await onUpdateAccount({
        ...editingAccount,
        bank_name: accountBankName.trim(),
        title: accountTitle.trim() || accountBankName.trim(),
        card_number: accountCardNumber.trim() || undefined,
        balance: parsedBal,
        color: accountColor,
      });
    } else {
      await onAddAccount({
        bank_name: accountBankName.trim(),
        title: accountTitle.trim() || accountBankName.trim(),
        card_number: accountCardNumber.trim() || undefined,
        balance: parsedBal,
        color: accountColor,
        sort_order: accounts.length,
        created_at: getTodayJalaliWithTime(),
      });
    }

    soundFx.playAdd();
    setIsAddAccountOpen(false);
  };

  // -------------------------------------------------------------
  // HANDLERS: MANUAL TRANSACTIONS
  // -------------------------------------------------------------
  const openAddTxModal = () => {
    setTxType('expense');
    setTxAccountId(accounts[0]?.id || 1);
    setTxAmount('');
    setTxPartyId('');
    const defaultExpCat = categories.find((c) => c.type === 'expense');
    setTxCategoryName(defaultExpCat?.title || 'خوراک و رستوران');
    setTxSubcategory(defaultExpCat?.subcategories?.[0] || '');
    setTxDescription('');
    setTxDate(getTodayJalali());
    const now = new Date();
    setTxTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setIsAddTxOpen(true);
  };

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmt = parseInt(txAmount.replace(/,/g, ''), 10);
    if (isNaN(cleanAmt) || cleanAmt <= 0) return;

    const finalCatName = txSubcategory.trim()
      ? `${txCategoryName.trim()} / ${txSubcategory.trim()}`
      : txCategoryName.trim() || (txType === 'expense' ? 'سایر هزینه‌ها' : 'سایر واریزها');

    await onAddTransaction({
      account_id: Number(txAccountId),
      type: txType,
      amount: cleanAmt,
      category_name: finalCatName,
      description: txDescription.trim() || (txType === 'expense' ? 'هزینه دستی' : 'واریز دستی'),
      date_jalali: txDate,
      time: txTime.trim() || undefined,
      created_at: getTodayJalaliWithTime(),
    });

    // Auto-balance person ledger if a party is selected
    if (txPartyId) {
      const selectedParty = parties.find((p) => p.id === Number(txPartyId));
      if (selectedParty) {
        const balanceResult = autoBalancePartyAccount(
          selectedParty,
          txType,
          cleanAmt,
          txDescription.trim() || undefined
        );
        await onUpdateParty(balanceResult.updatedParty);
        await onAddLedgerEntry(balanceResult.newEntry);
      }
    }

    soundFx.playAdd();
    setIsAddTxOpen(false);
    setSmsBannerInfo(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      {/* Top Banner / Total Wealth Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950/70 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
              <Wallet className="w-4 h-4" />
              <span>مجموع موجودی کل حساب‌ها</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight" dir="ltr">
                {toPersianDigits(totalBalance.toLocaleString())}
              </span>
              <span className="text-sm font-bold text-slate-400">تومان</span>
            </div>
            <p className="text-xs text-slate-400">
              مدیریت {toPersianDigits(accounts.length)} حساب بانکی فعال
            </p>
          </div>

          {/* Quick Metrics Grid (Net Worth, Monthly Income, Monthly Expenses, Cash/Trading Capital) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                <span>درآمد ماهانه</span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-emerald-400 font-mono" dir="ltr">
                {toPersianDigits(metrics.monthIncome.toLocaleString())} ت
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
                <span>مخارج ماهانه</span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-rose-400 font-mono" dir="ltr">
                {toPersianDigits(metrics.monthExpense.toLocaleString())} ت
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>سرمایه ترید / معاملاتی</span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-cyan-400 font-mono" dir="ltr">
                {toPersianDigits(tradingCapital.toLocaleString())} ت
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span>نقدینگی در دسترس</span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-amber-400 font-mono" dir="ltr">
                {toPersianDigits(totalBalance.toLocaleString())} ت
              </div>
            </div>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveSubTab('overview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>نمای کلی</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('analytics')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
              <span>نمودارها و تحلیل</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('salaries')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'salaries'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
              <span>حقوق و درآمد ({toPersianDigits(salaries.length)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('ledger')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'ledger'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>حساب اشخاص ({toPersianDigits(parties.length)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('loans')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'loans'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-rose-400" />
              <span>وام‌ها و اقساط ({toPersianDigits(loans.length)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('transactions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'transactions'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>تراکنش‌ها ({toPersianDigits(filteredTransactions.length)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('accounts')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'accounts'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>کارت‌ها ({toPersianDigits(accounts.length)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('sms_parser')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'sms_parser'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>پیامک بانکی</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCategoryManagerOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-purple-300 hover:text-purple-200 text-xs font-bold border border-purple-500/30 flex items-center gap-1.5 transition-all shadow-sm"
              title="مدیریت دسته‌ها و زیردسته‌ها با انتخاب آیکون و رنگ"
            >
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              <span>مدیریت دسته‌ها ({toPersianDigits(categories.length)})</span>
            </button>

            <button
              type="button"
              onClick={openAddTxModal}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت تراکنش</span>
            </button>

            <button
              type="button"
              onClick={openAddAccountModal}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>افزودن حساب</span>
            </button>
          </div>
        </div>
      </div>

      {/* SMS Interactive Notification Banner */}
      {smsBannerInfo && (
        <div className="p-4 rounded-3xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 text-xs font-bold flex items-center justify-between shadow-xl shadow-indigo-950/50 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <p className="font-bold text-white">رویداد پیامک بانکی هوشمند</p>
              <p className="text-[11px] text-indigo-300/90">{smsBannerInfo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSmsBannerInfo(null)}
            className="p-1.5 rounded-xl text-indigo-400 hover:text-white hover:bg-indigo-900/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. FINANCIAL ANALYTICS TAB */}
      {activeSubTab === 'analytics' && (
        <div className="animate-fadeIn">
          <FinancialAnalyticsSection
            accounts={accounts || []}
            transactions={transactions || []}
            categories={categories || []}
            loans={loans || []}
            parties={parties || []}
          />
        </div>
      )}

      {/* 2. SALARIES TRACKER TAB */}
      {activeSubTab === 'salaries' && (
        <div className="animate-fadeIn">
          <SalaryTrackerSection
            salaries={salaries || []}
            salaryAdvances={salaryAdvances || []}
            accounts={accounts || []}
            categories={categories || []}
            onAddSalary={onAddSalary}
            onUpdateSalary={onUpdateSalary}
            onDeleteSalary={onDeleteSalary}
            onAddTransaction={handleDepositSalary}
            onAddSalaryAdvance={onAddSalaryAdvance}
            onUpdateSalaryAdvance={onUpdateSalaryAdvance}
            onDeleteSalaryAdvance={onDeleteSalaryAdvance}
          />
        </div>
      )}

      {/* 3. LEDGER & PARTIES TAB */}
      {activeSubTab === 'ledger' && (
        <div className="animate-fadeIn">
          <LedgerPartiesSection
            parties={parties || []}
            ledgerEntries={ledgerEntries || []}
            accounts={accounts || []}
            onAddParty={onAddParty}
            onUpdateParty={onUpdateParty}
            onDeleteParty={onDeleteParty}
            onAddLedgerEntry={onAddLedgerEntry}
            onDeleteLedgerEntry={onDeleteLedgerEntry}
            onAddTransaction={onAddTransaction}
          />
        </div>
      )}

      {/* 4. LOANS & INSTALLMENTS TAB */}
      {activeSubTab === 'loans' && (
        <div className="animate-fadeIn">
          <LoansInstallmentsSection
            loans={loans || []}
            accounts={accounts || []}
            onAddLoan={onAddLoan}
            onUpdateLoan={onUpdateLoan}
            onDeleteLoan={onDeleteLoan}
            onAddTransaction={handlePayInstallment}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. BANK SMS PARSER TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'sms_parser' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">استخراج خودکار و هوشمند پیامک بانکی</h3>
                  <p className="text-xs text-slate-400">
                    متن یک یا چند پیامک تراکنش بانک‌های ایران (ملت، سامان، بلوبانک، پاسارگاد، ملی، تجارت و ...) را اینجا الصاق کنید.
                  </p>
                </div>
              </div>
            </div>

            {/* Textarea for SMS */}
            <div className="space-y-2">
              <textarea
                value={rawSmsInput}
                onChange={(e) => setRawSmsInput(e.target.value)}
                rows={5}
                placeholder="متن پیامک یا پیامک‌های بانکی را اینجا جای‌گذاری (Paste) کنید...&#10;&#10;نمونه:&#10;بانک ملت&#10;برداشت مبلغ 1,250,000 ریال&#10;از حساب 1234&#10;موجودی: 45,000,000 ریال&#10;1403/05/12 14:30"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 leading-relaxed font-sans"
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  فرمت‌های ریال و تومان به طور خودکار تشخیص داده شده و به تومان استاندارد تبدیل می‌شوند.
                </span>

                <button
                  type="button"
                  onClick={handleParseSms}
                  disabled={!rawSmsInput.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>تحلیل و تفکیک پیامک‌ها</span>
                </button>
              </div>
            </div>

            {/* Quick SMS Simulation Buttons for Testing Background Native Flow */}
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                  <span>شبیه‌ساز رهگیری و نوتیفیکیشن زنده پیامک بانکی (تست رهگیری پس‌زمینه):</span>
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  کلیک روی هر بانک، رویداد پیامک و اعلان تعاملی را شبیه‌سازی می‌کند
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sms = `بلوبانک\nخرید با کارت\nمبلغ: 450,000 ریال\nاز حساب 8877\nمانده: 12,400,000 ریال\n1403/05/18 19:42`;
                    setRawSmsInput(sms);
                    simulateNativeSmsInterception(sms, 'بلوبانک');
                  }}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-[11px] font-medium border border-slate-700/60 flex items-center justify-center gap-1 transition-all active:scale-95"
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>بلوبانک (۴۵,۰۰۰ ت)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sms = `بانک ملت\nبرداشت مبلغ 1,850,000 ریال\nاز کارت 6104\nموجودی: 35,000,000 ریال\n1403/05/18 14:15`;
                    setRawSmsInput(sms);
                    simulateNativeSmsInterception(sms, 'بانک ملت');
                  }}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-[11px] font-medium border border-slate-700/60 flex items-center justify-center gap-1 transition-all active:scale-95"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>ملت (۱۸۵,۰۰۰ ت)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sms = `بانک سامان\nواریز مبلغ 5,000,000 تومان\nبه حساب 9922\nمانده: 24,000,000 تومان\n1403/05/18 10:30`;
                    setRawSmsInput(sms);
                    simulateNativeSmsInterception(sms, 'بانک سامان');
                  }}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-[11px] font-medium border border-slate-700/60 flex items-center justify-center gap-1 transition-all active:scale-95"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>سامان (واریز ۵ م)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sms = `بانک ملی ایران\nبرداشت 250000 ریال\nاز 6037\nمانده 4200000 ریال\n1403/05/18 11:20`;
                    setRawSmsInput(sms);
                    simulateNativeSmsInterception(sms, 'بانک ملی');
                  }}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-[11px] font-medium border border-slate-700/60 flex items-center justify-center gap-1 transition-all active:scale-95"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>ملی (۲۵,۰۰۰ ت)</span>
                </button>
              </div>
            </div>

            {smsCommitStatus && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{smsCommitStatus}</span>
              </div>
            )}
          </div>

          {/* Parsed SMS Cards Preview */}
          {parsedSmsList.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <span>پیامک‌های تفکیک‌شده آماده ثبت:</span>
                  <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full text-[11px] font-mono">
                    {toPersianDigits(parsedSmsList.length)} مورد
                  </span>
                </h4>

                <button
                  type="button"
                  onClick={handleCommitParsedSms}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>ثبت نهایی همه تراکنش‌ها در حساب‌ها</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {parsedSmsList.map((item) => {
                  const isExp = item.type === 'expense';
                  return (
                    <div
                      key={item.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 relative group"
                    >
                      <button
                        type="button"
                        onClick={() => handleRemoveParsedItem(item.id)}
                        className="absolute top-3 left-3 p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="حذف این مورد"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* Header Badge */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            isExp
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isExp ? 'برداشت / هزینه' : 'واریز / درآمد'}
                        </span>
                        <span className="text-xs font-bold text-slate-300">
                          {item.bankName}
                        </span>
                      </div>

                      {/* Amount */}
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-xl font-black font-mono ${
                            isExp ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                          dir="ltr"
                        >
                          {isExp ? '-' : '+'}
                          {toPersianDigits(item.amount.toLocaleString())}
                        </span>
                        <span className="text-xs text-slate-400 font-bold">تومان</span>
                        {item.unit === 'rial' && (
                          <span className="text-[10px] text-slate-400">
                            (تبدیل شده از ریال)
                          </span>
                        )}
                      </div>

                      {/* Details Edit */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">
                            حساب متصل:
                          </label>
                          <select
                            value={item.matchedAccountId || accounts[0]?.id || 1}
                            onChange={(e) =>
                              handleUpdateParsedItem(item.id, {
                                matchedAccountId: Number(e.target.value),
                              })
                            }
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                          >
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.bank_name} - {acc.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">
                            شرح تراکنش:
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              handleUpdateParsedItem(item.id, { description: e.target.value })
                            }
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                        <span>تاریخ: {toPersianDigits(item.date_jalali)} {item.time ? toPersianDigits(item.time) : ''}</span>
                        {item.balance_after !== undefined && (
                          <span className="font-mono" dir="ltr">
                            مانده: {toPersianDigits(item.balance_after.toLocaleString())} ت
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. OVERVIEW & ACCOUNTS CARDS */}
      {/* ========================================================================= */}
      {(activeSubTab === 'overview' || activeSubTab === 'accounts') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span>کارت‌ها و حساب‌های بانکی شما</span>
            </h3>

            <button
              type="button"
              onClick={openAddAccountModal}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>افزودن حساب جدید</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-sm relative overflow-hidden transition-all group"
              >
                {/* Accent Color Stripe */}
                <div
                  className="absolute top-0 right-0 left-0 h-1.5"
                  style={{ backgroundColor: acc.color || '#3b82f6' }}
                />

                <div className="flex items-start justify-between mb-4 pt-1">
                  <div>
                    <span className="text-xs font-bold text-slate-400 block">{acc.bank_name}</span>
                    <h4 className="text-sm font-black text-white">{acc.title}</h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditAccountModal(acc)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="ویرایش حساب"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountToDelete({ id: acc.id!, title: `${acc.bank_name} - ${acc.title}` })}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="حذف حساب"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {acc.card_number && (
                  <div className="text-xs font-mono text-slate-400 mb-4 tracking-wider" dir="ltr">
                    {acc.card_number}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-400">موجودی:</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-white font-mono" dir="ltr">
                      {toPersianDigits((acc.balance || 0).toLocaleString())}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">تومان</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TRANSACTIONS LIST TAB */}
      {/* ========================================================================= */}
      {(activeSubTab === 'overview' || activeSubTab === 'transactions') && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">تراکنش‌های ثبت شده</h3>
              </div>

              {/* Time Filters */}
              <div className="flex items-center bg-slate-800/90 rounded-xl p-1 text-xs">
                {(['today', 'week', 'month', 'all'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeFilter(t)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      timeFilter === t
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === 'today' ? 'امروز' : t === 'week' ? 'این هفته' : t === 'month' ? 'این ماه' : 'همه'}
                  </button>
                ))}
              </div>
            </div>

            {/* Second row filters: Type, Account, Search */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="flex items-center bg-slate-800 rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`flex-1 py-1 rounded-lg font-bold text-center ${
                    typeFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400'
                  }`}
                >
                  همه
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('expense')}
                  className={`flex-1 py-1 rounded-lg font-bold text-center ${
                    typeFilter === 'expense' ? 'bg-rose-600 text-white' : 'text-slate-400'
                  }`}
                >
                  هزینه‌ها
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('income')}
                  className={`flex-1 py-1 rounded-lg font-bold text-center ${
                    typeFilter === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                  }`}
                >
                  درآمدها
                </button>
              </div>

              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
              >
                <option value="all">همه حساب‌ها</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name} - {acc.title}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="جستجو در شرح یا دسته‌بندی..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm divide-y divide-slate-800/60">
            {filteredTransactions.map((tx) => {
              const isExp = tx.type === 'expense';
              const acc = accounts.find((a) => a.id === tx.account_id);

              return (
                <div
                  key={tx.id}
                  className="p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        isExp
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {isExp ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{tx.description}</span>
                        {tx.category_name && (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-750">
                            {tx.category_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{acc ? `${acc.bank_name} (${acc.title})` : 'حساب عمومی'}</span>
                        <span>•</span>
                        <span>{toPersianDigits(tx.date_jalali)}</span>
                        {tx.time && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{toPersianDigits(tx.time)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div
                        className={`text-sm font-black font-mono ${
                          isExp ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                        dir="ltr"
                      >
                        {isExp ? '-' : '+'}
                        {toPersianDigits(tx.amount.toLocaleString())} تومان
                      </div>
                      {tx.balance_after !== undefined && (
                        <div className="text-[10px] text-slate-400 font-mono text-left" dir="ltr">
                          مانده: {toPersianDigits(tx.balance_after.toLocaleString())} ت
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setTxToDelete({
                          id: tx.id!,
                          title: tx.description,
                          amount: tx.amount,
                        })
                      }
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all"
                      title="حذف تراکنش"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredTransactions.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                <p>تراکنشی برای این فیلترها یافت نشد.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT ACCOUNT */}
      {/* ========================================================================= */}
      {isAddAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn select-none">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  {editingAccount ? 'ویرایش حساب بانکی' : 'افزودن حساب بانکی جدید'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAccountOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">نام بانک:</label>
                <input
                  type="text"
                  required
                  value={accountBankName}
                  onChange={(e) => setAccountBankName(e.target.value)}
                  placeholder="مثلاً بلوبانک، بانک ملت، بانک سامان..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">عنوان حساب / کاربری:</label>
                <input
                  type="text"
                  required
                  value={accountTitle}
                  onChange={(e) => setAccountTitle(e.target.value)}
                  placeholder="مثلاً کارت روزمره، حساب پس‌انداز، حقوق..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">شماره کارت یا حساب (اختیاری):</label>
                <input
                  type="text"
                  value={accountCardNumber}
                  onChange={(e) => setAccountCardNumber(e.target.value)}
                  placeholder="6037-9918-..."
                  dir="ltr"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">موجودی فعلی (تومان):</label>
                <input
                  type="text"
                  required
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(e.target.value)}
                  placeholder="0"
                  dir="ltr"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">رنگ کارت:</label>
                <div className="flex items-center gap-2">
                  {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccountColor(color)}
                      className={`w-7 h-7 rounded-xl transition-all ${
                        accountColor === color ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/30"
                >
                  {editingAccount ? 'ذخیره تغییرات' : 'افزودن حساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD MANUAL TRANSACTION */}
      {/* ========================================================================= */}
      {isAddTxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn select-none">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">ثبت تراکنش مالی جدید</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTxOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTx} className="p-5 space-y-3.5 text-xs">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 bg-slate-850 p-1 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setTxType('expense')}
                  className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                    txType === 'expense'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>برداشت / هزینه</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('income')}
                  className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                    txType === 'income'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>واریز / درآمد</span>
                </button>
              </div>

              {/* Amount (Strict LTR) */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">مبلغ به تومان:</label>
                <input
                  type="text"
                  required
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="مثلاً 50,000"
                  dir="ltr"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Account Selection */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">از / به حساب:</label>
                <select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} - {acc.title} (موجودی: {toPersianDigits(acc.balance.toLocaleString())} ت)
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">شرح تراکنش:</label>
                <input
                  type="text"
                  required
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="مثلاً خرید سوپرمارکت، کرایه تاکسی، حقوق..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Category & Subcategory Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold block">دسته‌بندی و زیردسته:</label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryManagerOpen(true)}
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium"
                  >
                    <Tag className="w-3 h-3" />
                    <span>مدیریت دسته‌ها</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={txCategoryName}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      setTxCategoryName(newCat);
                      const catObj = categories.find((c) => c.title === newCat);
                      setTxSubcategory(catObj?.subcategories?.[0] || '');
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">انتخاب دسته‌بندی...</option>
                    {matchingCategories.map((cat) => (
                      <option key={cat.id} value={cat.title}>
                        {cat.title}
                      </option>
                    ))}
                    <option value="سایر">سایر</option>
                  </select>

                  {selectedCategoryObj && selectedCategoryObj.subcategories && selectedCategoryObj.subcategories.length > 0 ? (
                    <select
                      value={txSubcategory}
                      onChange={(e) => setTxSubcategory(e.target.value)}
                      className="w-full bg-slate-800 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-purple-200 focus:outline-none focus:border-purple-400"
                    >
                      <option value="">بدون زیردسته</option>
                      {selectedCategoryObj.subcategories.map((sub, idx) => (
                        <option key={idx} value={sub}>
                          زیردسته: {sub}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={txSubcategory}
                      onChange={(e) => setTxSubcategory(e.target.value)}
                      placeholder="زیردسته دلخواه (اختیاری)"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Associated Party / Person Ledger (Auto-Balancing) */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">طرف حساب / شخص مرتبط (اختیاری):</label>
                <select
                  value={txPartyId}
                  onChange={(e) => setTxPartyId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">بدون ارتباط با شخص (ثبت عمومی)</option>
                  {parties.map((p) => {
                    const remaining = Math.max(0, p.total_amount - (p.settled_amount || 0));
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.type === 'credit' ? 'طلب' : 'بدهی'}: {toPersianDigits(remaining.toLocaleString())} تومان)
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  با انتخاب شخص، مانده بدهی یا طلب شخص بر اساس واریز/برداشت به صورت خودکار تراز و تسویه می‌شود.
                </p>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">تاریخ تراکنش:</label>
                  <JalaliDatePickerField
                    value={txDate}
                    onChange={setTxDate}
                    label="تاریخ تراکنش"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">ساعت (اختیاری):</label>
                  <input
                    type="time"
                    value={txTime}
                    onChange={(e) => setTxTime(e.target.value)}
                    dir="ltr"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTxOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/30"
                >
                  ثبت تراکنش
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRM DELETE MODALS */}
      {/* ========================================================================= */}
      <ConfirmDeleteModal
        isOpen={accountToDelete !== null}
        title="حذف حساب بانکی"
        itemName={accountToDelete?.title}
        message="آیا از حذف این حساب بانکی اطمینان دارید؟ تمامی تراکنش‌های ثبت‌شده این حساب همچنان در تاریخچه باقی خواهند ماند."
        onConfirm={async () => {
          if (accountToDelete) {
            await onDeleteAccount(accountToDelete.id);
            soundFx.playDelete();
            setAccountToDelete(null);
          }
        }}
        onCancel={() => setAccountToDelete(null)}
      />

      <ConfirmDeleteModal
        isOpen={txToDelete !== null}
        title="حذف تراکنش مالی"
        itemName={txToDelete?.title}
        message="آیا از حذف این تراکنش اطمینان دارید؟ بالانس حساب مربوطه به مقدار قبلی باز خواهد گشت."
        onConfirm={async () => {
          if (txToDelete) {
            await onDeleteTransaction(txToDelete.id);
            soundFx.playDelete();
            setTxToDelete(null);
          }
        }}
        onCancel={() => setTxToDelete(null)}
      />

      {/* Financial Category Manager Modal */}
      <FinancialCategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        transactions={transactions}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
        onReassignAndDeleteCategory={onReassignAndDeleteCategory}
      />
    </div>
  );
};
