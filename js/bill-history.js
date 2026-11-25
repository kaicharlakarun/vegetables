/* =========================================================
   BILL HISTORY MODULE - SEARCH, FILTERS & ACTIONS
   ========================================================= */

(function (global) {
  'use strict';

  const VBS = (global.VBS = global.VBS || {});

  function sortNewestFirst(bills) {
    return bills.slice().sort(function (a, b) {
      const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCmp !== 0) return dateCmp;
      const createdCmp = String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
      if (createdCmp !== 0) return createdCmp;
      return String(b.billNumber || '').localeCompare(String(a.billNumber || ''), undefined, { numeric: true });
    });
  }

  function populateYearFilter(bills) {
    const yearSelect = document.getElementById('filter-year');
    if (!yearSelect) return;

    const currentVal = yearSelect.value;
    const yearsSet = new Set();
    const curYear = String(new Date().getFullYear());
    yearsSet.add(curYear);

    bills.forEach(function (b) {
      if (b.date && b.date.length >= 4) {
        yearsSet.add(b.date.slice(0, 4));
      }
    });

    const years = Array.from(yearsSet).sort(function (a, b) { return b.localeCompare(a); });
    let html = '<option value="">All</option>';
    years.forEach(function (yr) {
      html += '<option value="' + yr + '"' + (yr === currentVal ? ' selected' : '') + '>' + yr + '</option>';
    });
    yearSelect.innerHTML = html;
  }

  function getFilteredBills() {
    const bills = sortNewestFirst(VBS.Storage.getBills());
    populateYearFilter(bills);

    const qBill = (document.getElementById('filter-bill-no').value || '').trim().toLowerCase();
    const qCust = (document.getElementById('filter-customer').value || '').trim().toLowerCase();
    const qDate = document.getElementById('filter-date').value || '';
    const qMonth = document.getElementById('filter-month').value || '';
    const qYear = document.getElementById('filter-year').value || '';
    const qStatus = document.getElementById('filter-status').value || 'all';

    return bills.filter(function (b) {
      if (qBill && String(b.billNumber || '').toLowerCase().indexOf(qBill) === -1) return false;
      if (qCust && String(b.customerName || '').toLowerCase().indexOf(qCust) === -1) return false;
      if (qDate && b.date !== qDate) return false;
      if (qMonth && (!b.date || b.date.slice(5, 7) !== qMonth)) return false;
      if (qYear && (!b.date || b.date.slice(0, 4) !== qYear)) return false;

      if (qStatus === 'finalized' && b.status === 'draft') return false;
      if (qStatus === 'draft' && b.status !== 'draft') return false;

      return true;
    });
  }

  function buildStatusBadgeHtml(bill) {
    if (bill.status === 'draft') {
      return '<span class="status-badge status-draft">Draft</span>';
    }
    if (bill.status === 'revised') {
      const ver = (bill.revisionCount || 1) + 1;
      return (
        '<button type="button" class="status-badge status-revised border-0 btn-view-revisions" data-id="' + VBS.Calculations.escapeHtml(bill.id) + '" title="View edit history">' +
          'Revised (v' + ver + ') <i class="bi bi-clock-history"></i>' +
        '</button>'
      );
    }
    return '<span class="status-badge status-finalized">Finalized</span>';
  }

  function render() {
    const tbody = document.getElementById('history-tbody');
    const emptyEl = document.getElementById('history-empty-state');
    const summaryEl = document.getElementById('history-filter-summary');
    const tableEl = document.getElementById('history-table');
    if (!tbody || !emptyEl) return;

    const Calc = VBS.Calculations;
    const filtered = getFilteredBills();

    let totalPaise = 0;
    filtered.forEach(function (b) {
      totalPaise += (typeof b.grandTotalPaise === 'number' ? b.grandTotalPaise : Calc.calculateGrandTotalPaise(b.items));
    });

    if (summaryEl) {
      summaryEl.textContent = 'Showing ' + filtered.length + (filtered.length === 1 ? ' bill' : ' bills') + ' • Total: ' + Calc.formatPaise(totalPaise);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (tableEl) tableEl.classList.add('d-none');
      emptyEl.classList.remove('d-none');
      return;
    }

    if (tableEl) tableEl.classList.remove('d-none');
    emptyEl.classList.add('d-none');

    let html = '';
    filtered.forEach(function (bill) {
      const amountPaise = typeof bill.grandTotalPaise === 'number'
        ? bill.grandTotalPaise
        : Calc.calculateGrandTotalPaise(bill.items);
      const itemCount = Array.isArray(bill.items) ? bill.items.length : 0;
      const isDraft = bill.status === 'draft';

      html += (
        '<tr>' +
          '<td class="fw-bold mc-bill-no">' + Calc.escapeHtml(bill.billNumber) + '</td>' +
          '<td class="mc-date">' + Calc.escapeHtml(Calc.formatDateDisplay(bill.date, false) || '—') + '</td>' +
          '<td class="fw-medium mc-customer">' + Calc.escapeHtml(bill.customerName || '—') + '</td>' +
          '<td class="text-center mc-items-count"><span class="badge text-bg-light border text-dark">' + itemCount + '</span></td>' +
          '<td class="mc-status">' + buildStatusBadgeHtml(bill) + '</td>' +
          '<td class="text-end fw-bold mc-amount">' + Calc.formatPaise(amountPaise) + '</td>' +
          '<td class="text-end mc-actions">' +
            '<div class="btn-group btn-group-sm">' +
              '<button type="button" class="btn btn-outline-secondary btn-hist-view" data-id="' + Calc.escapeHtml(bill.id) + '" title="View bill">' +
                '<i class="bi bi-eye"></i>' +
              '</button>' +
              '<button type="button" class="btn btn-outline-success btn-hist-print" data-id="' + Calc.escapeHtml(bill.id) + '" title="Print bill">' +
                '<i class="bi bi-printer"></i>' +
              '</button>' +
              '<button type="button" class="btn btn-outline-dark btn-hist-pdf" data-id="' + Calc.escapeHtml(bill.id) + '" title="Download PDF">' +
                '<i class="bi bi-file-earmark-pdf"></i>' +
              '</button>' +
              '<button type="button" class="btn btn-outline-primary btn-hist-duplicate" data-id="' + Calc.escapeHtml(bill.id) + '" title="Duplicate into new bill">' +
                '<i class="bi bi-copy"></i>' +
              '</button>' +
              '<button type="button" class="btn btn-outline-secondary btn-hist-edit" data-id="' + Calc.escapeHtml(bill.id) + '" title="' + (isDraft ? 'Resume draft' : 'Revise finalized bill') + '">' +
                '<i class="bi bi-pencil"></i>' +
              '</button>' +
              '<button type="button" class="btn btn-outline-danger btn-hist-delete" data-id="' + Calc.escapeHtml(bill.id) + '" title="Delete bill">' +
                '<i class="bi bi-trash"></i>' +
              '</button>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    });

    tbody.innerHTML = html;
  }

  function showRevisionsModal(bill) {
    const bodyEl = document.getElementById('revisionModalBody');
    const titleEl = document.getElementById('revisionModalTitle');
    const Calc = VBS.Calculations;

    titleEl.textContent = 'Revision History — ' + bill.billNumber;
    const revs = Array.isArray(bill.revisions) ? bill.revisions : [];

    if (revs.length === 0) {
      bodyEl.innerHTML = '<p class="text-muted mb-0">No prior revisions recorded.</p>';
    } else {
      let rows = '';
      revs.forEach(function (rev, idx) {
        const dt = rev.revisedAt ? new Date(rev.revisedAt).toLocaleString('en-IN') : '—';
        rows += (
          '<tr>' +
            '<td>v' + (idx + 1) + ' (Before revision)</td>' +
            '<td>' + Calc.escapeHtml(dt) + '</td>' +
            '<td>' + Calc.escapeHtml(rev.previousCustomerName || '—') + '</td>' +
            '<td class="text-center">' + (rev.previousItemCount || 0) + '</td>' +
            '<td class="text-end fw-semibold">' + Calc.formatPaise(rev.previousTotalPaise || 0) + '</td>' +
          '</tr>'
        );
      });
      bodyEl.innerHTML = (
        '<div class="table-responsive">' +
          '<table class="table table-sm align-middle mb-0">' +
            '<thead class="table-light"><tr><th>Version</th><th>Revised On</th><th>Customer</th><th class="text-center">Items</th><th class="text-end">Previous Total</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>'
      );
    }

    VBS.App.showModal('revisionModal');
  }

  function handleHistoryDelete(bill) {
    const isFinalized = bill.status !== 'draft';
    const Calc = VBS.Calculations;

    VBS.App.confirmAction({
      title: isFinalized ? 'Delete Finalized Bill?' : 'Delete Draft Bill?',
      body: isFinalized
        ? '<div class="text-danger fw-semibold mb-2">Warning: This is a finalized bill!</div>Delete bill <strong>' + Calc.escapeHtml(bill.billNumber) + '</strong> (' + Calc.escapeHtml(bill.customerName) + ', ' + Calc.formatPaise(bill.grandTotalPaise) + ')? Its bill number will never be reused.'
        : 'Delete draft <strong>' + Calc.escapeHtml(bill.billNumber) + '</strong>? Its bill number will not be reused.',
      confirmText: 'Delete Bill',
      confirmClass: 'btn-danger',
      onConfirm: function () {
        const remaining = VBS.Storage.getBills().filter(function (b) { return b.id !== bill.id; });
        VBS.Storage.saveBills(remaining);
        VBS.App.refreshAllViews();
        VBS.App.showToast('Bill ' + bill.billNumber + ' deleted.', 'success');
      }
    });
  }

  function handleHistoryEdit(bill) {
    if (bill.status === 'draft') {
      VBS.Billing.loadBillForEditing(bill.id, 'edit');
      VBS.App.navigateTo('billing');
      return;
    }

    VBS.App.confirmAction({
      title: 'Revise Finalized Bill?',
      body: 'Bill <strong>' + VBS.Calculations.escapeHtml(bill.billNumber) + '</strong> is finalized. Editing it will preserve the previous total in revision history and mark the updated bill as <strong>Revised</strong>.',
      confirmText: 'Proceed to Revise',
      confirmClass: 'btn-primary',
      onConfirm: function () {
        VBS.Billing.loadBillForEditing(bill.id, 'revise');
        VBS.App.navigateTo('billing');
      }
    });
  }

  function downloadCsvFile(billsToExport, filenameSuffix) {
    const csv = VBS.Storage.exportBillsCsv(billsToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vegetable-bills-' + (filenameSuffix || VBS.Calculations.getTodayISO()) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    VBS.App.showToast('Exported bills to CSV (Excel compatible).', 'success');
  }

  function setStatusFilter(statusValue) {
    const sel = document.getElementById('filter-status');
    if (sel) {
      sel.value = statusValue;
      render();
    }
  }

  function updateActiveFilterBadge() {
    const badge = document.getElementById('history-active-filter-count');
    if (!badge) return;
    let count = 0;
    if (document.getElementById('filter-date').value) count += 1;
    if (document.getElementById('filter-month').value) count += 1;
    if (document.getElementById('filter-year').value) count += 1;
    if (document.getElementById('filter-status').value !== 'all') count += 1;
    badge.textContent = String(count);
    badge.classList.toggle('d-none', count === 0);
  }

  function resetFilters() {
    document.getElementById('filter-bill-no').value = '';
    document.getElementById('filter-customer').value = '';
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-month').value = '';
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-status').value = 'all';
    updateActiveFilterBadge();
    render();
  }

  function init() {
    ['filter-bill-no', 'filter-customer'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', render);
    });
    ['filter-date', 'filter-month', 'filter-year', 'filter-status'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function () {
          updateActiveFilterBadge();
          render();
        });
      }
    });

    const toggleBtn = document.getElementById('btn-toggle-history-filters');
    const advPanel = document.getElementById('history-advanced-filters');
    if (toggleBtn && advPanel) {
      toggleBtn.addEventListener('click', function () {
        const isOpen = advPanel.classList.toggle('show');
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
      });
    }

    const btnReset = document.getElementById('btn-reset-filters');
    if (btnReset) btnReset.addEventListener('click', resetFilters);

    const btnCsv = document.getElementById('btn-history-export-csv');
    if (btnCsv) {
      btnCsv.addEventListener('click', function () {
        const filtered = getFilteredBills();
        if (filtered.length === 0) {
          VBS.App.showToast('No bills to export.', 'warning');
          return;
        }
        downloadCsvFile(filtered);
      });
    }

    const tbody = document.getElementById('history-tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        const target = e.target;
        const btn = target.closest('button');
        if (!btn) return;
        const billId = btn.getAttribute('data-id');
        const bill = VBS.Storage.getBills().find(function (b) { return b.id === billId; });
        if (!bill) return;

        if (btn.classList.contains('btn-hist-view')) {
          VBS.BillTemplate.openPreview(bill, { backLabel: 'Close Preview' });
        } else if (btn.classList.contains('btn-hist-print')) {
          VBS.BillTemplate.openPreview(bill, { backLabel: 'Close Preview', autoPrint: true });
        } else if (btn.classList.contains('btn-hist-pdf')) {
          VBS.BillTemplate.downloadBillPdf(bill);
        } else if (btn.classList.contains('btn-hist-duplicate')) {
          VBS.Billing.loadBillForEditing(bill.id, 'duplicate');
          VBS.App.navigateTo('billing');
        } else if (btn.classList.contains('btn-hist-edit')) {
          handleHistoryEdit(bill);
        } else if (btn.classList.contains('btn-hist-delete')) {
          handleHistoryDelete(bill);
        } else if (btn.classList.contains('btn-view-revisions')) {
          showRevisionsModal(bill);
        }
      });
    }
  }

  VBS.BillHistory = {
    init: init,
    render: render,
    setStatusFilter: setStatusFilter,
    downloadCsvFile: downloadCsvFile,
    sortNewestFirst: sortNewestFirst
  };
})(window);

