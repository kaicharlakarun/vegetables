/* =========================================================
   DASHBOARD MODULE - REAL-TIME METRICS & QUICK ACTIONS
   ========================================================= */

(function (global) {
  'use strict';

  const VBS = (global.VBS = global.VBS || {});

  function render() {
    const Calc = VBS.Calculations;
    const bills = VBS.Storage.getBills();
    const customers = VBS.Storage.getCustomers();
    const todayIso = Calc.getTodayISO();

    const finalizedBills = bills.filter(function (b) { return b.status !== 'draft'; });
    const draftBills = bills.filter(function (b) { return b.status === 'draft'; });
    const todaysBills = finalizedBills.filter(function (b) { return b.date === todayIso; });

    let todaySalesPaise = 0;
    todaysBills.forEach(function (b) {
      todaySalesPaise += (typeof b.grandTotalPaise === 'number' ? b.grandTotalPaise : Calc.calculateGrandTotalPaise(b.items));
    });

    let totalBilledPaise = 0;
    finalizedBills.forEach(function (b) {
      totalBilledPaise += (typeof b.grandTotalPaise === 'number' ? b.grandTotalPaise : Calc.calculateGrandTotalPaise(b.items));
    });

    document.getElementById('kpi-total-bills').textContent = String(finalizedBills.length);
    document.getElementById('kpi-today-bills').textContent = String(todaysBills.length);
    document.getElementById('kpi-today-sales').textContent = Calc.formatPaise(todaySalesPaise);
    document.getElementById('kpi-total-amount').textContent = Calc.formatPaise(totalBilledPaise);

    const dateLabel = document.getElementById('dashboard-date-label');
    if (dateLabel) {
      dateLabel.textContent = 'Today: ' + Calc.formatDateDisplay(todayIso, false) + ' • Live summary from saved bills';
    }

    // Drafts resume strip
    const draftsBanner = document.getElementById('dashboard-drafts-banner');
    const draftsCountEl = document.getElementById('dashboard-drafts-count');
    if (draftsBanner) {
      if (draftBills.length > 0) {
        draftsBanner.classList.remove('d-none');
        draftsCountEl.textContent = draftBills.length + (draftBills.length === 1 ? ' unfinished draft bill' : ' unfinished draft bills');
      } else {
        draftsBanner.classList.add('d-none');
      }
    }

    renderRecentBills(bills);
    renderRecentCustomers(bills, customers);
  }

  function renderRecentBills(allBills) {
    const container = document.getElementById('dashboard-recent-bills');
    if (!container) return;

    const Calc = VBS.Calculations;
    const sorted = VBS.BillHistory.sortNewestFirst(allBills).slice(0, 6);

    if (sorted.length === 0) {
      container.innerHTML = (
        '<div class="empty-state">' +
          '<i class="bi bi-receipt-cutoff empty-state-icon"></i>' +
          '<h3 class="h6 fw-semibold mt-2">No bills created yet</h3>' +
          '<p class="text-muted small mb-3">Create your first vegetable supply bill in under a minute.</p>' +
          '<button type="button" class="btn btn-sm btn-primary" id="btn-dash-empty-new-bill">' +
            '<i class="bi bi-plus-circle me-1"></i> Create First Bill' +
          '</button>' +
        '</div>'
      );
      const emptyBtn = document.getElementById('btn-dash-empty-new-bill');
      if (emptyBtn) {
        emptyBtn.addEventListener('click', function () {
          VBS.Billing.startNewBill();
          VBS.App.navigateTo('billing');
        });
      }
      return;
    }

    let rowsHtml = '';
    sorted.forEach(function (bill) {
      const amountPaise = typeof bill.grandTotalPaise === 'number'
        ? bill.grandTotalPaise
        : Calc.calculateGrandTotalPaise(bill.items);

      let badge = '<span class="status-badge status-finalized">Finalized</span>';
      if (bill.status === 'draft') badge = '<span class="status-badge status-draft">Draft</span>';
      else if (bill.status === 'revised') badge = '<span class="status-badge status-revised">Revised</span>';

      rowsHtml += (
        '<tr>' +
          '<td class="fw-semibold mc-bill-no">' + Calc.escapeHtml(bill.billNumber) + '</td>' +
          '<td class="mc-date">' + Calc.escapeHtml(Calc.formatDateDisplay(bill.date, false)) + '</td>' +
          '<td class="mc-customer">' + Calc.escapeHtml(bill.customerName || '—') + '</td>' +
          '<td class="mc-status">' + badge + '</td>' +
          '<td class="text-end fw-bold mc-amount">' + Calc.formatPaise(amountPaise) + '</td>' +
          '<td class="text-end mc-actions">' +
            '<div class="btn-group btn-group-sm">' +
              '<button type="button" class="btn btn-outline-secondary btn-dash-view" data-id="' + Calc.escapeHtml(bill.id) + '" title="Preview"><i class="bi bi-eye"></i></button>' +
              '<button type="button" class="btn btn-outline-success btn-dash-print" data-id="' + Calc.escapeHtml(bill.id) + '" title="Print"><i class="bi bi-printer"></i></button>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    });

    container.innerHTML = (
      '<div class="table-responsive">' +
        '<table class="table table-hover align-middle mb-0 mobile-card-table">' +
          '<thead class="table-light">' +
            '<tr><th>Bill No.</th><th>Date</th><th>Customer</th><th>Status</th><th class="text-end">Amount</th><th class="text-end">Action</th></tr>' +
          '</thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  function renderRecentCustomers(bills, customers) {
    const container = document.getElementById('dashboard-recent-customers');
    if (!container) return;

    const Calc = VBS.Calculations;
    const activeCustomers = customers.filter(function (c) { return c.active !== false; });

    if (activeCustomers.length === 0) {
      container.innerHTML = '<div class="text-muted small py-2">No active customers yet. Add customers to get started.</div>';
      return;
    }

    // Order by most recently billed customer first, then remaining active customers
    const sortedBills = VBS.BillHistory.sortNewestFirst(bills);
    const orderedIds = [];
    const seen = new Set();

    sortedBills.forEach(function (b) {
      if (b.customerId && !seen.has(b.customerId)) {
        const cust = activeCustomers.find(function (c) { return c.id === b.customerId; });
        if (cust) {
          seen.add(b.customerId);
          orderedIds.push(cust);
        }
      }
    });

    activeCustomers.forEach(function (c) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        orderedIds.push(c);
      }
    });

    const topCustomers = orderedIds.slice(0, 5);
    let html = '';

    topCustomers.forEach(function (c) {
      const initial = (c.name || '?').trim().charAt(0).toUpperCase();
      const subText = [c.phone, c.address].filter(Boolean).join(' • ') || 'Ready for quick billing';

      html += (
        '<div class="recent-customer-item">' +
          '<div class="d-flex align-items-center gap-2 min-width-0">' +
            '<div class="customer-avatar">' + Calc.escapeHtml(initial) + '</div>' +
            '<div class="min-width-0">' +
              '<div class="fw-semibold text-truncate" style="max-width: 170px;">' + Calc.escapeHtml(c.name) + '</div>' +
              '<div class="text-muted text-truncate" style="font-size:0.75rem; max-width: 170px;">' + Calc.escapeHtml(subText) + '</div>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-sm btn-outline-success btn-dash-cust-bill flex-shrink-0" data-cust-id="' + Calc.escapeHtml(c.id) + '">' +
            'New Bill' +
          '</button>' +
        '</div>'
      );
    });

    container.innerHTML = html;
  }

  function init() {
    const btnNewBill = document.getElementById('btn-dash-new-bill');
    if (btnNewBill) {
      btnNewBill.addEventListener('click', function () {
        VBS.Billing.startNewBill();
        VBS.App.navigateTo('billing');
      });
    }

    const btnAddCust = document.getElementById('btn-dash-add-customer');
    if (btnAddCust) {
      btnAddCust.addEventListener('click', function () {
        VBS.Customers.openCustomerModal(null);
      });
    }

    const btnViewDrafts = document.getElementById('btn-dash-view-drafts');
    if (btnViewDrafts) {
      btnViewDrafts.addEventListener('click', function () {
        VBS.BillHistory.setStatusFilter('draft');
        VBS.App.navigateTo('history');
      });
    }

    const btnResumeDraft = document.getElementById('btn-dash-resume-draft');
    if (btnResumeDraft) {
      btnResumeDraft.addEventListener('click', function () {
        const drafts = VBS.BillHistory.sortNewestFirst(
          VBS.Storage.getBills().filter(function (b) { return b.status === 'draft'; })
        );
        if (drafts.length > 0) {
          VBS.Billing.loadBillForEditing(drafts[0].id, 'edit');
          VBS.App.navigateTo('billing');
        }
      });
    }

    const recentBillsEl = document.getElementById('dashboard-recent-bills');
    if (recentBillsEl) {
      recentBillsEl.addEventListener('click', function (e) {
        const btnView = e.target.closest('.btn-dash-view');
        const btnPrint = e.target.closest('.btn-dash-print');
        const btn = btnView || btnPrint;
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const bill = VBS.Storage.getBills().find(function (b) { return b.id === id; });
        if (!bill) return;
        VBS.BillTemplate.openPreview(bill, {
          backLabel: 'Close Preview',
          autoPrint: Boolean(btnPrint)
        });
      });
    }

    const recentCustEl = document.getElementById('dashboard-recent-customers');
    if (recentCustEl) {
      recentCustEl.addEventListener('click', function (e) {
        const btn = e.target.closest('.btn-dash-cust-bill');
        if (!btn) return;
        VBS.Billing.startNewBill({ customerId: btn.getAttribute('data-cust-id') });
        VBS.App.navigateTo('billing');
      });
    }
  }

  VBS.Dashboard = {
    init: init,
    render: render
  };
})(window);

