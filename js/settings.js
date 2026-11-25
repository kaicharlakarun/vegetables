/* =========================================================
   SETTINGS MODULE - BUSINESS INFO, PRINT CONFIG & BACKUP
   ========================================================= */

(function (global) {
  'use strict';

  const VBS = (global.VBS = global.VBS || {});
  let stagedLogoDataUrl = '';

  function render() {
    const settings = VBS.Storage.getSettings();
    const counter = VBS.Storage.getCounter();

    document.getElementById('set-business-name').value = settings.businessName || '';
    document.getElementById('set-proprietor').value = settings.proprietor || '';
    document.getElementById('set-phone').value = settings.phone || '';
    document.getElementById('set-address').value = settings.address || '';
    document.getElementById('set-bill-title').value = settings.defaultBillTitle || '';
    document.getElementById('set-language').value = settings.defaultLanguage || 'telugu';

    document.getElementById('set-bill-prefix').value = settings.billPrefix || 'VS';
    document.getElementById('set-next-number').value = String(counter.nextNumber || 1);
    document.getElementById('set-paper-size').value = settings.paperSize || 'A4';

    const h = settings.headings;
    document.getElementById('set-col-sl').value = h.slNo || '';
    document.getElementById('set-col-particulars').value = h.particulars || '';
    document.getElementById('set-col-qty').value = h.qty || '';
    document.getElementById('set-col-rate').value = h.rate || '';
    document.getElementById('set-col-amount').value = h.amount || '';
    document.getElementById('set-label-total').value = h.totalLabel || '';
    document.getElementById('set-label-signature').value = h.signatureLabel || '';

    document.getElementById('set-show-rupees-paise').checked = Boolean(settings.showRupeesPaise);
    document.getElementById('set-pad-rows').checked = Boolean(settings.padMinimum15Rows);
    document.getElementById('set-show-words').checked = Boolean(settings.showAmountInWords);

    stagedLogoDataUrl = settings.logoDataUrl || '';
    updateLogoPreviewUi();
  }

  function updateLogoPreviewUi() {
    const wrap = document.getElementById('set-logo-preview-wrap');
    const img = document.getElementById('set-logo-preview');
    if (!wrap || !img) return;
    if (stagedLogoDataUrl) {
      img.src = stagedLogoDataUrl;
      wrap.classList.remove('d-none');
      wrap.classList.add('d-flex');
    } else {
      img.src = '';
      wrap.classList.add('d-none');
      wrap.classList.remove('d-flex');
    }
  }

  function applyHeadingPreset(lang) {
    const preset = VBS.Storage.HEADING_PRESETS[lang] || VBS.Storage.HEADING_PRESETS.telugu;
    document.getElementById('set-bill-title').value = preset.billTitle;
    document.getElementById('set-col-sl').value = preset.slNo;
    document.getElementById('set-col-particulars').value = preset.particulars;
    document.getElementById('set-col-qty').value = preset.qty;
    document.getElementById('set-col-rate').value = preset.rate;
    document.getElementById('set-col-amount').value = preset.amount;
    document.getElementById('set-label-total').value = preset.totalLabel;
    document.getElementById('set-label-signature').value = preset.signatureLabel;
  }

  function handleSaveSettings() {
    const currentSettings = VBS.Storage.getSettings();
    const lang = document.getElementById('set-language').value || 'telugu';
    const preset = VBS.Storage.HEADING_PRESETS[lang] || VBS.Storage.HEADING_PRESETS.telugu;

    const prefix = document.getElementById('set-bill-prefix').value.trim().replace(/-+$/, '') || 'VS';
    const nextNumRaw = parseInt(document.getElementById('set-next-number').value, 10);
    if (!Number.isFinite(nextNumRaw) || nextNumRaw < 1) {
      VBS.App.showToast('Next bill number must be 1 or greater.', 'warning');
      return;
    }

    const updatedSettings = {
      businessName: document.getElementById('set-business-name').value.trim(),
      proprietor: document.getElementById('set-proprietor').value.trim(),
      phone: document.getElementById('set-phone').value.trim(),
      address: document.getElementById('set-address').value.trim(),
      logoDataUrl: stagedLogoDataUrl,
      defaultBillTitle: document.getElementById('set-bill-title').value.trim() || preset.billTitle,
      defaultLanguage: lang,
      billPrefix: prefix,
      paperSize: document.getElementById('set-paper-size').value || 'A4',
      showRupeesPaise: document.getElementById('set-show-rupees-paise').checked,
      padMinimum15Rows: document.getElementById('set-pad-rows').checked,
      showAmountInWords: document.getElementById('set-show-words').checked,
      headings: {
        dateLabel: preset.dateLabel,
        sriLabel: preset.sriLabel,
        slNo: document.getElementById('set-col-sl').value.trim() || preset.slNo,
        particulars: document.getElementById('set-col-particulars').value.trim() || preset.particulars,
        qty: document.getElementById('set-col-qty').value.trim() || preset.qty,
        rate: document.getElementById('set-col-rate').value.trim() || preset.rate,
        amount: document.getElementById('set-col-amount').value.trim() || preset.amount,
        totalLabel: document.getElementById('set-label-total').value.trim() || preset.totalLabel,
        signatureLabel: document.getElementById('set-label-signature').value.trim() || preset.signatureLabel
      }
    };

    const res = VBS.Storage.saveSettings(updatedSettings);
    if (!res.ok) {
      VBS.App.showToast(res.error, 'danger');
      return;
    }

    const curCounter = VBS.Storage.getCounter();
    const counterRes = VBS.Storage.saveCounter({
      nextNumber: nextNumRaw,
      reservedNumbers: curCounter.reservedNumbers
    });
    if (!counterRes.ok) {
      VBS.App.showToast(counterRes.error, 'danger');
      return;
    }

    // If current unsaved new bill hasn't reserved a number yet, update its previewed number
    const activeBill = VBS.Billing.getCurrentBill();
    if (activeBill && !activeBill.numberReserved && activeBill.status === 'new') {
      VBS.Billing.startNewBill({ customerId: activeBill.customerId });
    }

    VBS.App.refreshAllViews();
    VBS.App.showToast('Settings saved successfully.', 'success');

    // Suppress unused variable warning for currentSettings if needed
    void currentSettings;
  }

  function handleLogoUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      VBS.App.showToast('Please select a valid image file (PNG, JPG, WEBP).', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = new Image();
      img.onload = function () {
        const maxW = 240;
        const maxH = 120;
        let w = img.width;
        let h = img.height;
        const ratio = Math.min(maxW / w, maxH / h, 1);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        stagedLogoDataUrl = canvas.toDataURL('image/png');
        updateLogoPreviewUi();
        VBS.App.showToast('Logo loaded. Click "Save Settings" to apply.', 'info');
      };
      img.onerror = function () {
        VBS.App.showToast('Could not read the selected image.', 'danger');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleExportJsonBackup() {
    const payload = VBS.Storage.exportBackupPayload();
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vegetable-billing-backup-' + VBS.Calculations.getTodayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    VBS.App.showToast('Backup exported (' + payload.data.bills.length + ' bills, ' + payload.data.customers.length + ' customers).', 'success');
  }

  function handleRestoreFileSelected(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      let parsed = null;
      try {
        parsed = JSON.parse(ev.target.result);
      } catch (e) {
        VBS.App.showToast('Invalid JSON file. Could not parse backup.', 'danger');
        return;
      }

      const validation = VBS.Storage.validateBackupPayload(parsed);
      if (!validation.valid) {
        VBS.App.showToast('Backup validation failed: ' + validation.error, 'danger');
        return;
      }

      const s = validation.summary;
      const exportedLabel = s.exportedAt ? new Date(s.exportedAt).toLocaleString('en-IN') : 'Unknown date';

      VBS.App.confirmAction({
        title: 'Restore Backup Data?',
        body:
          '<p class="mb-2">This backup contains:</p>' +
          '<ul class="mb-2">' +
            '<li><strong>' + s.billsCount + '</strong> saved bill(s)</li>' +
            '<li><strong>' + s.customersCount + '</strong> customer(s)</li>' +
            '<li>Next bill sequence: <strong>#' + s.nextNumber + '</strong></li>' +
            '<li>Exported: ' + VBS.Calculations.escapeHtml(exportedLabel) + '</li>' +
          '</ul>' +
          '<p class="text-danger small mb-0">Restoring will replace all current browser data with this backup.</p>',
        confirmText: 'Restore Backup',
        confirmClass: 'btn-primary',
        onConfirm: function () {
          const res = VBS.Storage.restoreBackupPayload(parsed);
          if (!res.ok) {
            VBS.App.showToast('Restore failed: ' + res.error, 'danger');
            return;
          }
          VBS.Billing.startNewBill();
          render();
          VBS.App.refreshAllViews();
          VBS.App.showToast('Backup restored! Recovered ' + s.billsCount + ' bills and ' + s.customersCount + ' customers.', 'success');
        }
      });
    };
    reader.readAsText(file);
  }

  function handleClearAllData() {
    VBS.App.confirmAction({
      title: 'Clear All Saved Data?',
      body: '<div class="text-danger fw-semibold mb-2">Permanent Action</div>This will delete all saved bills, customers, settings, and counters from this browser. Export a JSON backup first if you want to keep your records.',
      confirmText: 'Yes, Clear Everything',
      confirmClass: 'btn-danger',
      onConfirm: function () {
        VBS.Storage.clearAllData();
        // Re-seed clean initial defaults
        VBS.Storage.getCustomers();
        VBS.Storage.getBills();
        VBS.Storage.getSettings();
        VBS.Storage.getCounter();
        VBS.Billing.startNewBill();
        render();
        VBS.App.refreshAllViews();
        VBS.App.showToast('All data cleared and reset to fresh installation state.', 'info');
      }
    });
  }

  function init() {
    const langSelect = document.getElementById('set-language');
    if (langSelect) {
      langSelect.addEventListener('change', function () {
        applyHeadingPreset(langSelect.value);
      });
    }

    const btnResetHeadings = document.getElementById('btn-reset-bill-labels');
    if (btnResetHeadings) {
      btnResetHeadings.addEventListener('click', function () {
        applyHeadingPreset(document.getElementById('set-language').value || 'telugu');
        VBS.App.showToast('Headings reset. Click "Save Settings" to apply.', 'info');
      });
    }

    const btnSave = document.getElementById('btn-save-settings');
    if (btnSave) btnSave.addEventListener('click', handleSaveSettings);

    const logoInput = document.getElementById('set-logo-input');
    if (logoInput) {
      logoInput.addEventListener('change', function () {
        if (logoInput.files && logoInput.files[0]) {
          handleLogoUpload(logoInput.files[0]);
        }
      });
    }

    const btnRemoveLogo = document.getElementById('btn-remove-logo');
    if (btnRemoveLogo) {
      btnRemoveLogo.addEventListener('click', function () {
        stagedLogoDataUrl = '';
        if (logoInput) logoInput.value = '';
        updateLogoPreviewUi();
      });
    }

    const btnBackup = document.getElementById('btn-backup-json');
    if (btnBackup) btnBackup.addEventListener('click', handleExportJsonBackup);

    const btnCsv = document.getElementById('btn-settings-export-csv');
    if (btnCsv) {
      btnCsv.addEventListener('click', function () {
        const bills = VBS.BillHistory.sortNewestFirst(VBS.Storage.getBills());
        if (bills.length === 0) {
          VBS.App.showToast('No bills saved yet to export.', 'warning');
          return;
        }
        VBS.BillHistory.downloadCsvFile(bills, 'all-' + VBS.Calculations.getTodayISO());
      });
    }

    const restoreInput = document.getElementById('restore-file-input');
    const btnRestore = document.getElementById('btn-restore-json');
    if (btnRestore && restoreInput) {
      btnRestore.addEventListener('click', function () {
        restoreInput.value = '';
        restoreInput.click();
      });
      restoreInput.addEventListener('change', function () {
        if (restoreInput.files && restoreInput.files[0]) {
          handleRestoreFileSelected(restoreInput.files[0]);
        }
      });
    }

    const btnClear = document.getElementById('btn-clear-all-data');
    if (btnClear) btnClear.addEventListener('click', handleClearAllData);
  }

  VBS.Settings = {
    init: init,
    render: render
  };
})(window);

