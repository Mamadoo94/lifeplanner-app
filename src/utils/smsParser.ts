/**
 * SMS Parser Engine for Iranian Bank Transactions
 * Normalizes Bank Name, Amount (IRR / Tomans), Debit/Credit (برداشت / واریز),
 * Account / Card Numbers, Balances, and Timestamps.
 */

export * from './bankSmsParser';
export {
  parseSingleBankSMS as parseBankSms,
  parseMultipleBankSMS as parseMultipleBankSms,
} from './bankSmsParser';
