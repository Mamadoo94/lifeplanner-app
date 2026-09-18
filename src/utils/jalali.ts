// Pure mathematical Jalali (Shamsi) calendar conversion algorithms
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  let jm: number;
  let jd: number;

  let gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];

  jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }

  return [jy, jm, jd];
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  jy += 1595;
  let days =
    -355668 +
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const sal_a = [
    0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];

  let gm = 0;
  while (gm < 13 && days >= sal_a[gm]) {
    days -= sal_a[gm];
    gm++;
  }

  return [gy, gm, days + 1];
}

export const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const PERSIAN_WEEKDAYS = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'
];

export function toPersianDigits(num: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/[0-9]/g, (w) => persianDigits[+w]);
}

export function getTodayJalali(): string {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const mm = jm < 10 ? `0${jm}` : `${jm}`;
  const dd = jd < 10 ? `0${jd}` : `${jd}`;
  return `${jy}/${mm}/${dd}`;
}

export function getTodayJalaliWithTime(): string {
  const today = getTodayJalali();
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${today} ${hh}:${min}`;
}

export function formatJalaliReadable(jalaliStr: string): string {
  try {
    const parts = jalaliStr.split('/');
    if (parts.length !== 3) return jalaliStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const monthName = PERSIAN_MONTHS[m - 1] || '';
    return `${toPersianDigits(d)} ${monthName} ${toPersianDigits(y)}`;
  } catch {
    return jalaliStr;
  }
}

export function getTodayFullString(): string {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const dayName = PERSIAN_WEEKDAYS[now.getDay()];
  const monthName = PERSIAN_MONTHS[jm - 1];
  return `${dayName}، ${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
}

// Get array of last N days in Jalali format
export function getLastNDaysJalali(n: number = 7): string[] {
  const result: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const mm = jm < 10 ? `0${jm}` : `${jm}`;
    const dd = jd < 10 ? `0${jd}` : `${jd}`;
    result.push(`${jy}/${mm}/${dd}`);
  }
  return result;
}

export interface JalaliDayInfo {
  dateJalali: string;
  dayName: string;
  shortDayName: string;
  dayNumber: string;
  isToday: boolean;
}

// Get array of last N days ending with today (e.g. 6 days ago -> today)
export function getLastNDaysJalaliInfo(n: number = 7): JalaliDayInfo[] {
  const result: JalaliDayInfo[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const mm = jm < 10 ? `0${jm}` : `${jm}`;
    const dd = jd < 10 ? `0${jd}` : `${jd}`;
    const dateJalali = `${jy}/${mm}/${dd}`;
    const dayName = PERSIAN_WEEKDAYS[d.getDay()];
    const isToday = i === 0;
    const isYesterday = i === 1;
    result.push({
      dateJalali,
      dayName: isToday ? 'امروز' : isYesterday ? 'دیروز' : dayName,
      shortDayName: isToday ? 'امروز' : isYesterday ? 'دیروز' : dayName.slice(0, 2),
      dayNumber: toPersianDigits(jd),
      isToday,
    });
  }
  return result;
}

// Get array of N days starting from today into the future (Today + next N-1 days)
export function getNextNDaysJalali(n: number = 7): JalaliDayInfo[] {
  const result: JalaliDayInfo[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const mm = jm < 10 ? `0${jm}` : `${jm}`;
    const dd = jd < 10 ? `0${jd}` : `${jd}`;
    const dateJalali = `${jy}/${mm}/${dd}`;
    const dayName = PERSIAN_WEEKDAYS[d.getDay()];
    result.push({
      dateJalali,
      dayName: i === 0 ? 'امروز' : dayName,
      shortDayName: i === 0 ? 'امروز' : dayName.slice(0, 2),
      dayNumber: toPersianDigits(jd),
      isToday: i === 0,
    });
  }
  return result;
}

export function parseJalali(dateStr: string): { year: number; month: number; day: number } {
  try {
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return { year: y, month: m, day: d };
      }
    }
  } catch {
    // fallback
  }
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return { year: jy, month: jm, day: jd };
}

export function formatJalali(year: number, month: number, day: number): string {
  const mm = month < 10 ? `0${month}` : `${month}`;
  const dd = day < 10 ? `0${day}` : `${day}`;
  return `${year}/${mm}/${dd}`;
}

export function isJalaliLeapYear(jy: number): boolean {
  const [gy, gm, gd] = jalaliToGregorian(jy, 12, 30);
  const [checkJy, checkJm, checkJd] = gregorianToJalali(gy, gm, gd);
  return checkJy === jy && checkJm === 12 && checkJd === 30;
}

export function getDaysInJalaliMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

// 0: شنبه (Saturday), 1: یکشنبه (Sunday) ... 6: جمعه (Friday)
export function getJalaliMonthStartOffset(jy: number, jm: number): number {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, 1);
  const date = new Date(gy, gm - 1, gd);
  const gDay = date.getDay(); // 0 is Sunday, 6 is Saturday
  return (gDay + 1) % 7;
}

// Get the start (Saturday) and end (Friday) of the current week in Jalali string format
export function getCurrentWeekRangeJalali(): { startJalali: string; endJalali: string } {
  const now = new Date();
  const gDay = now.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
  // In Persian calendar, Saturday is the first day of the week (index 0)
  const offsetFromSaturday = (gDay + 1) % 7;

  const saturdayDate = new Date(now);
  saturdayDate.setDate(now.getDate() - offsetFromSaturday);

  const fridayDate = new Date(now);
  fridayDate.setDate(now.getDate() + (6 - offsetFromSaturday));

  const [sy, sm, sd] = gregorianToJalali(
    saturdayDate.getFullYear(),
    saturdayDate.getMonth() + 1,
    saturdayDate.getDate()
  );
  const [fy, fm, fd] = gregorianToJalali(
    fridayDate.getFullYear(),
    fridayDate.getMonth() + 1,
    fridayDate.getDate()
  );

  return {
    startJalali: formatJalali(sy, sm, sd),
    endJalali: formatJalali(fy, fm, fd),
  };
}

// Check if a given Jalali date string falls in the current Persian week (Saturday through Friday)
export function isDateInCurrentWeekJalali(dateStr: string): boolean {
  if (!dateStr) return false;
  const cleanDate = dateStr.split(' ')[0] || dateStr;
  const { startJalali, endJalali } = getCurrentWeekRangeJalali();
  return cleanDate >= startJalali && cleanDate <= endJalali;
}

// Check if a given Jalali date string falls in the current Persian month
export function isDateInCurrentMonthJalali(dateStr: string): boolean {
  if (!dateStr) return false;
  const cleanDate = dateStr.split(' ')[0] || dateStr;
  const today = getTodayJalali();
  const [todayYear, todayMonth] = today.split('/');
  return cleanDate.startsWith(`${todayYear}/${todayMonth}/`);
}

// Get current Jalali month number (1-12) and name
export function getCurrentJalaliMonthInfo(): { monthNumber: number; monthName: string; year: number } {
  const today = getTodayJalali();
  const [y, m] = today.split('/');
  const monthNum = parseInt(m, 10);
  return {
    year: parseInt(y, 10),
    monthNumber: monthNum,
    monthName: PERSIAN_MONTHS[monthNum - 1] || '',
  };
}

// -------------------------------------------------------------
// Persian Weekdays & Habit Recurrence Schedule Helpers
// -------------------------------------------------------------
export interface PersianDayOfWeek {
  id: number; // 0 to 6 (0: شنبه, 1: یکشنبه, 2: دوشنبه, 3: سه‌شنبه, 4: چهارشنبه, 5: پنج‌شنبه, 6: جمعه)
  name: string; // 'شنبه', 'یکشنبه', ...
  shortName: string; // 'ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'
}

export const PERSIAN_WEEK_DAYS_ORDERED: PersianDayOfWeek[] = [
  { id: 0, name: 'شنبه', shortName: 'ش' },
  { id: 1, name: 'یکشنبه', shortName: 'ی' },
  { id: 2, name: 'دوشنبه', shortName: 'د' },
  { id: 3, name: 'سه‌شنبه', shortName: 'س' },
  { id: 4, name: 'چهارشنبه', shortName: 'چ' },
  { id: 5, name: 'پنج‌شنبه', shortName: 'پ' },
  { id: 6, name: 'جمعه', shortName: 'ج' },
];

// Returns Persian day of week index: 0 for Saturday, 1 for Sunday, ..., 6 for Friday
export function getPersianDayOfWeek(date: Date = new Date()): number {
  const gDay = date.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
  return (gDay + 1) % 7;
}

// Returns Persian day of week index (0..6) from a Jalali date string (YYYY/MM/DD)
export function getPersianDayOfWeekFromJalali(dateJalali: string): number {
  const { year, month, day } = parseJalali(dateJalali);
  const [gy, gm, gd] = jalaliToGregorian(year, month, day);
  const d = new Date(gy, gm - 1, gd);
  return getPersianDayOfWeek(d);
}

export interface PersianWeekDayInfo {
  dayId: number; // 0: شنبه .. 6: جمعه
  name: string;
  shortName: string;
  dateJalali: string;
  dayNumber: string;
  isToday: boolean;
  isPast: boolean;
}

// Returns all 7 days of the current Persian week (Saturday through Friday)
export function getCurrentWeekDaysJalali(): PersianWeekDayInfo[] {
  const now = new Date();
  const todayJalali = getTodayJalali();
  const gDay = now.getDay();
  const offsetFromSaturday = (gDay + 1) % 7;

  const result: PersianWeekDayInfo[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - offsetFromSaturday + i);
    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const dateJalali = formatJalali(jy, jm, jd);
    const dayDef = PERSIAN_WEEK_DAYS_ORDERED[i];
    const isToday = dateJalali === todayJalali;
    const isPast = dateJalali < todayJalali;

    result.push({
      dayId: i,
      name: dayDef.name,
      shortName: dayDef.shortName,
      dateJalali,
      dayNumber: toPersianDigits(jd),
      isToday,
      isPast,
    });
  }

  return result;
}

// Check if a habit recurrence rule matches a specific Jalali date
export function isHabitScheduledForDate(
  habit: {
    target_frequency?: string;
    weekly_days?: number[];
    monthly_type?: 'day_of_month' | 'last_day';
    monthly_day?: number;
  },
  dateJalali: string
): boolean {
  const freq = habit.target_frequency || 'daily';
  if (freq === 'daily') {
    return true;
  }

  if (freq === 'weekly') {
    if (!habit.weekly_days || habit.weekly_days.length === 0) {
      return true;
    }
    const dayId = getPersianDayOfWeekFromJalali(dateJalali);
    return habit.weekly_days.includes(dayId);
  }

  if (freq === 'monthly') {
    const { year, month, day } = parseJalali(dateJalali);
    const daysInMonth = getDaysInJalaliMonth(year, month);
    if (habit.monthly_type === 'last_day') {
      return day === daysInMonth;
    }
    const targetDay = Math.min(habit.monthly_day || 1, daysInMonth);
    return day === targetDay;
  }

  return true;
}

// Compute the scheduled target day in month (1..31) for a monthly habit
export function getHabitMonthlyScheduledDayNumber(
  habit: {
    monthly_type?: 'day_of_month' | 'last_day';
    monthly_day?: number;
  },
  year: number,
  month: number
): number {
  const daysInMonth = getDaysInJalaliMonth(year, month);
  if (habit.monthly_type === 'last_day') {
    return daysInMonth;
  }
  return Math.min(habit.monthly_day || 1, daysInMonth);
}

/**
 * Solar Hijri Monthly Week Calculation:
 * - Days 1 to 7 = Week 1 (هفته اول: روزهای ۱ تا ۷)
 * - Days 8 to 14 = Week 2 (هفته دوم: روزهای ۸ تا ۱۴)
 * - Days 15 to 21 = Week 3 (هفته سوم: روزهای ۱۵ تا ۲۱)
 * - Days 22 to end of month = Week 4 (هفته چهارم: روزهای ۲۲ تا پایان ماه)
 */
export function getMonthlyCalendarWeek(day: number): {
  weekNum: number;
  weekKey: string;
  weekName: string;
  rangeLabel: string;
} {
  if (day >= 1 && day <= 7) {
    return {
      weekNum: 1,
      weekKey: 'w1',
      weekName: 'هفته اول',
      rangeLabel: 'روزهای ۱ تا ۷',
    };
  }
  if (day >= 8 && day <= 14) {
    return {
      weekNum: 2,
      weekKey: 'w2',
      weekName: 'هفته دوم',
      rangeLabel: 'روزهای ۸ تا ۱۴',
    };
  }
  if (day >= 15 && day <= 21) {
    return {
      weekNum: 3,
      weekKey: 'w3',
      weekName: 'هفته سوم',
      rangeLabel: 'روزهای ۱۵ تا ۲۱',
    };
  }
  if (day >= 22 && day <= 28) {
    return {
      weekNum: 4,
      weekKey: 'w4',
      weekName: 'هفته چهارم',
      rangeLabel: 'روزهای ۲۲ تا ۲۸',
    };
  }
  return {
    weekNum: 5,
    weekKey: 'w5',
    weekName: 'هفته پنجم',
    rangeLabel: 'روزهای ۲۹ تا پایان ماه',
  };
}

