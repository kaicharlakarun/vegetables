/* =========================================================
   CUSTOMERS MANAGEMENT MODULE
   ========================================================= */

(function (global) {
  'use strict';

  const VBS = (global.VBS = global.VBS || {});

  let afterSaveCallback = null;

  function getBillCountByCustomerMap() {
    const bills = VBS.Storage.getBills();
    const map = {};
    bills.forEach(function (b) {
      if (b.customerId) {
        map[b.customerId] = (map[b.customerId] || 0) + 1;
      }
    });
    return map;
  }

  function render() {
    const tbody = document.getElementById('customers-tbody');
    const emptyEl = document.getElementById('customers-empty-state');
    if (!tbody || !emptyEl) return;

    const searchInput = document.getElementById('customer-search-input');
    const showInactiveEl = document.getElementById('customer-show-inactive');
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const showInactive = showInactiveEl ? showInactiveEl.checked : true;

    const customers = VBS.Storage.getCustomers();
    const billCounts = getBillCountByCustomerMap();
    const Calc = VBS.Calculations;

    const filtered = customers.filter(function (c) {
      if (!showInactive && c.active === false) return false;
      if (!query) return true;
      const haystack = [c.name, c.contactPerson, c.phone, c.address, c.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.indexOf(query) !== -1;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyEl.classList.remove('d-none');
      return;
    }

    emptyEl.classList.add('d-none');
    let html = '';

    filtered.forEach(function (c) {
      const count = billCounts[c.id] || 0;
      const isActive = c.active !== false;
      const statusBadge = isActive
        ? '<span class="status-badge status-finalized">Active</span>'
        : '<span class="status-badge status-inactive">Inactive</span>';

      const addrNotes = [c.address, c.notes].filter(Boolean).map(Calc.escapeHtml).join(' • ');

      const deleteOrToggleBtn = count === 0
        ? (
          '<button type="button" class="btn btn-sm btn-outline-danger btn-cust-delete" data-id="' + Calc.escapeHtml(c.id) + '" title="Delete customer">' +
            '<i class="bi bi-trash"></i>' +
          '</button>'
        )
        : (
          '<button type="button" class="btn btn-sm ' + (isActive ? 'btn-outline-warning' : 'btn-outline-success') + ' btn-cust-toggle" data-id="' + Calc.escapeHtml(c.id) + '" title="' + (isActive ? 'Deactivate customer (has linked bills)' : 'Reactivate customer') + '">' +
            '<i class="bi ' + (isActive ? 'bi-pause-circle' : 'bi-play-circle') + '"></i>' +
          '</button>'
        );

      html += (
        '<tr class="' + (isActive ? '' : 'table-light text-muted') + '">' +
          '<td class="mc-cust-name">' +
            '<div class="fw-semibold">' + Calc.escapeHtml(c.name) + '</div>' +
          '</td>' +
          '<td class="mc-cust-contact ' + (c.contactPerson ? '' : 'mc-cust-empty-val') + '">' + (c.contactPerson ? Calc.escapeHtml(c.contactPerson) : '<span class="text-muted">—</span>') + '</td>' +
          '<td class="mc-cust-phone ' + (c.phone ? '' : 'mc-cust-empty-val') + '">' + (c.phone ? Calc.escapeHtml(c.phone) : '<span class="text-muted">—</span>') + '</td>' +
          '<td class="small mc-cust-address ' + (addrNotes ? '' : 'mc-cust-empty-val') + '">' + (addrNotes || '<span class="text-muted">—</span>') + '</td>' +
          '<td class="text-center mc-cust-bills"><span class="badge text-bg-light border text-dark">' + count + '</span></td>' +
          '<td class="mc-cust-status">' + statusBadge + '</td>' +
          '<td class="text-end mc-actions">' +
            '<div class="btn-group btn-group-sm">' +
              (isActive
                ? '<button type="button" class="btn btn-outline-success btn-cust-bill" data-id="' + Calc.escapeHtml(c.id) + '" title="Create bill for this customer"><i class="bi bi-plus-circle"></i> Bill</button>'
                : '') +
              '<button type="button" class="btn btn-outline-secondary btn-cust-edit" data-id="' + Calc.escapeHtml(c.id) + '" title="Edit customer"><i class="bi bi-pencil"></i></button>' +
              deleteOrToggleBtn +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    });

    tbody.innerHTML = html;
  }

  function openCustomerModal(customerToEdit, onSaved) {
    afterSaveCallback = typeof onSaved === 'function' ? onSaved : null;

    const titleEl = document.getElementById('customerModalTitle');
    const idEl = document.getElementById('cust-id');
    const nameEl = document.getElementById('cust-name');
    const contactEl = document.getElementById('cust-contact');
    const phoneEl = document.getElementById('cust-phone');
    const addressEl = document.getElementById('cust-address');
    const notesEl = document.getElementById('cust-notes');
    const errEl = document.getElementById('cust-form-error');

    errEl.classList.add('d-none');
    errEl.textContent = '';

    if (customerToEdit) {
      titleEl.textContent = 'Edit Customer';
      idEl.value = customerToEdit.id;
      nameEl.value = customerToEdit.name || '';
      contactEl.value = customerToEdit.contactPerson || '';
      phoneEl.value = customerToEdit.phone || '';
      addressEl.value = customerToEdit.address || '';
      notesEl.value = customerToEdit.notes || '';
    } else {
      titleEl.textContent = 'Add Customer';
      idEl.value = '';
      nameEl.value = '';
      contactEl.value = '';
      phoneEl.value = '';
      addressEl.value = '';
      notesEl.value = '';
    }

    VBS.App.showModal('customerModal');
    setTimeout(function () {
      nameEl.focus();
    }, 200);
  }

  function saveCustomerFromModal() {
    const id = document.getElementById('cust-id').value.trim();
    const name = document.getElementById('cust-name').value.trim();
    const contactPerson = document.getElementById('cust-contact').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const notes = document.getElementById('cust-notes').value.trim();
    const errEl = document.getElementById('cust-form-error');

    if (!name) {
      errEl.textContent = 'Customer / Institution Name is required.';
      errEl.classList.remove('d-none');
      document.getElementById('cust-name').focus();
      return;
    }

    const customers = VBS.Storage.getCustomers();
    const duplicate = customers.find(function (c) {
      return c.id !== id && c.name.trim().toLowerCase() === name.toLowerCase();
    });
    if (duplicate) {
      errEl.textContent = 'A customer named "' + duplicate.name + '" already exists.';
      errEl.classList.remove('d-none');
      return;
    }

    const now = new Date().toISOString();
    let savedCustomer = null;

    if (id) {
      const idx = customers.findIndex(function (c) { return c.id === id; });
      if (idx !== -1) {
        customers[idx] = Object.assign({}, customers[idx], {
          name: name,
          contactPerson: contactPerson,
          phone: phone,
          address: address,
          notes: notes,
          updatedAt: now
        });
        savedCustomer = customers[idx];
      }
    } else {
      savedCustomer = {
        id: VBS.Storage.generateId('cust'),
        name: name,
        contactPerson: contactPerson,
        phone: phone,
        address: address,
        notes: notes,
        active: true,
        createdAt: now,
        updatedAt: now
      };
      customers.push(savedCustomer);
    }

    const res = VBS.Storage.saveCustomers(customers);
    if (!res.ok) {
      errEl.textContent = res.error;
      errEl.classList.remove('d-none');
      return;
    }

    VBS.App.hideModal('customerModal');

    VBS.App.showToast(id ? 'Customer updated.' : 'Customer "' + name + '" added.', 'success');
    VBS.App.refreshAllViews();

    if (afterSaveCallback && savedCustomer) {
      const cb = afterSaveCallback;
      afterSaveCallback = null;
      cb(savedCustomer);
    }
  }

  function handleDeleteCustomer(customerId) {
    const customers = VBS.Storage.getCustomers();
    const cust = customers.find(function (c) { return c.id === customerId; });
    if (!cust) return;

    const bills = VBS.Storage.getBills();
    const linkedCount = bills.filter(function (b) { return b.customerId === customerId; }).length;
    if (linkedCount > 0) {
      VBS.App.showToast('Cannot delete "' + cust.name + '" because ' + linkedCount + ' saved bill(s) depend on it. Deactivate instead.', 'warning');
      return;
    }

    VBS.App.confirmAction({
      title: 'Delete Customer',
      body: 'Delete <strong>' + VBS.Calculations.escapeHtml(cust.name) + '</strong>? No bills are linked to this customer.',
      confirmText: 'Delete Customer',
      confirmClass: 'btn-danger',
      onConfirm: function () {
        const nextList = VBS.Storage.getCustomers().filter(function (c) { return c.id !== customerId; });
        VBS.Storage.saveCustomers(nextList);
        VBS.App.showToast('Customer deleted.', 'success');
        VBS.App.refreshAllViews();
      }
    });
  }

  function handleToggleCustomerActive(customerId) {
    const customers = VBS.Storage.getCustomers();
    const idx = customers.findIndex(function (c) { return c.id === customerId; });
    if (idx === -1) return;

    const cust = customers[idx];
    const nextActive = cust.active === false;
    const actionLabel = nextActive ? 'Reactivate' : 'Deactivate';

    VBS.App.confirmAction({
      title: actionLabel + ' Customer',
      body: nextActive
        ? 'Make <strong>' + VBS.Calculations.escapeHtml(cust.name) + '</strong> active again for new bills?'
        : 'Deactivate <strong>' + VBS.Calculations.escapeHtml(cust.name) + '</strong>? Existing bills remain safe, and the customer will be hidden from new bill selection.',
      confirmText: actionLabel,
      confirmClass: nextActive ? 'btn-success' : 'btn-warning',
      onConfirm: function () {
        const list = VBS.Storage.getCustomers();
        const i = list.findIndex(function (c) { return c.id === customerId; });
        if (i !== -1) {
          list[i].active = nextActive;
          list[i].updatedAt = new Date().toISOString();
          VBS.Storage.saveCustomers(list);
          VBS.App.showToast('Customer ' + (nextActive ? 'reactivated.' : 'deactivated.'), 'success');
          VBS.App.refreshAllViews();
        }
      }
    });
  }

  function init() {
    const btnAdd = document.getElementById('btn-add-customer');
    const btnEmptyAdd = document.getElementById('btn-empty-add-customer');
    const btnSave = document.getElementById('btn-save-customer');
    const searchInput = document.getElementById('customer-search-input');
    const showInactiveEl = document.getElementById('customer-show-inactive');
    const tbody = document.getElementById('customers-tbody');

    if (btnAdd) btnAdd.addEventListener('click', function () { openCustomerModal(null); });
    if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', function () { openCustomerModal(null); });
    if (btnSave) btnSave.addEventListener('click', saveCustomerFromModal);
    if (searchInput) searchInput.addEventListener('input', render);
    if (showInactiveEl) showInactiveEl.addEventListener('change', render);

    // Enter key inside modal saves customer cleanly
    const form = document.getElementById('customer-form');
    if (form) {
      form.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          saveCustomerFromModal();
        }
      });
    }

    if (tbody) {
      tbody.addEventListener('click', function (e) {
        const btnEdit = e.target.closest('.btn-cust-edit');
        if (btnEdit) {
          const id = btnEdit.getAttribute('data-id');
          const cust = VBS.Storage.getCustomers().find(function (c) { return c.id === id; });
          if (cust) openCustomerModal(cust);
          return;
        }
        const btnDel = e.target.closest('.btn-cust-delete');
        if (btnDel) {
          handleDeleteCustomer(btnDel.getAttribute('data-id'));
          return;
        }
        const btnToggle = e.target.closest('.btn-cust-toggle');
        if (btnToggle) {
          handleToggleCustomerActive(btnToggle.getAttribute('data-id'));
          return;
        }
        const btnBill = e.target.closest('.btn-cust-bill');
        if (btnBill) {
          const custId = btnBill.getAttribute('data-id');
          VBS.Billing.startNewBill({ customerId: custId });
          VBS.App.navigateTo('billing');
        }
      });
    }
  }

  VBS.Customers = {
    init: init,
    render: render,
    openCustomerModal: openCustomerModal
  };
})(window);

