import React, { useState, useMemo } from 'react';
import {
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  AlertCircle,
  CreditCard,
  Users,
  Filter,
} from 'lucide-react';
import {
  FinanceTransaction,
  FinanceCategory,
  BankAccount,
  Loan,
  LedgerParty,
} from '../../types';
import { toPersianDigits, getTodayJalali } from '../../utils/jalali';
import { renderCategoryIcon } from '../FinancialCategoryManagerModal';
import { JalaliDatePickerField } from '../JalaliDatePickerModal';

interface FinancialAnalyticsSectionProps {
  transactions?: FinanceTransaction[];
  categories?: FinanceCategory[];
  accounts?: BankAccount[];
  loans?: Loan[];
  parties?: LedgerParty[];
}

export const FinancialAnalyticsSection: React.FC<FinancialAnalyticsSectionProps> = ({
  transactions = [],
  categories = [],
  accounts = [],
  loans = [],
  parties = [],
}) => {
  const [timeRange, setTimeRange] = useState<'all' | 'current_month' | 'three_months' | 'custom'>('current_month');
  const today = getTodayJalali();
  const currentMonthPrefix = today.substring(0, 7);
  const [customStartDate, setCustomStartDate] = useState(`${currentMonthPrefix}/01`);
  const [customEndDate, setCustomEndDate] = useState(today);

  // Filter transactions based on timeRange
  const filteredTx = useMemo(() => {
    if (timeRange === 'current_month') {
      return transactions.filter((t) => t.date_jalali.startsWith(currentMonthPrefix));
    }
    if (timeRange === 'three_months') {
      // Last 3 months
      const [y, m] = currentMonthPrefix.split('/').map(Number);
      const m1 = `${y}/${String(m).padStart(2, '0')}`;
      const m2 = m > 1 ? `${y}/${String(m - 1).padStart(2, '0')}` : `${y - 1}/12`;
      const m3 = m > 2 ? `${y}/${String(m - 2).padStart(2, '0')}` : `${y - 1}/${String(12 + (m - 2)).padStart(2, '0')}`;
      return transactions.filter(
        (t) => t.date_jalali.startsWith(m1) || t.date_jalali.startsWith(m2) || t.date_jalali.startsWith(m3)
      );
    }
    if (timeRange === 'custom') {
      return transactions.filter(
        (t) => t.date_jalali >= customStartDate && t.date_jalali <= customEndDate
      );
    }
    return transactions;
  }, [transactions, timeRange, currentMonthPrefix, customStartDate, customEndDate]);

  // Total Totals
  const { totalIncome, totalExpense, netSavings } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredTx.forEach((t) => {
      if (t.type === 'income') inc += t.amount;
      else if (t.type === 'expense') exp += t.amount;
    });
    return {
      totalIncome: inc,
      totalExpense: exp,
      netSavings: inc - exp,
    };
  }, [filteredTx]);

  // 1. Expense Breakdown by Category
  const expenseByCategory = useMemo(() => {
    const catMap = new Map<string, { amount: number; count: number; color: string; icon?: string }>();

    filteredTx
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const catName = t.category_name || 'سایر هزینه‌ها';
        const existing = catMap.get(catName) || {
          amount: 0,
          count: 0,
          color: '#f59e0b',
          icon: 'ShoppingBag',
        };

        const foundCat = categories.find((c) => c.title === catName);
        if (foundCat) {
          existing.color = foundCat.color || '#f59e0b';
          existing.icon = foundCat.icon;
        }

        existing.amount += t.amount;
        existing.count += 1;
        catMap.set(catName, existing);
      });

    const list = Array.from(catMap.entries()).map(([name, data]) => ({
      name,
      amount: data.amount,
      count: data.count,
      color: data.color,
      icon: data.icon,
      percent: totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0,
    }));

    return list.sort((a, b) => b.amount - a.amount);
  }, [filteredTx, categories, totalExpense]);

  // Donut chart SVG path calculations
  const donutSegments = useMemo(() => {
    if (totalExpense <= 0 || expenseByCategory.length === 0) return [];
    let cumulativeAngle = 0;

    return expenseByCategory.map((item) => {
      const sliceAngle = (item.amount / totalExpense) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + sliceAngle;
      cumulativeAngle += sliceAngle;

      const r = 40;
      const cx = 50;
      const cy = 50;

      const x1 = cx + r * Math.cos(((startAngle - 90) * Math.PI) / 180);
      const y1 = cy + r * Math.sin(((startAngle - 90) * Math.PI) / 180);
      const x2 = cx + r * Math.cos(((endAngle - 90) * Math.PI) / 180);
      const y2 = cy + r * Math.sin(((endAngle - 90) * Math.PI) / 180);

      const largeArc = sliceAngle > 180 ? 1 : 0;
      const pathData =
        sliceAngle >= 359.9
          ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      return {
        ...item,
        pathData,
      };
    });
  }, [expenseByCategory, totalExpense]);

  // 2. Monthly Comparison (Last 6 Months)
  const monthlyTimeline = useMemo(() => {
    const monthsMap = new Map<string, { income: number; expense: number }>();

    transactions.forEach((t) => {
      const ym = t.date_jalali.substring(0, 7);
      if (!ym) return;
      const mData = monthsMap.get(ym) || { income: 0, expense: 0 };
      if (t.type === 'income') mData.income += t.amount;
      else if (t.type === 'expense') mData.expense += t.amount;
      monthsMap.set(ym, mData);
    });

    const sortedMonths = Array.from(monthsMap.keys()).sort().slice(-6);

    let maxVal = 1000000;
    sortedMonths.forEach((m) => {
      const d = monthsMap.get(m)!;
      if (d.income > maxVal) maxVal = d.income;
      if (d.expense > maxVal) maxVal = d.expense;
    });

    return {
      months: sortedMonths.map((m) => ({
        month: m,
        income: monthsMap.get(m)?.income || 0,
        expense: monthsMap.get(m)?.expense || 0,
      })),
      maxVal,
    };
  }, [transactions]);

  // 3. Overall Financial Position (Assets vs Liabilities)
  const balanceSheet = useMemo(() => {
    const safeAccs = accounts || [];
    const safeParties = parties || [];
    const safeLoans = loans || [];

    const liquidAssets = safeAccs.reduce((s, a) => s + (a.balance || 0), 0);
    const receivables = safeParties
      .filter((p) => p && p.type === 'credit' && p.status !== 'settled')
      .reduce((s, p) => s + Math.max(0, p.total_amount - p.settled_amount), 0);

    const totalAssets = liquidAssets + receivables;

    const loanDebts = safeLoans
      .filter((l) => l && l.status === 'active')
      .reduce((s, l) => s + Math.max(0, (l.total_installments - l.paid_installments) * l.monthly_payment), 0);

    const personDebts = safeParties
      .filter((p) => p && p.type === 'debt' && p.status !== 'settled')
      .reduce((s, p) => s + Math.max(0, p.total_amount - p.settled_amount), 0);

    const totalLiabilities = loanDebts + personDebts;
    const netWorth = totalAssets - totalLiabilities;

    return {
      liquidAssets,
      receivables,
      totalAssets,
      loanDebts,
      personDebts,
      totalLiabilities,
      netWorth,
    };
  }, [accounts, parties, loans]);

  return (
    <div className="space-y-4">
      {/* Time Range Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200">تحلیل‌های جامع مالی و نمودارها</h3>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setTimeRange('current_month')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                timeRange === 'current_month' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ماه جاری ({toPersianDigits(currentMonthPrefix)})
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('three_months')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                timeRange === 'three_months' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ۳ ماه اخیر
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('custom')}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                timeRange === 'custom' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>بازه دلخواه شمسی</span>
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                timeRange === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              کل سوابق
            </button>
          </div>
        </div>

        {/* Custom Jalali Date Range Pickers */}
        {timeRange === 'custom' && (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-3 animate-fadeIn">
            <div className="flex-1 min-w-[150px]">
              <JalaliDatePickerField
                label="از تاریخ شمسی:"
                value={customStartDate}
                onChange={setCustomStartDate}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <JalaliDatePickerField
                label="تا تاریخ شمسی:"
                value={customEndDate}
                onChange={setCustomEndDate}
              />
            </div>
            <div className="text-xs text-indigo-400 font-mono self-end pb-2">
              تعداد تراکنش‌های فیلترشده: {toPersianDigits(filteredTx.length)}
            </div>
          </div>
        )}
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-emerald-400 mb-1">
            <ArrowUpRight className="w-4 h-4" />
            <span>مجموع درآمد دوره</span>
          </div>
          <div className="text-base sm:text-xl font-black text-emerald-400 font-mono" dir="ltr">
            {toPersianDigits(totalIncome.toLocaleString())} تومان
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-amber-400 mb-1">
            <ArrowDownLeft className="w-4 h-4" />
            <span>مجموع مخارج دوره</span>
          </div>
          <div className="text-base sm:text-xl font-black text-amber-400 font-mono" dir="ltr">
            {toPersianDigits(totalExpense.toLocaleString())} تومان
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs text-cyan-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>پس‌انداز خالص دوره</span>
          </div>
          <div
            className={`text-base sm:text-xl font-black font-mono ${
              netSavings >= 0 ? 'text-cyan-400' : 'text-rose-400'
            }`}
            dir="ltr"
          >
            {netSavings >= 0 ? '+' : ''}
            {toPersianDigits(netSavings.toLocaleString())} تومان
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Chart 1: Expense Breakdown Pie / Donut */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-slate-200">تفکیک هزینه‌ها بر اساس دسته‌بندی</h4>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {toPersianDigits(expenseByCategory.length)} دسته
              </span>
            </div>

            {totalExpense <= 0 || expenseByCategory.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-xs">
                <PieIcon className="w-10 h-10 opacity-30 mb-2" />
                <span>تراکنش هزینه‌ای در این بازه زمانی ثبت نشده است.</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* SVG Donut */}
                <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {donutSegments.map((seg, idx) => (
                      <path
                        key={seg.name + idx}
                        d={seg.pathData}
                        fill={seg.color}
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        className="transition-all hover:opacity-80 cursor-pointer"
                      />
                    ))}
                    {/* Inner hole */}
                    <circle cx="50" cy="50" r="24" fill="#0f172a" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-[10px] text-slate-400">کل مخارج</span>
                    <span className="text-xs font-bold text-slate-200 font-mono">
                      {toPersianDigits(Math.round(totalExpense / 1000).toLocaleString())}k
                    </span>
                  </div>
                </div>

                {/* Legend Chips */}
                <div className="flex-1 w-full space-y-2 max-h-52 overflow-y-auto pr-1">
                  {expenseByCategory.map((cat) => (
                    <div
                      key={cat.name}
                      className="flex items-center justify-between text-xs p-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-slate-300 font-medium truncate max-w-[110px] sm:max-w-[130px]">
                          {cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono font-bold">
                          {toPersianDigits(cat.percent)}٪
                        </span>
                        <span className="text-slate-300 font-mono" dir="ltr">
                          {toPersianDigits(cat.amount.toLocaleString())} ت
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Income vs Expense Monthly Bars */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-200">مقایسه درآمد و هزینه در ماه‌های اخیر</h4>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span>درآمد</span>
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  <span>هزینه</span>
                </span>
              </div>
            </div>

            {monthlyTimeline.months.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-xs">
                <BarChart3 className="w-10 h-10 opacity-30 mb-2" />
                <span>داده‌های ماهیانه کافی وجود ندارد.</span>
              </div>
            ) : (
              <div className="h-56 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-slate-800">
                {monthlyTimeline.months.map((m) => {
                  const incHeight = Math.min(100, Math.max(8, (m.income / monthlyTimeline.maxVal) * 100));
                  const expHeight = Math.min(100, Math.max(8, (m.expense / monthlyTimeline.maxVal) * 100));

                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <div className="w-full flex items-end justify-center gap-1 h-36">
                        {/* Income Bar */}
                        <div
                          className="w-3 sm:w-4 bg-emerald-500 hover:bg-emerald-400 rounded-t-md transition-all relative group"
                          style={{ height: `${incHeight}%` }}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20 bg-slate-950 text-emerald-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">
                            +{toPersianDigits(m.income.toLocaleString())} ت
                          </div>
                        </div>

                        {/* Expense Bar */}
                        <div
                          className="w-3 sm:w-4 bg-amber-500 hover:bg-amber-400 rounded-t-md transition-all relative group"
                          style={{ height: `${expHeight}%` }}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20 bg-slate-950 text-amber-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">
                            -{toPersianDigits(m.expense.toLocaleString())} ت
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {toPersianDigits(m.month.substring(5))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Chart 3: Balance Sheet & Net Worth Gauge */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-slate-200">تراز کل دارایی‌ها و تعهدات (خالص دارایی)</h4>
          </div>
          <div className="text-xs">
            خالص ثروت مالی:{' '}
            <strong
              className={`font-mono text-sm ${
                balanceSheet.netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
              dir="ltr"
            >
              {balanceSheet.netWorth >= 0 ? '+' : ''}
              {toPersianDigits(balanceSheet.netWorth.toLocaleString())} تومان
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Assets Breakdown */}
          <div className="p-3.5 bg-slate-950/60 border border-emerald-900/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
              <span className="flex items-center gap-1">
                <Wallet className="w-4 h-4" />
                <span>کل دارایی‌ها و مطالبات</span>
              </span>
              <span className="font-mono">{toPersianDigits(balanceSheet.totalAssets.toLocaleString())} تومان</span>
            </div>

            <div className="space-y-1 text-xs text-slate-400 pt-1">
              <div className="flex items-center justify-between">
                <span>موجودی نقد در کارت‌ها و حساب‌های بانکی:</span>
                <span className="text-slate-200 font-mono">
                  {toPersianDigits(balanceSheet.liquidAssets.toLocaleString())} ت
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>طلب‌های باقیمانده از اشخاص:</span>
                <span className="text-slate-200 font-mono">
                  {toPersianDigits(balanceSheet.receivables.toLocaleString())} ت
                </span>
              </div>
            </div>
          </div>

          {/* Liabilities Breakdown */}
          <div className="p-3.5 bg-slate-950/60 border border-amber-900/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
              <span className="flex items-center gap-1">
                <CreditCard className="w-4 h-4" />
                <span>کل بدهی‌ها و تعهدات</span>
              </span>
              <span className="font-mono">{toPersianDigits(balanceSheet.totalLiabilities.toLocaleString())} تومان</span>
            </div>

            <div className="space-y-1 text-xs text-slate-400 pt-1">
              <div className="flex items-center justify-between">
                <span>باقیمانده اقساط و تسهیلات بانکی:</span>
                <span className="text-slate-200 font-mono">
                  {toPersianDigits(balanceSheet.loanDebts.toLocaleString())} ت
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>بدهی‌های پرداخت‌نشده به اشخاص:</span>
                <span className="text-slate-200 font-mono">
                  {toPersianDigits(balanceSheet.personDebts.toLocaleString())} ت
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
