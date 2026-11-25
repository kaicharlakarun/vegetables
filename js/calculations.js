/* =========================================================
   CALCULATIONS & FORMATTING MODULE
   Integer-paise decimal-safe arithmetic for Indian Rupees
   ========================================================= */

(function (global) {
  'use strict';

  const VBS = (global.VBS = global.VBS || {});

  /**
   * Escape HTML special characters to prevent XSS in template rendering.
   */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Convert a decimal number or string to scaled non-negative integer without IEEE 754 drift.
   * Returns null if negative, non-numeric, or empty.
   */
  function toFixedInt(value, decimals) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    if (str === '') return null;
    if (str.startsWith('-')) return null;

    // Normalize optional leading plus sign
    const cleaned = str.startsWith('+') ? str.slice(1) : str;
    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) {
      return null;
    }

    const parts = cleaned.split('.');
    const wholePart = parts[0] || '0';
    const fracPart = parts[1] || '';

    const paddedFrac = fracPart.padEnd(decimals + 1, '0');
    const keptFrac = decimals > 0 ? paddedFrac.slice(0, decimals) : '';
    const roundDigit = Number(paddedFrac.charAt(decimals) || '0');

    let scaled = parseInt(wholePart + keptFrac, 10);
    if (!Number.isFinite(scaled)) return null;

    if (roundDigit >= 5) {
      scaled += 1;
    }
    return scaled;
  }

  /**
   * Parse non-negative numeric input cleanly (returns null if invalid/empty/negative).
   */
  function parseNonNegativeNumber(value) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    if (str === '' || str.startsWith('-')) return null;
    const num = Number(str);
    if (!Number.isFinite(num) || num < 0) return null;
    return num;
  }

  /**
   * Calculate item amount in integer paise (1 Rupee = 100 Paise).
   */
  function calculateItemAmountPaise(item) {
    if (!item || typeof item !== 'object') return 0;

    if (item.type === 'kg') {
      const kgMilli = toFixedInt(item.kg, 3);
      const ratePaise = toFixedInt(item.rate, 2);
      if (kgMilli === null || ratePaise === null) return 0;
      return Math.floor((kgMilli * ratePaise + 500) / 1000);
    }

    if (item.type === 'quantity') {
      const qtyMilli = toFixedInt(item.quantity, 3);
      const ratePaise = toFixedInt(item.rate, 2);
      if (qtyMilli === null || ratePaise === null) return 0;
      return Math.floor((qtyMilli * ratePaise + 500) / 1000);
    }

    if (item.type === 'direct') {
      const directPaise = toFixedInt(item.directAmount, 2);
      if (directPaise === null) return 0;
      return directPaise;
    }

    return 0;
  }

  /**
   * Calculate grand total in integer paise across all items.
   * No tax, discount, or extra fees are added automatically.
   */
  function calculateGrandTotalPaise(items) {
    if (!Array.isArray(items)) return 0;
    let total = 0;
    for (let i = 0; i < items.length; i += 1) {
      total += calculateItemAmountPaise(items[i]);
    }
    return total;
  }

  /**
   * Format integer rupees with Indian comma grouping (e.g., 1,23,456).
   */
  function formatIndianInteger(num) {
    const intVal = Math.floor(Math.abs(Number(num) || 0));
    try {
      return intVal.toLocaleString('en-IN');
    } catch (e) {
      const s = String(intVal);
      if (s.length <= 3) return s;
      const last3 = s.slice(-3);
      const rest = s.slice(0, -3);
      return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
    }
  }

  /**
   * Format integer paise into Indian Rupee display string.
   * Displays 2 decimal places when paise != 0 (or when alwaysDecimals=true).
   */
  function formatPaise(paise, opts) {
    const options = opts || {};
    const safePaise = Math.max(0, Math.round(Number(paise) || 0));
    const rupees = Math.floor(safePaise / 100);
    const remPaise = safePaise % 100;
    const prefix = options.noSymbol ? '' : '₹';
    const rupeesStr = formatIndianInteger(rupees);

    if (remPaise === 0 && !options.alwaysDecimals) {
      return prefix + rupeesStr;
    }
    return prefix + rupeesStr + '.' + String(remPaise).padStart(2, '0');
  }

  /**
   * Format numeric rate in INR cleanly.
   */
  function formatRate(rateValue) {
    const paise = toFixedInt(rateValue, 2);
    if (paise === null) return '₹0';
    return formatPaise(paise);
  }

  /**
   * Cleanly display KG or Quantity numbers without redundant trailing decimal zeros.
   */
  function formatQtyNumber(value) {
    const num = parseNonNegativeNumber(value);
    if (num === null) return '0';
    // Round up to 3 decimal places safely to avoid float artifacts
    const milli = toFixedInt(value, 3);
    if (milli === null) return '0';
    const whole = Math.floor(milli / 1000);
    const frac = milli % 1000;
    if (frac === 0) return String(whole);
    const fracStr = String(frac).padStart(3, '0').replace(/0+$/, '');
    return whole + '.' + fracStr;
  }

  /**
   * Format bill sequential number with prefix (e.g., VS-001).
   */
  function formatBillNumber(prefix, seqNum) {
    const cleanPrefix = String(prefix || 'VS').trim().replace(/-+$/, '') || 'VS';
    const num = Math.max(1, parseInt(seqNum, 10) || 1);
    return cleanPrefix + '-' + String(num).padStart(3, '0');
  }

  /**
   * Return today's local calendar date as YYYY-MM-DD.
   */
  function getTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  /**
   * Format YYYY-MM-DD into DD/MM/YYYY (or DD / MM / YYYY for printed bill).
   */
  function formatDateDisplay(isoDate, spaced) {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '';
    const parts = isoDate.split('-');
    const sep = spaced ? ' / ' : '/';
    return parts[2] + sep + parts[1] + sep + parts[0];
  }

  /**
   * Validate a single bill item.
   * If isDraft is true, allows zero values (as long as not negative).
   * If isDraft is false (finalizing), requires valid name and strictly positive values.
   */
  function validateItem(item, isDraft) {
    if (!item || typeof item !== 'object') {
      return { valid: false, message: 'Invalid item entry.' };
    }

    const name = String(item.name || '').trim();
    if (!isDraft && !name) {
      return { valid: false, message: 'Item name is required.' };
    }

    if (item.type === 'kg') {
      const kg = parseNonNegativeNumber(item.kg);
      const rate = parseNonNegativeNumber(item.rate);
      if (kg === null || rate === null) {
        return { valid: false, message: 'Enter valid non-negative KG and Rate.' };
      }
      if (!isDraft && (kg <= 0 || rate <= 0)) {
        return { valid: false, message: 'KG and Rate must be greater than 0 for a finalized bill.' };
      }
      return { valid: true };
    }

    if (item.type === 'quantity') {
      const qty = parseNonNegativeNumber(item.quantity);
      const rate = parseNonNegativeNumber(item.rate);
      if (qty === null || rate === null) {
        return { valid: false, message: 'Enter valid non-negative Quantity and Rate.' };
      }
      if (!isDraft && (qty <= 0 || rate <= 0)) {
        return { valid: false, message: 'Quantity and Rate must be greater than 0 for a finalized bill.' };
      }
      return { valid: true };
    }

    if (item.type === 'direct') {
      const direct = parseNonNegativeNumber(item.directAmount);
      if (direct === null) {
        return { valid: false, message: 'Enter a valid non-negative Direct Amount.' };
      }
      if (!isDraft && direct <= 0) {
        return { valid: false, message: 'Direct Amount must be greater than 0 for a finalized bill.' };
      }
      return { valid: true };
    }

    return { valid: false, message: 'Unknown billing type.' };
  }

  /**
   * Validate full bill before finalizing.
   */
  function validateBillForFinalize(bill) {
    const errors = [];
    const invalidItemIndices = [];

    if (!bill.customerId || !String(bill.customerName || '').trim()) {
      errors.push('Please select a customer / institution.');
    }

    if (!bill.date || !/^\d{4}-\d{2}-\d{2}$/.test(bill.date)) {
      errors.push('Please enter a valid bill date.');
    }

    if (!Array.isArray(bill.items) || bill.items.length === 0) {
      errors.push('Please add at least one item before finalizing the bill.');
    } else {
      bill.items.forEach(function (item, idx) {
        const res = validateItem(item, false);
        if (!res.valid) {
          invalidItemIndices.push(idx);
          errors.push('Row ' + (idx + 1) + ': ' + res.message);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      invalidItemIndices: invalidItemIndices
    };
  }

  /**
   * Convert integer paise to Indian English words (for optional bill footer).
   */
  function amountToWordsINR(paise) {
    const safePaise = Math.max(0, Math.round(Number(paise) || 0));
    const rupees = Math.floor(safePaise / 100);
    const remPaise = safePaise % 100;

    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function twoDigits(n) {
      if (n < 20) return ones[n];
      return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    }

    function convertWhole(n) {
      if (n === 0) return 'Zero';
      let out = '';
      const crore = Math.floor(n / 10000000);
      n %= 10000000;
      const lakh = Math.floor(n / 100000);
      n %= 100000;
      const thousand = Math.floor(n / 1000);
      n %= 1000;
      const hundred = Math.floor(n / 100);
      const rest = n % 100;

      if (crore) out += convertWhole(crore) + ' Crore ';
      if (lakh) out += twoDigits(lakh) + ' Lakh ';
      if (thousand) out += twoDigits(thousand) + ' Thousand ';
      if (hundred) out += ones[hundred] + ' Hundred ';
      if (rest) out += (out ? 'and ' : '') + twoDigits(rest);

      return out.trim();
    }

    let result = 'Rupees ' + convertWhole(rupees);
    if (remPaise > 0) {
      result += ' and ' + twoDigits(remPaise) + ' Paise';
    }
    return result + ' Only';
  }

  VBS.Calculations = {
    escapeHtml: escapeHtml,
    toFixedInt: toFixedInt,
    parseNonNegativeNumber: parseNonNegativeNumber,
    calculateItemAmountPaise: calculateItemAmountPaise,
    calculateGrandTotalPaise: calculateGrandTotalPaise,
    formatIndianInteger: formatIndianInteger,
    formatPaise: formatPaise,
    formatRate: formatRate,
    formatQtyNumber: formatQtyNumber,
    formatBillNumber: formatBillNumber,
    getTodayISO: getTodayISO,
    formatDateDisplay: formatDateDisplay,
    validateItem: validateItem,
    validateBillForFinalize: validateBillForFinalize,
    amountToWordsINR: amountToWordsINR
  };
})(window);

