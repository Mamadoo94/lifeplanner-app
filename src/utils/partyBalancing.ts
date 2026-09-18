import { LedgerParty, LedgerEntry, TransactionType } from '../types';
import { getTodayJalali, getTodayJalaliWithTime } from './jalali';

export interface AutoBalanceResult {
  updatedParty: LedgerParty;
  newEntry: Omit<LedgerEntry, 'id'>;
  actionSummary: string;
}

/**
 * Auto-balances a person's ledger account when a transaction is associated with them:
 * - If the person has an active debt/credit, automatically settles the balance first.
 * - If the transaction amount exceeds the existing debt/credit, converts the remainder into credit/debt accordingly.
 */
export function autoBalancePartyAccount(
  party: LedgerParty,
  transactionType: TransactionType,
  amount: number,
  notes?: string
): AutoBalanceResult {
  const currentOutstanding = Math.max(0, party.total_amount - (party.settled_amount || 0));
  const today = getTodayJalali();
  const now = getTodayJalaliWithTime();

  let updatedParty = { ...party };
  let entryType: 'increase' | 'settlement' = 'settlement';
  let entryAmount = amount;
  let actionSummary = '';

  if (party.type === 'credit') {
    // Current state: party owes me money (طلب من از شخص)
    if (transactionType === 'income') {
      // Received money from person -> Settles the credit
      if (amount <= currentOutstanding) {
        // Partial or exact settlement
        const newSettled = (party.settled_amount || 0) + amount;
        const isFullySettled = newSettled >= party.total_amount;
        updatedParty = {
          ...party,
          settled_amount: newSettled,
          status: isFullySettled ? 'settled' : 'active',
          last_settlement_date: today,
        };
        entryType = 'settlement';
        actionSummary = `مبلغ ${amount.toLocaleString()} ت تسویه طلب از ${party.name} انجام شد.`;
      } else {
        // Overpaid! Fully settles the credit, and the remainder becomes my debt to them
        const remainder = amount - currentOutstanding;
        updatedParty = {
          ...party,
          type: 'debt', // now I owe them
          total_amount: remainder,
          settled_amount: 0,
          status: 'active',
          last_settlement_date: today,
          notes: `${party.notes || ''} [طلب قبلی تسویه و مازاد ${remainder.toLocaleString()} ت به عنوان بدهی ثبت شد]`.trim(),
        };
        entryType = 'settlement';
        actionSummary = `طلب از ${party.name} تسویه کامل شد و مازاد ${remainder.toLocaleString()} ت به بدهی به شخص تبدیل گردید.`;
      }
    } else {
      // Expense -> I gave more money to person -> Increases my credit from them
      updatedParty = {
        ...party,
        total_amount: party.total_amount + amount,
        status: 'active',
      };
      entryType = 'increase';
      actionSummary = `مبلغ ${amount.toLocaleString()} ت به طلب از ${party.name} افزوده شد.`;
    }
  } else {
    // Current state: I owe money to party (بدهی من به شخص)
    if (transactionType === 'expense') {
      // Paid money to person -> Settles my debt to them
      if (amount <= currentOutstanding) {
        // Partial or exact settlement
        const newSettled = (party.settled_amount || 0) + amount;
        const isFullySettled = newSettled >= party.total_amount;
        updatedParty = {
          ...party,
          settled_amount: newSettled,
          status: isFullySettled ? 'settled' : 'active',
          last_settlement_date: today,
        };
        entryType = 'settlement';
        actionSummary = `مبلغ ${amount.toLocaleString()} ت از بدهی به ${party.name} تسویه شد.`;
      } else {
        // Overpaid! Fully settles my debt, and remainder becomes a credit (they owe me)
        const remainder = amount - currentOutstanding;
        updatedParty = {
          ...party,
          type: 'credit', // now they owe me
          total_amount: remainder,
          settled_amount: 0,
          status: 'active',
          last_settlement_date: today,
          notes: `${party.notes || ''} [بدهی قبلی تسویه و مازاد ${remainder.toLocaleString()} ت به عنوان طلب ثبت شد]`.trim(),
        };
        entryType = 'settlement';
        actionSummary = `بدهی به ${party.name} تسویه کامل شد و مازاد ${remainder.toLocaleString()} ت به طلب از شخص تبدیل گردید.`;
      }
    } else {
      // Income -> Person gave me more money -> Increases my debt to them
      updatedParty = {
        ...party,
        total_amount: party.total_amount + amount,
        status: 'active',
      };
      entryType = 'increase';
      actionSummary = `مبلغ ${amount.toLocaleString()} ت به بدهی به ${party.name} افزوده شد.`;
    }
  }

  const newEntry: Omit<LedgerEntry, 'id'> = {
    party_id: party.id || 1,
    type: entryType,
    amount: entryAmount,
    date_jalali: today,
    created_at: now,
    notes: notes || actionSummary,
  };

  return {
    updatedParty,
    newEntry,
    actionSummary,
  };
}
