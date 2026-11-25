/* =========================================================
   STORAGE MODULE - VERSIONED LOCALSTORAGE & BACKUP/RESTORE
   ========================================================= */

(function (global) {
  'use strict';

  const VBS = (global.VBS = global.VBS || {});
  const SCHEMA_VERSION = 1;

  const KEYS = {
    CUSTOMERS: 'vegetable_billing_customers',
    BILLS: 'vegetable_billing_bills',
    SETTINGS: 'vegetable_billing_settings',
    COUNTER: 'vegetable_billing_counter'
  };

  const HEADING_PRESETS = {
    telugu: {
      billTitle: 'క్యాష్ బిల్లు',
      dateLabel: 'తేది',
      sriLabel: 'శ్రీ',
      slNo: 'నెం.',
      particulars: 'వివరములు',
      qty: 'కేజీలు',
      rate: 'రేటు',
      amount: 'మొత్తం',
      totalLabel: 'మొత్తం',
      signatureLabel: 'సంతకం'
    },
    bilingual: {
      billTitle: 'క్యాష్ బిల్లు / CASH BILL',
      dateLabel: 'తేది / Date',
      sriLabel: 'శ్రీ / To',
      slNo: 'నెం.',
      particulars: 'వివరములు / Particulars',
      qty: 'కేజీలు / Qty',
      rate: 'రేటు / Rate',
      amount: 'మొత్తం / Amount',
      totalLabel: 'మొత్తం / Total',
      signatureLabel: 'సంతకం / Signature'
    },
    english: {
      billTitle: 'CASH BILL',
      dateLabel: 'Date',
      sriLabel: 'To',
      slNo: 'Sl. No.',
      particulars: 'Particulars',
      qty: 'KG / Qty',
      rate: 'Rate',
      amount: 'Amount',
      totalLabel: 'Total',
      signatureLabel: 'Signature'
    }
  };

  function getDefaultSettings() {
    const h = HEADING_PRESETS.telugu;
    return {
      businessName: 'శ్రీ రాధాకృష్ణ విజిటబుల్స్, ఫ్రూట్స్, చికెన్, ఫిష్ & ఎగ్స్',
      proprietor: 'ప్రొ॥ పి.ఎన్.ఎస్. సత్యనారాయణ',
      phone: '9491841791, 9182574191',
      address: 'బొడ్డవర గ్రామం, ఎస్.కోట మండలం, విజయనగరం జిల్లా',
      logoDataUrl: '',
      defaultBillTitle: h.billTitle,
      defaultLanguage: 'telugu',
      billPrefix: 'VS',
      paperSize: 'A4',
      showRupeesPaise: true,
      padMinimum15Rows: true,
      showAmountInWords: false,
      headings: {
        dateLabel: h.dateLabel,
        sriLabel: h.sriLabel,
        slNo: h.slNo,
        particulars: h.particulars,
        qty: h.qty,
        rate: h.rate,
        amount: h.amount,
        totalLabel: h.totalLabel,
        signatureLabel: h.signatureLabel
      }
    };
  }

  function getDefaultCustomers() {
    const now = new Date().toISOString();
    return [
      {
        id: 'cust_sample_aptdc',
        name: 'APTDC',
        contactPerson: '',
        phone: '',
        address: '',
        notes: 'Sample customer — edit details anytime',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cust_sample_school1',
        name: 'School 1',
        contactPerson: '',
        phone: '',
        address: '',
        notes: 'Sample institution',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cust_sample_school2',
        name: 'School 2',
        contactPerson: '',
        phone: '',
        address: '',
        notes: 'Sample institution',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'cust_sample_other',
        name: 'Other Institutions',
        contactPerson: '',
        phone: '',
        address: '',
        notes: 'Sample general institution entry',
        active: true,
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  function getDefaultCounter() {
    return {
      nextNumber: 1,
      reservedNumbers: []
    };
  }

  const storageWarnings = [];

  function recordWarning(key, msg) {
    const exists = storageWarnings.some(function (w) {
      return w.key === key;
    });
    if (!exists) {
      storageWarnings.push({ key: key, message: msg });
    }
  }

  function clearWarnings() {
    storageWarnings.length = 0;
  }

  function readEnvelope(key, validator, defaultFactory, seedIfMissing) {
    let raw = null;
    try {
      raw = global.localStorage.getItem(key);
    } catch (e) {
      recordWarning(key, 'Browser storage access failed for ' + key + '.');
      return { ok: false, data: defaultFactory() };
    }

    if (raw === null) {
      const fresh = defaultFactory();
      if (seedIfMissing) {
        writeEnvelope(key, fresh);
      }
      return { ok: true, data: fresh };
    }

    try {
      const parsed = JSON.parse(raw);
      // Support both versioned envelope { version, data } and direct shape
      const payload =
        parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'data') && Object.prototype.hasOwnProperty.call(parsed, 'version')
          ? parsed.data
          : parsed;

      if (!validator(payload)) {
        recordWarning(key, 'Stored data in "' + key + '" has an unexpected format and was not overwritten.');
        return { ok: false, data: defaultFactory() };
      }

      return { ok: true, data: payload };
    } catch (err) {
      recordWarning(key, 'Stored data in "' + key + '" is corrupted JSON and was preserved safely without overwriting.');
      return { ok: false, data: defaultFactory() };
    }
  }

  function writeEnvelope(key, data) {
    const envelope = {
      version: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      data: data
    };
    try {
      global.localStorage.setItem(key, JSON.stringify(envelope));
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e && e.name === 'QuotaExceededError'
          ? 'Browser storage quota exceeded. Please export a backup and remove large images or old items.'
          : 'Failed to save to browser storage.'
      };
    }
  }

  function mergeSettingsWithDefaults(loaded) {
    const def = getDefaultSettings();
    const src = loaded && typeof loaded === 'object' ? loaded : {};
    const hSrc = src.headings && typeof src.headings === 'object' ? src.headings : {};
    return {
      businessName: typeof src.businessName === 'string' ? src.businessName : def.businessName,
      proprietor: typeof src.proprietor === 'string'
        ? (src.proprietor === 'ప్రొ॥ పి.ఎస్.ఎస్. సత్యనారాయణ' ? def.proprietor : src.proprietor)
        : def.proprietor,
      phone: typeof src.phone === 'string' ? src.phone : def.phone,
      address: typeof src.address === 'string' ? src.address : def.address,
      logoDataUrl: typeof src.logoDataUrl === 'string' ? src.logoDataUrl : def.logoDataUrl,
      defaultBillTitle: typeof src.defaultBillTitle === 'string' ? src.defaultBillTitle : def.defaultBillTitle,
      defaultLanguage: ['telugu', 'bilingual', 'english'].indexOf(src.defaultLanguage) !== -1 ? src.defaultLanguage : def.defaultLanguage,
      billPrefix: typeof src.billPrefix === 'string' && src.billPrefix.trim() ? src.billPrefix.trim() : def.billPrefix,
      paperSize: typeof src.paperSize === 'string' ? src.paperSize : def.paperSize,
      showRupeesPaise: typeof src.showRupeesPaise === 'boolean' ? src.showRupeesPaise : def.showRupeesPaise,
      padMinimum15Rows: typeof src.padMinimum15Rows === 'boolean' ? src.padMinimum15Rows : def.padMinimum15Rows,
      showAmountInWords: typeof src.showAmountInWords === 'boolean' ? src.showAmountInWords : def.showAmountInWords,
      headings: {
        dateLabel: typeof hSrc.dateLabel === 'string' && hSrc.dateLabel.trim() ? hSrc.dateLabel : def.headings.dateLabel,
        sriLabel: typeof hSrc.sriLabel === 'string' && hSrc.sriLabel.trim() ? hSrc.sriLabel : def.headings.sriLabel,
        slNo: typeof hSrc.slNo === 'string' && hSrc.slNo.trim() ? hSrc.slNo : def.headings.slNo,
        particulars: typeof hSrc.particulars === 'string' && hSrc.particulars.trim() ? hSrc.particulars : def.headings.particulars,
        qty: typeof hSrc.qty === 'string' && hSrc.qty.trim() ? hSrc.qty : def.headings.qty,
        rate: typeof hSrc.rate === 'string' && hSrc.rate.trim() ? hSrc.rate : def.headings.rate,
        amount: typeof hSrc.amount === 'string' && hSrc.amount.trim() ? hSrc.amount : def.headings.amount,
        totalLabel: typeof hSrc.totalLabel === 'string' && hSrc.totalLabel.trim() ? hSrc.totalLabel : def.headings.totalLabel,
        signatureLabel: typeof hSrc.signatureLabel === 'string' && hSrc.signatureLabel.trim() ? hSrc.signatureLabel : def.headings.signatureLabel
      }
    };
  }

  function isValidCustomerArray(val) {
    return Array.isArray(val) && val.every(function (c) {
      return c && typeof c === 'object' && typeof c.id === 'string' && typeof c.name === 'string';
    });
  }

  function isValidBillsArray(val) {
    return Array.isArray(val) && val.every(function (b) {
      return b && typeof b === 'object' && typeof b.id === 'string' && typeof b.billNumber === 'string' && Array.isArray(b.items);
    });
  }

  function isValidSettingsObj(val) {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  function isValidCounterObj(val) {
    return val !== null && typeof val === 'object' && !Array.isArray(val) && typeof val.nextNumber === 'number' && val.nextNumber >= 1;
  }

  /* ---- Public CRUD Accessors ---- */

  function getCustomers() {
    const res = readEnvelope(KEYS.CUSTOMERS, isValidCustomerArray, getDefaultCustomers, true);
    return res.data;
  }

  function saveCustomers(customers) {
    return writeEnvelope(KEYS.CUSTOMERS, customers);
  }

  function getBills() {
    const res = readEnvelope(KEYS.BILLS, isValidBillsArray, function () { return []; }, true);
    return res.data;
  }

  function saveBills(bills) {
    return writeEnvelope(KEYS.BILLS, bills);
  }

  function getSettings() {
    const res = readEnvelope(KEYS.SETTINGS, isValidSettingsObj, getDefaultSettings, true);
    return mergeSettingsWithDefaults(res.data);
  }

  function saveSettings(settings) {
    return writeEnvelope(KEYS.SETTINGS, mergeSettingsWithDefaults(settings));
  }

  function getCounter() {
    const res = readEnvelope(KEYS.COUNTER, isValidCounterObj, getDefaultCounter, true);
    const c = res.data;
    return {
      nextNumber: Math.max(1, parseInt(c.nextNumber, 10) || 1),
      reservedNumbers: Array.isArray(c.reservedNumbers) ? c.reservedNumbers : []
    };
  }

  function saveCounter(counter) {
    return writeEnvelope(KEYS.COUNTER, {
      nextNumber: Math.max(1, parseInt(counter.nextNumber, 10) || 1),
      reservedNumbers: Array.isArray(counter.reservedNumbers) ? counter.reservedNumbers.slice(-500) : []
    });
  }

  /**
   * Peek the next available sequential bill number without incrementing the persisted counter.
   */
  function peekNextBillNumber() {
    const settings = getSettings();
    const counter = getCounter();
    const bills = getBills();
    const existingSet = new Set(bills.map(function (b) { return b.billNumber; }));
    const reservedSet = new Set(counter.reservedNumbers || []);

    let seq = counter.nextNumber;
    let candidate = VBS.Calculations.formatBillNumber(settings.billPrefix, seq);
    while (existingSet.has(candidate) || reservedSet.has(candidate)) {
      seq += 1;
      candidate = VBS.Calculations.formatBillNumber(settings.billPrefix, seq);
    }
    return { seq: seq, billNumber: candidate };
  }

  /**
   * Reserve & advance the sequential bill counter permanently so deleted/cancelled drafts never reuse a number.
   */
  function reserveBillNumber(billNumberToReserve) {
    const settings = getSettings();
    const counter = getCounter();
    const bills = getBills();
    const existingSet = new Set(bills.map(function (b) { return b.billNumber; }));
    const reservedSet = new Set(counter.reservedNumbers || []);

    let seq = counter.nextNumber;
    let candidate = VBS.Calculations.formatBillNumber(settings.billPrefix, seq);

    if (billNumberToReserve && !existingSet.has(billNumberToReserve) && !reservedSet.has(billNumberToReserve)) {
      candidate = billNumberToReserve;
      const match = String(billNumberToReserve).match(/(\d+)$/);
      if (match) {
        const parsedSeq = parseInt(match[1], 10);
        if (parsedSeq >= seq) {
          seq = parsedSeq;
        }
      }
    } else {
      while (existingSet.has(candidate) || reservedSet.has(candidate)) {
        seq += 1;
        candidate = VBS.Calculations.formatBillNumber(settings.billPrefix, seq);
      }
    }

    reservedSet.add(candidate);
    saveCounter({
      nextNumber: seq + 1,
      reservedNumbers: Array.from(reservedSet)
    });
    return candidate;
  }

  /**
   * Generate a unique ID for records.
   */
  function generateId(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /* ---- Backup & Restore ---- */

  function exportBackupPayload() {
    return {
      app: 'vegetable-billing-management-system',
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        customers: getCustomers(),
        bills: getBills(),
        settings: getSettings(),
        counter: getCounter()
      }
    };
  }

  function validateBackupPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Backup file does not contain a valid JSON object.' };
    }
    const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;

    if (!isValidCustomerArray(data.customers)) {
      return { valid: false, error: 'Backup is missing a valid customers list.' };
    }
    if (!isValidBillsArray(data.bills)) {
      return { valid: false, error: 'Backup is missing a valid bills list.' };
    }
    if (!isValidSettingsObj(data.settings)) {
      return { valid: false, error: 'Backup is missing valid settings.' };
    }
    if (!isValidCounterObj(data.counter)) {
      return { valid: false, error: 'Backup is missing a valid bill counter.' };
    }

    // Validate bill items shape
    for (let i = 0; i < data.bills.length; i += 1) {
      const b = data.bills[i];
      if (!Array.isArray(b.items)) {
        return { valid: false, error: 'Bill ' + (b.billNumber || i + 1) + ' has invalid items.' };
      }
    }

    return {
      valid: true,
      summary: {
        customersCount: data.customers.length,
        billsCount: data.bills.length,
        nextNumber: data.counter.nextNumber,
        exportedAt: payload.exportedAt || null
      },
      normalizedData: {
        customers: data.customers,
        bills: data.bills,
        settings: mergeSettingsWithDefaults(data.settings),
        counter: {
          nextNumber: Math.max(1, parseInt(data.counter.nextNumber, 10) || 1),
          reservedNumbers: Array.isArray(data.counter.reservedNumbers) ? data.counter.reservedNumbers : []
        }
      }
    };
  }

  function restoreBackupPayload(payload) {
    const check = validateBackupPayload(payload);
    if (!check.valid) {
      return { ok: false, error: check.error };
    }
    const d = check.normalizedData;
    const r1 = saveCustomers(d.customers);
    const r2 = saveBills(d.bills);
    const r3 = saveSettings(d.settings);
    const r4 = saveCounter(d.counter);

    if (!r1.ok || !r2.ok || !r3.ok || !r4.ok) {
      return { ok: false, error: (r1.error || r2.error || r3.error || r4.error) };
    }
    clearWarnings();
    return { ok: true, summary: check.summary };
  }

  /**
   * Export bills list as UTF-8 BOM CSV for clean Excel opening (preserving Telugu text).
   */
  function exportBillsCsv(billsList) {
    const bills = Array.isArray(billsList) ? billsList : getBills();
    const Calc = VBS.Calculations;

    function csvCell(val) {
      const s = val === null || val === undefined ? '' : String(val);
      return '"' + s.replace(/"/g, '""') + '"';
    }

    const headers = [
      'Bill Number',
      'Date',
      'Status',
      'Customer Name',
      'Items Count',
      'Items Summary',
      'Grand Total (INR)'
    ];

    const rows = [headers.map(csvCell).join(',')];
    bills.forEach(function (bill) {
      const itemsSummary = (bill.items || []).map(function (it) {
        const amt = Calc.formatPaise(Calc.calculateItemAmountPaise(it), { noSymbol: true });
        if (it.type === 'kg') {
          return it.name + ' (' + Calc.formatQtyNumber(it.kg) + ' KG x ' + it.rate + ' = ' + amt + ')';
        }
        if (it.type === 'quantity') {
          const u = it.unit ? ' ' + it.unit : '';
          return it.name + ' (' + Calc.formatQtyNumber(it.quantity) + u + ' x ' + it.rate + ' = ' + amt + ')';
        }
        return it.name + ' (Direct = ' + amt + ')';
      }).join('; ');

      const totalStr = Calc.formatPaise(bill.grandTotalPaise || Calc.calculateGrandTotalPaise(bill.items), { noSymbol: true });
      rows.push([
        bill.billNumber,
        Calc.formatDateDisplay(bill.date, false),
        bill.status || 'finalized',
        bill.customerName || '',
        (bill.items || []).length,
        itemsSummary,
        totalStr
      ].map(csvCell).join(','));
    });

    return '\uFEFF' + rows.join('\r\n');
  }

  function clearAllData() {
    global.localStorage.removeItem(KEYS.CUSTOMERS);
    global.localStorage.removeItem(KEYS.BILLS);
    global.localStorage.removeItem(KEYS.SETTINGS);
    global.localStorage.removeItem(KEYS.COUNTER);
    clearWarnings();
  }

  VBS.Storage = {
    KEYS: KEYS,
    HEADING_PRESETS: HEADING_PRESETS,
    getDefaultSettings: getDefaultSettings,
    getWarnings: function () { return storageWarnings.slice(); },
    getCustomers: getCustomers,
    saveCustomers: saveCustomers,
    getBills: getBills,
    saveBills: saveBills,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getCounter: getCounter,
    saveCounter: saveCounter,
    peekNextBillNumber: peekNextBillNumber,
    reserveBillNumber: reserveBillNumber,
    generateId: generateId,
    exportBackupPayload: exportBackupPayload,
    validateBackupPayload: validateBackupPayload,
    restoreBackupPayload: restoreBackupPayload,
    exportBillsCsv: exportBillsCsv,
    clearAllData: clearAllData
  };
})(window);

