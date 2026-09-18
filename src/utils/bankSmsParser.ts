import { ParsedBankSMS, TransactionType, BankAccount, SmsPattern } from '../types';
import { getTodayJalali } from './jalali';

// Known bank signatures in Persian SMS
const BANK_SIGNATURES: { name: string; patterns: RegExp[] }[] = [
  { name: 'بلوبانک', patterns: [/بلوبانک/i, /blubank/i, /بلو\s*بانک/i] },
  { name: 'بانک سامان', patterns: [/بانک سامان/i, /سامان/i, /saman/i] },
  { name: 'بانک ملت', patterns: [/بانک ملت/i, /ملت/i, /mellat/i] },
  { name: 'بانک ملی ایران', patterns: [/بانک ملی/i, /ملی ایران/i, /bmi/i] },
  { name: 'بانک پاسارگاد', patterns: [/پاسارگاد/i, /bpi/i, /pasargad/i] },
  { name: 'بانک تجارت', patterns: [/تجارت/i, /tejarat/i] },
  { name: 'بانک سپه', patterns: [/سپه/i, /sepah/i, /انصار/i, /قوامین/i] },
  { name: 'بانک صادرات', patterns: [/صادرات/i, /bsi/i, /saderat/i] },
  { name: 'بانک کشاورزی', patterns: [/کشاورزی/i, /keshavarzi/i, /bki/i] },
  { name: 'بانک پارسیان', patterns: [/پارسیان/i, /parsian/i] },
  { name: 'بانک رسالت', patterns: [/رسالت/i, /resalat/i] },
  { name: 'بانک مهر ایران', patterns: [/مهر ایران/i, /قرض الحسنه مهر/i] },
  { name: 'بانک شهر', patterns: [/بانک شهر/i, /shahr/i] },
  { name: 'بانک رفاه کارگران', patterns: [/رفاه/i, /refah/i] },
  { name: 'بانک مسکن', patterns: [/مسکن/i, /maskan/i] },
  { name: 'بانک آینده', patterns: [/آینده/i, /ayandeh/i] },
  { name: 'بانک سینا', patterns: [/سینا/i, /sina/i] },
  { name: 'بانک دی', patterns: [/بانک دی/i, /day\s*bank/i] },
  { name: 'پست بانک', patterns: [/پست\s*بانک/i, /post\s*bank/i] },
  { name: 'بانک اقتصاد نوین', patterns: [/اقتصاد نوین/i, /en\s*bank/i] },
  { name: 'بانک کارآفرین', patterns: [/کارآفرین/i, /karafarin/i] },
];

/**
 * Helper to analyze a sample SMS and generate a template pattern
 */
export function learnPatternFromSms(sampleText: string): Partial<SmsPattern> {
  const parsed = parseSingleBankSMS(sampleText, []);
  let bankName = parsed?.bankName || 'بانک ناشناس';
  const type: TransactionType = parsed?.type || 'expense';

  return {
    bank_name: bankName,
    pattern_name: `قالب پیامک ${bankName} (${type === 'income' ? 'واریز' : 'برداشت'})`,
    sample_sms: sampleText.trim(),
    type,
    notes: 'الگوی یادگرفته‌شده از پیامک نمونه',
  };
}

/**
 * Normalizes Persian/Arabic digits to English digits and cleans whitespace
 */
export function normalizePersianDigits(str: string): string {
  if (!str) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(persianDigits[i], 'g'), String(i));
    res = res.replace(new RegExp(arabicDigits[i], 'g'), String(i));
  }
  return res;
}

/**
 * Clean text for regex matching
 */
function cleanText(text: string): string {
  return normalizePersianDigits(text)
    .replace(/\u200c/g, ' ') // half-space
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/**
 * Parse an Iranian bank SMS message into structured data
 */
export function parseSingleBankSMS(
  rawText: string,
  registeredAccounts: BankAccount[] = [],
  customPatterns: SmsPattern[] = []
): ParsedBankSMS | null {
  const text = cleanText(rawText).trim();
  if (!text || text.length < 8) return null;

  // Check custom user-defined patterns first
  let matchedCustomPattern: SmsPattern | null = null;
  for (const cp of customPatterns) {
    if (cp.bank_name && text.includes(cleanText(cp.bank_name))) {
      matchedCustomPattern = cp;
      break;
    }
  }

  // 1. Detect Bank
  let detectedBank = matchedCustomPattern?.bank_name || 'بانک ناشناس';
  if (detectedBank === 'بانک ناشناس') {
    for (const b of BANK_SIGNATURES) {
      if (b.patterns.some((p) => p.test(text))) {
        detectedBank = b.name;
        break;
      }
    }
  }

  // 2. Detect Transaction Type (برداشت / خرید / انتقال / کسر vs واریز / سود / شارژ)
  let type: TransactionType = matchedCustomPattern ? matchedCustomPattern.type : 'expense';
  if (!matchedCustomPattern) {
    const isExpense =
      /(برداشت|خرید|کسر|انتقال از|پرداخت|کاهش|بدهکار|تسویه|خرید شارژ|انتقال ساتنا از|انتقال پایا از)/i.test(text);
    const isIncome =
      /(واریز|سود|انتقال به|بستانکار|افزایش|شارژ حساب|حقوق|دریافت|پایا به|ساتنا به)/i.test(text);

    if (isIncome && !isExpense) {
      type = 'income';
    } else if (isExpense) {
      type = 'expense';
    } else {
      if (/-\s*[\d,]+/.test(text)) {
        type = 'expense';
      } else if (/\+\s*[\d,]+/.test(text)) {
        type = 'income';
      }
    }
  }

  // 3. Extract Amount & Unit (Rials vs Tomans)
  // Look for patterns like:
  // "مبلغ: 120,000 ریال", "مبلغ 500,000 تومان", "1,500,000- ریال", "واریز: 2,000,000", "+500,000"
  let extractedAmount = 0;
  let rawAmountText = '';
  let unit: 'rial' | 'toman' = 'toman';

  // Check whether SMS uses Rials
  const hasRial = /(ریال|IRR|r)/i.test(text);
  const hasToman = /(تومان|تومن|IRT)/i.test(text);
  unit = hasRial && !hasToman ? 'rial' : 'toman';

  const amountPatterns = [
    /(?:مبلغ|مبلغ تراکنش|ارزش|هزینه|کسر|برداشت|واریز)\s*[:=\-+]?\s*([\d,]+)\s*(?:ریال|تومان|تومن)?/i,
    /(?:[\+\-]\s*)([\d,]{4,})\s*(?:ریال|تومان|تومن)?/i,
    /([\d,]{4,})\s*(?:ریال|تومان|تومن)/i,
    /(?:مانده|موجودی)\s*[:=]?\s*[\d,]+\s*.*?(?:مبلغ)\s*[:=]?\s*([\d,]+)/i,
    /([\d,]{4,})\s*(?:کسر شد|برداشت شد|واریز شد)/i,
  ];

  for (const pat of amountPatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const cleanNum = m[1].replace(/,/g, '');
      const num = parseInt(cleanNum, 10);
      if (!isNaN(num) && num > 0) {
        extractedAmount = num;
        rawAmountText = m[1];
        break;
      }
    }
  }

  // Fallback: search for any large comma-separated number that isn't card number or balance
  if (extractedAmount === 0) {
    const allNumbers = text.match(/\b\d{1,3}(?:,\d{3})+\b/g);
    if (allNumbers && allNumbers.length > 0) {
      // First number is typically transaction amount
      const cleanNum = allNumbers[0].replace(/,/g, '');
      extractedAmount = parseInt(cleanNum, 10);
      rawAmountText = allNumbers[0];
    }
  }

  // Convert Rials to Tomans if applicable (Divide by 10)
  if (unit === 'rial' && extractedAmount > 0) {
    extractedAmount = Math.round(extractedAmount / 10);
  }

  // 4. Extract Card or Account Number
  let cardOrAccount = '';
  const cardPatterns = [
    /(?:کارت|card)\s*[:=]?\s*([0-9\*\-]{4,19})/i,
    /(?:حساب|حساب شماره|acc)\s*[:=]?\s*([0-9\*\-]{4,19})/i,
    /(?:از|به)\s*[:=]?\s*([0-9\*\-]{4,19})/i,
    /\b(\d{4}\*{4,8}\d{4})\b/,
    /\b(\*{4}\d{4})\b/,
    /\b(\d{4}\*+)\b/,
  ];

  for (const cp of cardPatterns) {
    const cm = text.match(cp);
    if (cm && cm[1]) {
      cardOrAccount = cm[1].trim();
      break;
    }
  }

  // 5. Match with registered account
  let matchedAccountId: number | undefined = undefined;
  if (registeredAccounts.length > 0) {
    // Try matching by card or account number substring
    if (cardOrAccount) {
      const cleanDigits = cardOrAccount.replace(/\D/g, '');
      if (cleanDigits.length >= 4) {
        const found = registeredAccounts.find((acc) => {
          if (!acc.card_number && !acc.account_number) return false;
          const accDigits = (acc.card_number || acc.account_number || '').replace(/\D/g, '');
          return accDigits.includes(cleanDigits) || cleanDigits.includes(accDigits.slice(-4));
        });
        if (found?.id) {
          matchedAccountId = found.id;
          detectedBank = found.bank_name;
        }
      }
    }

    // If still unmatched, try matching by bank name
    if (!matchedAccountId && detectedBank !== 'بانک ناشناس') {
      const found = registeredAccounts.find(
        (acc) =>
          acc.bank_name.includes(detectedBank) ||
          detectedBank.includes(acc.bank_name)
      );
      if (found?.id) {
        matchedAccountId = found.id;
      }
    }

    // Default to first account if available and confidence is decent
    if (!matchedAccountId && registeredAccounts.length > 0) {
      matchedAccountId = registeredAccounts[0].id;
    }
  }

  // 6. Extract Date and Time
  let dateJalali = getTodayJalali();
  let timeStr: string | undefined = undefined;

  // Date patterns: 1403/05/12 or 1403-05-12 or 03/05/12 or 05/12
  const datePattern = /(?:تاریخ\s*[:=]?\s*)?((?:140[0-9]|0[0-9])[\/\-](?:0[1-9]|1[0-2])[\/\-](?:0[1-9]|[12][0-9]|3[01]))/;
  const shortDatePattern = /\b((?:0[1-9]|1[0-2])[\/\-](?:0[1-9]|[12][0-9]|3[01]))\b/;
  const dateMatch = text.match(datePattern);
  if (dateMatch && dateMatch[1]) {
    let rawD = dateMatch[1].replace(/-/g, '/');
    if (rawD.startsWith('0')) {
      rawD = `14${rawD}`;
    }
    dateJalali = rawD;
  } else {
    const shortMatch = text.match(shortDatePattern);
    if (shortMatch && shortMatch[1]) {
      const today = getTodayJalali();
      const currentYear = today.split('/')[0];
      dateJalali = `${currentYear}/${shortMatch[1].replace(/-/g, '/')}`;
    }
  }

  // Time pattern: 14:35 or 14:35:20
  const timePattern = /(?:ساعت\s*[:=]?\s*)?\b([01]?[0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?\b/;
  const timeMatch = text.match(timePattern);
  if (timeMatch && timeMatch[1] && timeMatch[2]) {
    timeStr = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}`;
  }

  // 7. Extract Balance After Transaction (موجودی / مانده)
  let balanceAfter: number | undefined = undefined;
  const balancePattern = /(?:موجودی|مانده|موجودی حساب|مانده حساب)\s*[:=]?\s*([\d,]+)\s*(?:ریال|تومان|تومن)?/i;
  const balanceMatch = text.match(balancePattern);
  if (balanceMatch && balanceMatch[1]) {
    const cleanB = balanceMatch[1].replace(/,/g, '');
    let bal = parseInt(cleanB, 10);
    if (!isNaN(bal)) {
      if (unit === 'rial') {
        bal = Math.round(bal / 10);
      }
      balanceAfter = bal;
    }
  }

  // 8. Description / Merchant / Store
  let description = '';
  const descPatterns = [
    /(?:بابت|پذیرنده|فروشگاه|در|به نام|شرح)\s*[:=]?\s*([^\n\r,]+)/i,
    /(?:انتقال از طریق|دستگاه)\s*[:=]?\s*([^\n\r,]+)/i,
  ];
  for (const dp of descPatterns) {
    const dm = text.match(dp);
    if (dm && dm[1]) {
      description = dm[1].trim();
      break;
    }
  }
  if (!description) {
    description = type === 'expense' ? `خرید / برداشت (${detectedBank})` : `واریز به حساب (${detectedBank})`;
  }

  // Calculate confidence score
  let confidence = 0.5;
  if (extractedAmount > 0) confidence += 0.25;
  if (detectedBank !== 'بانک ناشناس') confidence += 0.15;
  if (cardOrAccount) confidence += 0.1;

  return {
    id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    amount: extractedAmount,
    rawAmountText,
    unit,
    bankName: detectedBank,
    accountOrCard: cardOrAccount || undefined,
    matchedAccountId,
    date_jalali: dateJalali,
    time: timeStr,
    balance_after: balanceAfter,
    description,
    raw_sms: rawText,
    confidence,
  };
}

/**
 * Split multiline or multiple SMS input (separated by dividers or blank lines) and parse each
 */
export function parseMultipleBankSMS(
  inputText: string,
  accounts: BankAccount[] = [],
  customPatterns: SmsPattern[] = []
): ParsedBankSMS[] {
  if (!inputText.trim()) return [];

  // Split by common dividers (multiple newlines, dashed lines, or specific bank headers)
  const chunks = inputText
    .split(/\n\s*[-=—_]{3,}\s*\n|\n\s*\n\s*\n/)
    .map((c) => c.trim())
    .filter((c) => c.length > 10);

  // If only 1 chunk found, also check if there are multiple lines that each look like a separate bank SMS
  let finalChunks = chunks;
  if (chunks.length === 1) {
    const subChunks = chunks[0].split(/\n\s*\n/);
    if (subChunks.length > 1) {
      finalChunks = subChunks.map((c) => c.trim()).filter((c) => c.length > 10);
    }
  }

  const results: ParsedBankSMS[] = [];
  for (const chunk of finalChunks) {
    const parsed = parseSingleBankSMS(chunk, accounts, customPatterns);
    if (parsed && parsed.amount > 0) {
      results.push(parsed);
    }
  }

  return results;
}
