/* =========================================================
   MAIN APPLICATION COORDINATOR (ROUTER, MODALS, TOASTS)
   ========================================================= */

(function (global) {
  'use strict';

  const VBS = (global.VBS = global.VBS || {});
  const VALID_VIEWS = ['dashboard', 'billing', 'history', 'customers', 'settings'];

  let currentView = 'dashboard';
  let pendingConfirmHandler = null;

  function navigateTo(viewName) {
    if (VALID_VIEWS.indexOf(viewName) === -1) {
      viewName = 'dashboard';
    }
    currentView = viewName;

    // Show target view, hide others
    VALID_VIEWS.forEach(function (v) {
      const el = document.getElementById('view-' + v);
      if (el) {
        el.classList.toggle('d-none', v !== viewName);
      }
    });

    // Update sidebar & mobile bottom nav active states
    document.querySelectorAll('.sidebar-nav .nav-item, .mobile-bottom-nav .bottom-nav-item').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-nav') === viewName);
    });

    closeMobileSidebar();

    // Refresh the active view
    if (viewName === 'dashboard') VBS.Dashboard.render();
    else if (viewName === 'billing') VBS.Billing.refreshCustomerDropdown();
    else if (viewName === 'history') VBS.BillHistory.render();
    else if (viewName === 'customers') VBS.Customers.render();
    else if (viewName === 'settings') VBS.Settings.render();

    global.scrollTo({ top: 0, behavior: 'instant' });
  }

  function refreshAllViews() {
    updateSidebarMeta();
    checkStorageWarnings();
    VBS.Dashboard.render();
    VBS.Billing.refreshCustomerDropdown();
    VBS.BillHistory.render();
    VBS.Customers.render();
    if (currentView === 'settings') {
      VBS.Settings.render();
    }
  }

  function updateSidebarMeta() {
    const bills = VBS.Storage.getBills();
    const customers = VBS.Storage.getCustomers();
    const settings = VBS.Storage.getSettings();

    const finalizedCount = bills.filter(function (b) { return b.status !== 'draft'; }).length;
    const statsEl = document.getElementById('sidebar-stats-summary');
    if (statsEl) {
      statsEl.textContent = finalizedCount + (finalizedCount === 1 ? ' Bill' : ' Bills') + ' • ' + customers.length + ' Customers';
    }

    const brandEl = document.getElementById('sidebar-business-name');
    const mobileBrandEl = document.getElementById('mobile-brand-title');
    const shortBrand = settings.businessName ? settings.businessName : 'Vegetable Billing';
    if (brandEl) brandEl.textContent = shortBrand;
    if (mobileBrandEl) mobileBrandEl.textContent = shortBrand;
  }

  function checkStorageWarnings() {
    const warnings = VBS.Storage.getWarnings();
    const banner = document.getElementById('storage-warning-banner');
    const textEl = document.getElementById('storage-warning-text');
    if (!banner || !textEl) return;

    if (warnings.length > 0) {
      textEl.textContent = warnings.map(function (w) { return w.message; }).join(' ');
      banner.classList.remove('d-none');
      banner.classList.add('d-flex');
    } else {
      banner.classList.add('d-none');
      banner.classList.remove('d-flex');
    }
  }

  function openMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('show');
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
  }

  const modalInstances = {};

  function showModal(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    if (global.bootstrap && global.bootstrap.Modal) {
      if (!modalInstances[modalId]) {
        modalInstances[modalId] = new global.bootstrap.Modal(el);
      }
      modalInstances[modalId].show();
    } else {
      el.classList.add('show', 'modal-fallback-open');
      el.setAttribute('aria-hidden', 'false');
    }
  }

  function hideModal(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    if (global.bootstrap && modalInstances[modalId]) {
      modalInstances[modalId].hide();
    } else {
      el.classList.remove('show', 'modal-fallback-open');
      el.setAttribute('aria-hidden', 'true');
    }
  }

  function confirmAction(options) {
    const opts = options || {};
    const titleEl = document.getElementById('confirmModalTitle');
    const bodyEl = document.getElementById('confirmModalBody');
    const okBtn = document.getElementById('confirmModalOk');

    titleEl.textContent = opts.title || 'Confirm';
    bodyEl.innerHTML = opts.body || 'Are you sure?';
    okBtn.textContent = opts.confirmText || 'Confirm';
    okBtn.className = 'btn ' + (opts.confirmClass || 'btn-danger');

    pendingConfirmHandler = typeof opts.onConfirm === 'function' ? opts.onConfirm : null;

    if ((global.bootstrap && global.bootstrap.Modal) || document.getElementById('confirmModal')) {
      showModal('confirmModal');
    } else if (global.confirm(bodyEl.textContent)) {
      if (pendingConfirmHandler) pendingConfirmHandler();
    }
  }

  function showToast(message, variant) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const colorMap = {
      success: 'text-bg-success',
      danger: 'text-bg-danger',
      warning: 'text-bg-warning',
      info: 'text-bg-dark'
    };
    const cls = colorMap[variant] || 'text-bg-dark';

    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center border-0 ' + cls;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML =
      '<div class="d-flex">' +
        '<div class="toast-body">' + VBS.Calculations.escapeHtml(message) + '</div>' +
        '<button type="button" class="btn-close ' + (variant === 'warning' ? '' : 'btn-close-white') + ' me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
      '</div>';

    container.appendChild(toastEl);

    if (global.bootstrap && global.bootstrap.Toast) {
      const toastObj = new global.bootstrap.Toast(toastEl, { delay: 3200 });
      toastEl.addEventListener('hidden.bs.toast', function () {
        if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
      });
      toastObj.show();
    } else {
      setTimeout(function () {
        if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
      }, 3200);
    }
  }

  function bootstrapApp() {
    // Initialize storage defaults if first run
    VBS.Storage.getSettings();
    VBS.Storage.getCustomers();
    VBS.Storage.getBills();
    VBS.Storage.getCounter();

    // Initialize feature modules
    VBS.BillTemplate.init();
    VBS.Customers.init();
    VBS.Billing.init();
    VBS.BillHistory.init();
    VBS.Dashboard.init();
    VBS.Settings.init();

    // Wire navigation triggers and fallback modal close buttons
    document.addEventListener('click', function (e) {
      const navTrigger = e.target.closest('[data-nav]');
      if (navTrigger) {
        const targetView = navTrigger.getAttribute('data-nav');
        navigateTo(targetView);
        return;
      }
      if (!global.bootstrap || !global.bootstrap.Modal) {
        const dismissBtn = e.target.closest('[data-bs-dismiss="modal"]');
        if (dismissBtn) {
          const modal = dismissBtn.closest('.modal');
          if (modal && modal.id) hideModal(modal.id);
        }
      }
    });

    // Mobile drawer controls
    const btnMenu = document.getElementById('btn-mobile-menu');
    const btnClose = document.getElementById('btn-close-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (btnMenu) btnMenu.addEventListener('click', openMobileSidebar);
    if (btnClose) btnClose.addEventListener('click', closeMobileSidebar);
    if (backdrop) backdrop.addEventListener('click', closeMobileSidebar);

    // Confirm Modal OK handler
    const okBtn = document.getElementById('confirmModalOk');
    if (okBtn) {
      okBtn.addEventListener('click', function () {
        hideModal('confirmModal');
        if (pendingConfirmHandler) {
          const fn = pendingConfirmHandler;
          pendingConfirmHandler = null;
          fn();
        }
      });
    }

    refreshAllViews();
    navigateTo('dashboard');
  }

  VBS.App = {
    navigateTo: navigateTo,
    refreshAllViews: refreshAllViews,
    showModal: showModal,
    hideModal: hideModal,
    confirmAction: confirmAction,
    showToast: showToast,
    getCurrentView: function () { return currentView; }
  };

  document.addEventListener('DOMContentLoaded', bootstrapApp);
})(window);

