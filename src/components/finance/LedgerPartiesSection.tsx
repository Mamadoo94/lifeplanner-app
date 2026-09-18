import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  Phone,
  FileText,
  DollarSign,
  Calendar,
  X,
  Check,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  LedgerParty,
  LedgerEntry,
  BankAccount,
  FinanceTransaction,
} from '../../types';
import {
  toPersianDigits,
  getTodayJalali,
  getTodayJalaliWithTime,
} from '../../utils/jalali';
import { soundFx } from '../../utils/audio';

interface LedgerPartiesSectionProps {
  parties?: LedgerParty[];
  ledgerEntries?: LedgerEntry[];
  accounts?: BankAccount[];
  onAddParty: (party: Omit<LedgerParty, 'id'>) => Promise<number>;
  onUpdateParty: (party: LedgerParty) => Promise<void>;
  onDeleteParty: (id: number) => Promise<void>;
  onAddLedgerEntry: (entry: Omit<LedgerEntry, 'id'>) => Promise<void>;
  onDeleteLedgerEntry: (id: number) => Promise<void>;
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id'>) => Promise<void>;
}

export const LedgerPartiesSection: React.FC<LedgerPartiesSectionProps> = ({
  parties = [],
  ledgerEntries = [],
  accounts = [],
  onAddParty,
  onUpdateParty,
  onDeleteParty,
  onAddLedgerEntry,
  onDeleteLedgerEntry,
  onAddTransaction,
}) => {
  const safeParties = parties || [];
  const safeEntries = ledgerEntries || [];
  const safeAccounts = accounts || [];

  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debt' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<LedgerParty | null>(null);

  // Settlement Entry Modal
  const [settlingParty, setSettlingParty] = useState<LedgerParty | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementDate, setSettlementDate] = useState(getTodayJalali());
  const [settlementAccountId, setSettlementAccountId] = useState<number | undefined>(accounts[0]?.id);
  const [recordInAccount, setRecordInAccount] = useState(true);
  const [settlementNotes, setSettlementNotes] = useState('');

  // Expanded history for party
  const [expandedPartyId, setExpandedPartyId] = useState<number | null>(null);

  // Party Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'debt' | 'credit'>('credit');
  const [totalAmount, setTotalAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Calculations
  const metrics = React.useMemo(() => {
    let totalReceivable = 0; // طلب‌های من
    let settledReceivable = 0;
    let totalPayable = 0; // بدهی‌های من
    let settledPayable = 0;

    safeParties.forEach((p) => {
      if (p.type === 'credit') {
        totalReceivable += p.total_amount;
        settledReceivable += p.settled_amount;
      } else {
        totalPayable += p.total_amount;
        settledPayable += p.settled_amount;
      }
    });

    const remainingReceivable = Math.max(0, totalReceivable - settledReceivable);
    const remainingPayable = Math.max(0, totalPayable - settledPayable);
    const netBalance = remainingReceivable - remainingPayable;

    return {
      totalReceivable,
      remainingReceivable,
      totalPayable,
      remainingPayable,
      netBalance,
    };
  }, [safeParties]);

  // Filtered Parties
  const filteredParties = safeParties.filter((p) => {
    if (filterType === 'settled') {
      if (p.status !== 'settled') return false;
    } else if (filterType === 'credit') {
      if (p.type !== 'credit' || p.status === 'settled') return false;
    } else if (filterType === 'debt') {
      if (p.type !== 'debt' || p.status === 'settled') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchPhone = (p.phone || '').includes(q);
      const matchNotes = (p.notes || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchNotes) return false;
    }

    return true;
  });

  const resetPartyForm = () => {
    setIsAddPartyOpen(false);
    setEditingParty(null);
    setName('');
    setPhone('');
    setType('credit');
    setTotalAmount('');
    setDueDate('');
    setNotes('');
  };

  const handleOpenEdit = (p: LedgerParty) => {
    setEditingParty(p);
    setName(p.name);
    setPhone(p.phone || '');
    setType(p.type);
    setTotalAmount(String(p.total_amount));
    setDueDate(p.due_date_jalali || '');
    setNotes(p.notes || '');
    setIsAddPartyOpen(true);
  };

  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseInt(totalAmount.replace(/,/g, ''), 10) || 0;
    if (!name.trim() || cleanAmount <= 0) return;

    if (editingParty && editingParty.id) {
      const isNowSettled = editingParty.settled_amount >= cleanAmount;
      await onUpdateParty({
        ...editingParty,
        name: name.trim(),
        phone: phone.trim() || undefined,
        type,
        total_amount: cleanAmount,
        due_date_jalali: dueDate.trim() || undefined,
        notes: notes.trim() || undefined,
        status: isNowSettled ? 'settled' : 'active',
      });
    } else {
      await onAddParty({
        name: name.trim(),
        phone: phone.trim() || undefined,
        type,
        total_amount: cleanAmount,
        settled_amount: 0,
        due_date_jalali: dueDate.trim() || undefined,
        notes: notes.trim() || undefined,
        status: 'active',
        created_at: getTodayJalaliWithTime(),
      });
    }

    soundFx.playAdd();
    resetPartyForm();
  };

  // Open Settlement Modal
  const handleOpenSettlement = (party: LedgerParty) => {
    setSettlingParty(party);
    const remaining = Math.max(0, party.total_amount - party.settled_amount);
    setSettlementAmount(String(remaining));
    setSettlementDate(getTodayJalali());
    setSettlementAccountId(accounts[0]?.id);
    setRecordInAccount(true);
    setSettlementNotes('');
  };

  // Submit Settlement
  const handleSubmitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingParty || !settlingParty.id) return;

    const parsedAmt = parseInt(settlementAmount.replace(/,/g, ''), 10) || 0;
    if (parsedAmt <= 0) return;

    // 1. Add ledger entry
    await onAddLedgerEntry({
      party_id: settlingParty.id,
      type: 'settlement',
      amount: parsedAmt,
      date_jalali: settlementDate,
      account_id: recordInAccount ? settlementAccountId : undefined,
      notes: settlementNotes.trim() || `تسویه با ${settlingParty.name}`,
      created_at: getTodayJalaliWithTime(),
    });

    // 2. Update party settled amount
    const newSettled = settlingParty.settled_amount + parsedAmt;
    const isFullySettled = newSettled >= settlingParty.total_amount;

    await onUpdateParty({
      ...settlingParty,
      settled_amount: newSettled,
      status: isFullySettled ? 'settled' : 'active',
    });

    // 3. Optional: Add bank transaction
    if (recordInAccount && settlementAccountId) {
      const isIncome = settlingParty.type === 'credit'; // دریافت طلب = واریز به حساب
      await onAddTransaction({
        account_id: settlementAccountId,
        type: isIncome ? 'income' : 'expense',
        amount: parsedAmt,
        category_name: isIncome ? 'سایر واریزها' : 'اقساط و تعهدات',
        subcategory_name: isIncome ? 'دریافت طلب شخصی' : 'تسویه بدهی شخص',
        description: isIncome
          ? `دریافت طلب از ${settlingParty.name}`
          : `پرداخت بدهی به ${settlingParty.name}`,
        date_jalali: settlementDate,
        time: '12:00',
        created_at: getTodayJalaliWithTime(),
      });
    }

    soundFx.playComplete();
    setSettlingParty(null);
  };

  return (
    <div className="space-y-4">
      {/* Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Receivables */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-emerald-400 mb-1">
            <ArrowUpRight className="w-4 h-4" />
            <span>طلب‌های من از دیگران</span>
          </div>
          <div className="text-base sm:text-xl font-black text-emerald-400 font-mono" dir="ltr">
            {toPersianDigits(metrics.remainingReceivable.toLocaleString())} تومان
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            کل طلب: {toPersianDigits(metrics.totalReceivable.toLocaleString())} ت
          </div>
        </div>

        {/* Debts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-amber-400 mb-1">
            <ArrowDownLeft className="w-4 h-4" />
            <span>بدهی‌های من به دیگران</span>
          </div>
          <div className="text-base sm:text-xl font-black text-amber-400 font-mono" dir="ltr">
            {toPersianDigits(metrics.remainingPayable.toLocaleString())} تومان
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            کل بدهی: {toPersianDigits(metrics.totalPayable.toLocaleString())} ت
          </div>
        </div>

        {/* Net Position */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-indigo-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span>تراز خالص حساب اشخاص</span>
          </div>
          <div
            className={`text-base sm:text-xl font-black font-mono ${
              metrics.netBalance >= 0 ? 'text-cyan-400' : 'text-rose-400'
            }`}
            dir="ltr"
          >
            {metrics.netBalance >= 0 ? '+' : ''}
            {toPersianDigits(metrics.netBalance.toLocaleString())} تومان
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {metrics.netBalance >= 0 ? 'مازاد طلب نسبت به بدهی' : 'بدهی بیش از طلب'}
          </div>
        </div>
      </div>

      {/* Action and Filters Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filterType === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              همه ({toPersianDigits(parties.length)})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('credit')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filterType === 'credit' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              طلب‌ها
            </button>
            <button
              type="button"
              onClick={() => setFilterType('debt')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filterType === 'debt' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              بدهی‌ها
            </button>
            <button
              type="button"
              onClick={() => setFilterType('settled')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filterType === 'settled' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              تسویه‌شده
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی شخص یا شرکت..."
              className="bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            resetPartyForm();
            setIsAddPartyOpen(true);
          }}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن شخص جدید</span>
        </button>
      </div>

      {/* Parties List */}
      <div className="space-y-3">
        {filteredParties.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-xs">هیچ رکوردی مطابق فیلتر یافت نشد.</p>
          </div>
        ) : (
          filteredParties.map((party) => {
            const isSettled = party.status === 'settled';
            const remaining = Math.max(0, party.total_amount - party.settled_amount);
            const percent = Math.min(100, Math.round((party.settled_amount / (party.total_amount || 1)) * 100));
            const isCredit = party.type === 'credit';
            const isExpanded = expandedPartyId === party.id;
            const entries = safeEntries.filter((e) => e && e.party_id === party.id);

            return (
              <div
                key={party.id}
                className={`bg-slate-900 border rounded-2xl p-4 transition-all ${
                  isSettled
                    ? 'border-slate-800/60 opacity-70'
                    : isCredit
                    ? 'border-emerald-500/20 hover:border-emerald-500/40'
                    : 'border-amber-500/20 hover:border-amber-500/40'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        isCredit
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                          : 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                      }`}
                    >
                      {isCredit ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-200">{party.name}</h4>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            isCredit ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'
                          }`}
                        >
                          {isCredit ? 'طلب من' : 'بدهی من'}
                        </span>
                        {isSettled && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>تسویه کامل</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        {party.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span dir="ltr">{party.phone}</span>
                          </span>
                        )}
                        {party.due_date_jalali && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>سررسید: {toPersianDigits(party.due_date_jalali)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amounts & Quick Actions */}
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className="text-xs text-slate-400">باقیمانده:</div>
                      <div
                        className={`text-sm sm:text-base font-black font-mono ${
                          isCredit ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                        dir="ltr"
                      >
                        {toPersianDigits(remaining.toLocaleString())} تومان
                      </div>
                      <div className="text-[10px] text-slate-500" dir="ltr">
                        از {toPersianDigits(party.total_amount.toLocaleString())} ت
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {!isSettled && (
                        <button
                          type="button"
                          onClick={() => handleOpenSettlement(party)}
                          className="px-2.5 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>ثبت تسویه</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(party)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg"
                        title="ویرایش"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => party.id && onDeleteParty(party.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center gap-3">
                  <div className="flex-1 bg-slate-950 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isCredit ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {toPersianDigits(percent)}٪ تسویه شده
                  </span>

                  <button
                    type="button"
                    onClick={() => setExpandedPartyId(isExpanded ? null : party.id || null)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 ml-2"
                  >
                    <span>سوابق ({toPersianDigits(entries.length)})</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Expanded Entries History */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                    <span className="text-xs font-bold text-slate-300 block mb-1">
                      ریز پرداخت‌ها و دریافت‌های ثبت‌شده:
                    </span>
                    {entries.length === 0 ? (
                      <p className="text-[11px] text-slate-500">هنوز پرداختی ثبت نشده است.</p>
                    ) : (
                      entries.map((ent) => (
                        <div
                          key={ent.id}
                          className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-mono">{toPersianDigits(ent.date_jalali)}</span>
                            <span className="text-slate-300">{ent.notes || 'تسویه حساب'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-emerald-400 font-mono" dir="ltr">
                              +{toPersianDigits(ent.amount.toLocaleString())} ت
                            </span>
                            <button
                              type="button"
                              onClick={() => ent.id && onDeleteLedgerEntry(ent.id)}
                              className="text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Party Modal */}
      {isAddPartyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 my-auto text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-400">
                <Users className="w-4 h-4" />
                <span>{editingParty ? 'ویرایش طرف حساب' : 'افزودن طرف حساب جدید'}</span>
              </h3>
              <button
                type="button"
                onClick={resetPartyForm}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveParty} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">نام شخص یا شرکت</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: مهندس حسینی"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">نوع رابطه حساب</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="credit">طلب من از شخص</option>
                    <option value="debt">بدهکاری من به شخص</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">مبلغ کل (تومان)</label>
                  <input
                    type="text"
                    value={totalAmount ? Number(totalAmount.replace(/,/g, '')).toLocaleString() : ''}
                    onChange={(e) => setTotalAmount(e.target.value.replace(/,/g, ''))}
                    placeholder="10,000,000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-left focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">شماره تماس (اختیاری)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 text-left focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">سررسید تسویه (اختیاری)</label>
                  <input
                    type="text"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    placeholder="1405/08/15"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">توضیحات یا بابتِ چیست؟</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="بابت قرض خرید تجهیزات..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetPartyForm}
                  className="px-3.5 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  ذخیره
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Settlement Entry Modal */}
      {settlingParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 my-auto text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت پرداخت / دریافت تسویه</span>
              </h3>
              <button
                type="button"
                onClick={() => setSettlingParty(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
              طرف حساب: <strong className="text-white">{settlingParty.name}</strong> ({settlingParty.type === 'credit' ? 'طلب من' : 'بدهی من'})
              <br />
              مبلغ باقیمانده:{' '}
              <strong className="text-emerald-400 font-mono">
                {toPersianDigits(Math.max(0, settlingParty.total_amount - settlingParty.settled_amount).toLocaleString())} تومان
              </strong>
            </div>

            <form onSubmit={handleSubmitSettlement} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">مبلغ پرداختی (تومان)</label>
                <input
                  type="text"
                  value={settlementAmount ? Number(settlementAmount.replace(/,/g, '')).toLocaleString() : ''}
                  onChange={(e) => setSettlementAmount(e.target.value.replace(/,/g, ''))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-left focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">تاریخ پرداخت (شمسی)</label>
                <input
                  type="text"
                  value={settlementDate}
                  onChange={(e) => setSettlementDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* Checkbox: Record in Bank Account */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={recordInAccount}
                    onChange={(e) => setRecordInAccount(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
                  />
                  <span>
                    ثبت خودکار تراکنش {settlingParty.type === 'credit' ? 'واریز' : 'برداشت'} در کارت‌های بانکی من
                  </span>
                </label>

                {recordInAccount && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">انتخاب حساب بانکی:</label>
                    <select
                      value={settlementAccountId}
                      onChange={(e) => setSettlementAccountId(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.bank_name} - {acc.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">یادداشت تسویه</label>
                <input
                  type="text"
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="مثال: انتقال کارت به کارت"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlingParty(null)}
                  className="px-3.5 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  ثبت قطعی تسویه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
