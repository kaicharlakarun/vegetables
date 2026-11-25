/* =========================================================
   BILLING WORKSPACE MODULE (CREATE / DRAFT / REVISE BILLS)
   ========================================================= */

(function (global) {
  'use strict';

  const VBS = (global.VBS = global.VBS || {});

  const QUICK_ITEMS = [
    { label: 'Tomato', name: 'Tomato', type: 'kg' },
    { label: 'Potato', name: 'Potato', type: 'kg' },
    { label: 'Onion', name: 'Onion', type: 'kg' },
    { label: 'Carrot', name: 'Carrot', type: 'kg' },
    { label: 'Brinjal', name: 'Brinjal', type: 'kg' },
    { label: 'Beans', name: 'Beans', type: 'kg' },
    { label: 'Cabbage', name: 'Cabbage', type: 'kg' },
    { label: 'Green Chilli', name: 'Green Chilli', type: 'kg' },
    { label: 'Capsicum', name: 'Capsicum', type: 'kg' },
    { label: 'Vegetable Bags', name: 'Vegetable Bags', type: 'quantity', unit: 'Bags' },
    { label: 'Eggs (No)', name: 'Eggs', type: 'quantity', unit: 'No' },
    { label: 'Curry Leaves', name: 'Curry Leaves', type: 'direct' },
    { label: 'Coriander', name: 'Coriander', type: 'direct' }
  ];

  let currentBill = null;
  let originalFinalizedSnapshot = null;

  function createBlankBillState(preselectCustomerId) {
    const Calc = VBS.Calculations;
    const peek = VBS.Storage.peekNextBillNumber();
    const customers = VBS.Storage.getCustomers();
    let customerId = '';
    let customerName = '';

    if (preselectCustomerId) {
      const found = customers.find(function (c) {
        return c.id === preselectCustomerId && c.active !== false;
      });
      if (found) {
        customerId = found.id;
        customerName = found.name;
      }
    }

    return {
      id: null,
      billNumber: peek.billNumber,
      numberReserved: false,
      date: Calc.getTodayISO(),
      customerId: customerId,
      customerName: customerName,
      status: 'new',
      items: [],
      revisions: [],
      revisionCount: 0,
      createdAt: null,
      updatedAt: null
    };
  }

  function ensureNumberReserved() {
    if (!currentBill) return;
    if (!currentBill.numberReserved && currentBill.status !== 'finalized' && currentBill.status !== 'revised') {
      currentBill.billNumber = VBS.Storage.reserveBillNumber(currentBill.billNumber);
      currentBill.numberReserved = true;
      const billNoEl = document.getElementById('bill-number-input');
      if (billNoEl) billNoEl.value = currentBill.billNumber;
    }
  }

  function startNewBill(options) {
    const opts = options || {};
    originalFinalizedSnapshot = null;
    currentBill = createBlankBillState(opts.customerId);
    if (opts.customerId) {
      ensureNumberReserved();
    }
    syncFormFromState();
  }

  function loadBillForEditing(billId, mode) {
    const bills = VBS.Storage.getBills();
    const found = bills.find(function (b) { return b.id === billId; });
    if (!found) return;

    const cloned = JSON.parse(JSON.stringify(found));
    cloned.numberReserved = true;

    if (mode === 'duplicate') {
      const peek = VBS.Storage.peekNextBillNumber();
      originalFinalizedSnapshot = null;
      currentBill = {
        id: null,
        billNumber: peek.billNumber,
        numberReserved: false,
        date: VBS.Calculations.getTodayISO(),
        customerId: cloned.customerId || '',
        customerName: cloned.customerName || '',
        status: 'new',
        items: (cloned.items || []).map(function (it) {
          return Object.assign({}, it, { id: VBS.Storage.generateId('item') });
        }),
        revisions: [],
        revisionCount: 0,
        createdAt: null,
        updatedAt: null
      };
      ensureNumberReserved();
      VBS.App.showToast('Duplicated items from ' + found.billNumber + ' into ' + currentBill.billNumber + '.', 'info');
    } else if (found.status === 'finalized' || found.status === 'revised') {
      originalFinalizedSnapshot = JSON.parse(JSON.stringify(found));
      currentBill = cloned;
    } else {
      originalFinalizedSnapshot = null;
      currentBill = cloned;
    }

    syncFormFromState();
  }

  function refreshCustomerDropdown() {
    const select = document.getElementById('bill-customer-select');
    if (!select) return;

    const customers = VBS.Storage.getCustomers();
    const currentId = currentBill ? currentBill.customerId : '';
    const Calc = VBS.Calculations;

    let html = '<option value="">-- Select Customer / Institution --</option>';
    customers.forEach(function (c) {
      const isSelected = c.id === currentId;
      // Show active customers, plus the currently selected customer even if later deactivated
      if (c.active === false && !isSelected) return;
      const suffix = c.active === false ? ' (Inactive)' : '';
      html += '<option value="' + Calc.escapeHtml(c.id) + '"' + (isSelected ? ' selected' : '') + '>' +
        Calc.escapeHtml(c.name) + suffix +
      '</option>';
    });

    select.innerHTML = html;
    updateCustomerPreviewInfo();
  }

  function updateCustomerPreviewInfo() {
    const infoEl = document.getElementById('bill-customer-preview-info');
    if (!infoEl || !currentBill) return;

    if (!currentBill.customerId) {
      infoEl.classList.add('d-none');
      infoEl.textContent = '';
      return;
    }

    const cust = VBS.Storage.getCustomers().find(function (c) { return c.id === currentBill.customerId; });
    if (!cust) {
      infoEl.classList.add('d-none');
      return;
    }

    const parts = [];
    if (cust.contactPerson) parts.push('Contact: ' + cust.contactPerson);
    if (cust.phone) parts.push('Phone: ' + cust.phone);
    if (cust.address) parts.push('Address: ' + cust.address);

    if (parts.length > 0) {
      infoEl.textContent = parts.join('  •  ');
      infoEl.classList.remove('d-none');
    } else {
      infoEl.classList.add('d-none');
    }
  }

  function syncFormFromState() {
    if (!currentBill) currentBill = createBlankBillState();

    const titleEl = document.getElementById('billing-page-title');
    const badgeEl = document.getElementById('billing-status-badge');
    const revBanner = document.getElementById('billing-revision-banner');
    const revNoEl = document.getElementById('revision-bill-no');
    const billNoInput = document.getElementById('bill-number-input');
    const dateInput = document.getElementById('bill-date-input');
    const validationAlert = document.getElementById('billing-validation-alert');

    if (validationAlert) {
      validationAlert.classList.add('d-none');
      validationAlert.innerHTML = '';
    }

    if (billNoInput) billNoInput.value = currentBill.billNumber;
    if (dateInput) dateInput.value = currentBill.date || VBS.Calculations.getTodayISO();

    const isRevising = Boolean(originalFinalizedSnapshot);
    if (isRevising) {
      if (titleEl) titleEl.textContent = 'Revise Bill ' + currentBill.billNumber;
      if (badgeEl) {
        badgeEl.className = 'badge rounded-pill text-bg-primary';
        badgeEl.textContent = 'Revising Finalized Bill';
      }
      if (revBanner) revBanner.classList.remove('d-none');
      if (revNoEl) revNoEl.textContent = currentBill.billNumber;
    } else if (currentBill.status === 'draft') {
      if (titleEl) titleEl.textContent = 'Edit Draft Bill';
      if (badgeEl) {
        badgeEl.className = 'badge rounded-pill text-bg-warning';
        badgeEl.textContent = 'Draft';
      }
      if (revBanner) revBanner.classList.add('d-none');
    } else {
      if (titleEl) titleEl.textContent = 'Create New Bill';
      if (badgeEl) {
        badgeEl.className = 'badge rounded-pill text-bg-secondary';
        badgeEl.textContent = 'New Bill';
      }
      if (revBanner) revBanner.classList.add('d-none');
    }

    refreshCustomerDropdown();
    renderItemsTable();
    resetEntryBar(false);
  }

  /* ---- Entry Type Switcher & Live Amount Preview ---- */

  function getSelectedEntryType() {
    const checked = document.querySelector('input[name="entry-type"]:checked');
    return checked ? checked.value : 'kg';
  }

  function setSelectedEntryType(type) {
    const radio = document.querySelector('input[name="entry-type"][value="' + type + '"]');
    if (radio) {
      radio.checked = true;
      updateEntryTypeVisibility();
    }
  }

  function updateEntryTypeVisibility() {
    const type = getSelectedEntryType();
    document.querySelectorAll('.entry-group-kg').forEach(function (el) {
      el.classList.toggle('d-none', type !== 'kg');
    });
    document.querySelectorAll('.entry-group-quantity').forEach(function (el) {
      el.classList.toggle('d-none', type !== 'quantity');
    });
    document.querySelectorAll('.entry-group-direct').forEach(function (el) {
      el.classList.toggle('d-none', type !== 'direct');
    });
    updateEntryLivePreview();
  }

  function buildDraftItemFromEntryBar() {
    const type = getSelectedEntryType();
    const name = document.getElementById('entry-name').value.trim();
    if (type === 'kg') {
      return {
        type: 'kg',
        name: name,
        kg: document.getElementById('entry-kg').value,
        rate: document.getElementById('entry-kg-rate').value
      };
    }
    if (type === 'quantity') {
      return {
        type: 'quantity',
        name: name,
        quantity: document.getElementById('entry-qty').value,
        unit: document.getElementById('entry-unit').value.trim(),
        rate: document.getElementById('entry-qty-rate').value
      };
    }
    return {
      type: 'direct',
      name: name,
      directAmount: document.getElementById('entry-direct-amount').value
    };
  }

  function updateEntryLivePreview() {
    const previewEl = document.getElementById('entry-live-amount');
    if (!previewEl) return;
    const Calc = VBS.Calculations;
    const draftItem = buildDraftItemFromEntryBar();
    const amountPaise = Calc.calculateItemAmountPaise(draftItem);
    previewEl.textContent = Calc.formatPaise(amountPaise);
  }

  function showEntryError(msg) {
    const errEl = document.getElementById('entry-error-msg');
    if (!errEl) return;
    if (!msg) {
      errEl.classList.add('d-none');
      errEl.textContent = '';
    } else {
      errEl.textContent = msg;
      errEl.classList.remove('d-none');
    }
  }

  function resetEntryBar(focusName) {
    document.getElementById('entry-name').value = '';
    document.getElementById('entry-kg').value = '';
    document.getElementById('entry-kg-rate').value = '';
    document.getElementById('entry-qty').value = '';
    document.getElementById('entry-unit').value = '';
    document.getElementById('entry-qty-rate').value = '';
    document.getElementById('entry-direct-amount').value = '';
    showEntryError('');
    updateEntryLivePreview();
    if (focusName) {
      document.getElementById('entry-name').focus();
    }
  }

  function handleAddItem() {
    const Calc = VBS.Calculations;
    const candidate = buildDraftItemFromEntryBar();

    if (!candidate.name) {
      showEntryError('Please enter a vegetable or item name.');
      document.getElementById('entry-name').focus();
      return;
    }

    if (candidate.type === 'kg') {
      const kg = Calc.parseNonNegativeNumber(candidate.kg);
      const rate = Calc.parseNonNegativeNumber(candidate.rate);
      if (kg === null || rate === null) {
        showEntryError('Please enter valid non-negative KG and Rate.');
        if (kg === null) document.getElementById('entry-kg').focus();
        else document.getElementById('entry-kg-rate').focus();
        return;
      }
    } else if (candidate.type === 'quantity') {
      const qty = Calc.parseNonNegativeNumber(candidate.quantity);
      const rate = Calc.parseNonNegativeNumber(candidate.rate);
      if (qty === null || rate === null) {
        showEntryError('Please enter valid non-negative Quantity and Rate.');
        if (qty === null) document.getElementById('entry-qty').focus();
        else document.getElementById('entry-qty-rate').focus();
        return;
      }
    } else if (candidate.type === 'direct') {
      const direct = Calc.parseNonNegativeNumber(candidate.directAmount);
      if (direct === null) {
        showEntryError('Please enter a valid non-negative Direct Amount.');
        document.getElementById('entry-direct-amount').focus();
        return;
      }
    }

    ensureNumberReserved();
    if (currentBill.status === 'new') {
      currentBill.status = 'draft';
    }

    currentBill.items.push({
      id: VBS.Storage.generateId('item'),
      type: candidate.type,
      name: candidate.name,
      kg: candidate.type === 'kg' ? candidate.kg : undefined,
      quantity: candidate.type === 'quantity' ? candidate.quantity : undefined,
      unit: candidate.type === 'quantity' ? candidate.unit : undefined,
      rate: candidate.type !== 'direct' ? candidate.rate : undefined,
      directAmount: candidate.type === 'direct' ? candidate.directAmount : undefined
    });

    renderItemsTable();
    resetEntryBar(true);
    clearValidationAlert();
  }

  /* ---- Bill Items Table Rendering & Live Inline Edits ---- */

  function renderItemsTable(invalidIndices) {
    const tbody = document.getElementById('billing-items-tbody');
    const emptyEl = document.getElementById('billing-empty-state');
    const tableEl = document.getElementById('billing-items-table');
    if (!tbody || !emptyEl || !tableEl) return;

    const Calc = VBS.Calculations;
    const items = currentBill ? currentBill.items : [];
    const invalidSet = new Set(invalidIndices || []);

    if (items.length === 0) {
      tbody.innerHTML = '';
      tableEl.classList.add('d-none');
      emptyEl.classList.remove('d-none');
      updateTotalsSummary();
      return;
    }

    tableEl.classList.remove('d-none');
    emptyEl.classList.add('d-none');

    let html = '';
    items.forEach(function (item, idx) {
      const sl = String(idx + 1).padStart(2, '0');
      const amountPaise = Calc.calculateItemAmountPaise(item);
      const amountStr = Calc.formatPaise(amountPaise);
      const rowInvalidClass = invalidSet.has(idx) ? ' row-invalid' : '';

      let typeBadge = '<span class="type-pill type-pill-kg">KG</span>';
      let qtyCellHtml = '';
      let rateCellHtml = '';
      let amountCellHtml = '<span class="fw-bold item-row-amount-text">' + amountStr + '</span>';

      if (item.type === 'kg') {
        qtyCellHtml =
          '<div class="input-group input-group-sm">' +
            '<input type="number" min="0" step="any" inputmode="decimal" class="form-control inline-input inline-num item-inline-kg" data-idx="' + idx + '" value="' + Calc.escapeHtml(item.kg) + '" aria-label="KG">' +
            '<span class="input-group-text">KG</span>' +
          '</div>';
        rateCellHtml =
          '<input type="number" min="0" step="any" inputmode="decimal" class="form-control form-control-sm inline-input inline-num item-inline-rate" data-idx="' + idx + '" value="' + Calc.escapeHtml(item.rate) + '" aria-label="Rate">';
      } else if (item.type === 'quantity') {
        typeBadge = '<span class="type-pill type-pill-quantity">QTY</span>';
        qtyCellHtml =
          '<div class="d-flex gap-1">' +
            '<input type="number" min="0" step="any" inputmode="decimal" class="form-control form-control-sm inline-input inline-num item-inline-qty" data-idx="' + idx + '" value="' + Calc.escapeHtml(item.quantity) + '" aria-label="Quantity" style="min-width:68px">' +
            '<input type="text" class="form-control form-control-sm inline-input item-inline-unit" data-idx="' + idx + '" value="' + Calc.escapeHtml(item.unit || '') + '" list="unit-suggestions" placeholder="Unit" aria-label="Unit" style="min-width:68px">' +
          '</div>';
        rateCellHtml =
          '<input type="number" min="0" step="any" inputmode="decimal" class="form-control form-control-sm inline-input inline-num item-inline-rate" data-idx="' + idx + '" value="' + Calc.escapeHtml(item.rate) + '" aria-label="Rate">';
      } else {
        typeBadge = '<span class="type-pill type-pill-direct">DIRECT</span>';
        qtyCellHtml = '<span class="text-muted small">—</span>';
        rateCellHtml = '<span class="text-muted small">—</span>';
        amountCellHtml =
          '<div class="input-group input-group-sm">' +
            '<span class="input-group-text">₹</span>' +
            '<input type="number" min="0" step="any" inputmode="decimal" class="form-control inline-input inline-num fw-bold item-inline-direct" data-idx="' + idx + '" value="' + Calc.escapeHtml(item.directAmount) + '" aria-label="Direct Amount">' +
          '</div>';
      }

      const qtyLabel = item.type === 'kg' ? 'Weight (KG)' : 'Quantity / Unit';
      const rateLabel = item.type === 'kg' ? 'Rate (₹/KG)' : 'Rate (₹)';
      const amountLabel = item.type === 'direct' ? 'Direct Amount' : 'Amount';

      html += (
        '<tr data-row-idx="' + idx + '" class="row-type-' + Calc.escapeHtml(item.type) + rowInvalidClass + '">' +
          '<td class="fw-semibold text-muted cell-sl">' + sl + '</td>' +
          '<td class="cell-name" data-label="Particulars">' +
            '<input type="text" class="form-control form-control-sm inline-input item-inline-name" data-idx="' + idx + '" value="' + Calc.escapeHtml(item.name) + '" list="vegetable-suggestions" aria-label="Item name">' +
          '</td>' +
          '<td class="cell-type">' + typeBadge + '</td>' +
          '<td class="cell-qty" data-label="' + qtyLabel + '">' + qtyCellHtml + '</td>' +
          '<td class="cell-rate" data-label="' + rateLabel + '">' + rateCellHtml + '</td>' +
          '<td class="text-end cell-amount" data-label="' + amountLabel + '">' + amountCellHtml + '</td>' +
          '<td class="text-center cell-actions">' +
            '<div class="btn-group btn-group-sm">' +
              '<button type="button" class="btn btn-outline-secondary btn-row-edit" data-idx="' + idx + '" title="Edit item details / type"><i class="bi bi-pencil"></i></button>' +
              '<button type="button" class="btn btn-outline-danger btn-row-remove" data-idx="' + idx + '" title="Remove item"><i class="bi bi-trash"></i></button>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    });

    tbody.innerHTML = html;
    updateTotalsSummary();
  }

  function updateTotalsSummary() {
    const Calc = VBS.Calculations;
    const items = currentBill ? currentBill.items : [];
    const grandPaise = Calc.calculateGrandTotalPaise(items);

    const totalEl = document.getElementById('billing-grand-total');
    const countBadge = document.getElementById('billing-item-count-badge');
    const breakdownEl = document.getElementById('billing-summary-breakdown');

    if (totalEl) totalEl.textContent = Calc.formatPaise(grandPaise);
    if (countBadge) countBadge.textContent = items.length + (items.length === 1 ? ' Item' : ' Items');

    if (breakdownEl) {
      let kgCount = 0;
      let qtyCount = 0;
      let dirCount = 0;
      items.forEach(function (it) {
        if (it.type === 'kg') kgCount += 1;
        else if (it.type === 'quantity') qtyCount += 1;
        else if (it.type === 'direct') dirCount += 1;
      });
      breakdownEl.textContent = kgCount + ' KG • ' + qtyCount + ' Quantity • ' + dirCount + ' Direct';
    }
  }

  function handleInlineTableInput(e) {
    if (!currentBill) return;
    const target = e.target;
    const idxAttr = target.getAttribute('data-idx');
    if (idxAttr === null) return;
    const idx = parseInt(idxAttr, 10);
    const item = currentBill.items[idx];
    if (!item) return;

    // Prevent negative numbers in inline numeric fields
    if (target.type === 'number' && String(target.value).trim().startsWith('-')) {
      target.value = String(target.value).replace(/-/g, '');
    }

    if (target.classList.contains('item-inline-name')) {
      item.name = target.value;
    } else if (target.classList.contains('item-inline-kg')) {
      item.kg = target.value;
    } else if (target.classList.contains('item-inline-qty')) {
      item.quantity = target.value;
    } else if (target.classList.contains('item-inline-unit')) {
      item.unit = target.value;
    } else if (target.classList.contains('item-inline-rate')) {
      item.rate = target.value;
    } else if (target.classList.contains('item-inline-direct')) {
      item.directAmount = target.value;
    }

    const rowEl = target.closest('tr');
    if (rowEl) {
      rowEl.classList.remove('row-invalid');
      const amtTextEl = rowEl.querySelector('.item-row-amount-text');
      if (amtTextEl) {
        amtTextEl.textContent = VBS.Calculations.formatPaise(VBS.Calculations.calculateItemAmountPaise(item));
      }
    }
    updateTotalsSummary();
  }

  /* ---- Edit Item Modal (Allows Type Switching too) ---- */

  function openEditItemModal(idx) {
    const item = currentBill && currentBill.items[idx];
    if (!item) return;

    document.getElementById('edit-item-index').value = String(idx);
    document.getElementById('edit-item-type').value = item.type;
    document.getElementById('edit-item-name').value = item.name || '';
    document.getElementById('edit-item-kg').value = item.kg !== undefined ? item.kg : '';
    document.getElementById('edit-item-kg-rate').value = item.type === 'kg' && item.rate !== undefined ? item.rate : '';
    document.getElementById('edit-item-qty').value = item.quantity !== undefined ? item.quantity : '';
    document.getElementById('edit-item-unit').value = item.unit || '';
    document.getElementById('edit-item-qty-rate').value = item.type === 'quantity' && item.rate !== undefined ? item.rate : '';
    document.getElementById('edit-item-direct').value = item.directAmount !== undefined ? item.directAmount : '';
    document.getElementById('edit-item-error').classList.add('d-none');

    syncEditModalGroups();
    VBS.App.showModal('editItemModal');
  }

  function syncEditModalGroups() {
    const type = document.getElementById('edit-item-type').value;
    document.getElementById('edit-group-kg').classList.toggle('d-none', type !== 'kg');
    document.getElementById('edit-group-quantity').classList.toggle('d-none', type !== 'quantity');
    document.getElementById('edit-group-direct').classList.toggle('d-none', type !== 'direct');
    updateEditModalPreview();
  }

  function buildEditedItemFromModal() {
    const type = document.getElementById('edit-item-type').value;
    const name = document.getElementById('edit-item-name').value.trim();
    if (type === 'kg') {
      return {
        type: 'kg',
        name: name,
        kg: document.getElementById('edit-item-kg').value,
        rate: document.getElementById('edit-item-kg-rate').value
      };
    }
    if (type === 'quantity') {
      return {
        type: 'quantity',
        name: name,
        quantity: document.getElementById('edit-item-qty').value,
        unit: document.getElementById('edit-item-unit').value.trim(),
        rate: document.getElementById('edit-item-qty-rate').value
      };
    }
    return {
      type: 'direct',
      name: name,
      directAmount: document.getElementById('edit-item-direct').value
    };
  }

  function updateEditModalPreview() {
    const Calc = VBS.Calculations;
    const candidate = buildEditedItemFromModal();
    document.getElementById('edit-item-amount-preview').textContent = Calc.formatPaise(Calc.calculateItemAmountPaise(candidate));
  }

  function saveEditedItemFromModal() {
    const Calc = VBS.Calculations;
    const idx = parseInt(document.getElementById('edit-item-index').value, 10);
    const errEl = document.getElementById('edit-item-error');
    const existing = currentBill && currentBill.items[idx];
    if (!existing) return;

    const updated = buildEditedItemFromModal();
    if (!updated.name) {
      errEl.textContent = 'Item name is required.';
      errEl.classList.remove('d-none');
      return;
    }

    const check = Calc.validateItem(updated, currentBill.status === 'draft' || currentBill.status === 'new');
    if (!check.valid) {
      errEl.textContent = check.message;
      errEl.classList.remove('d-none');
      return;
    }

    currentBill.items[idx] = Object.assign({ id: existing.id }, updated);
    VBS.App.hideModal('editItemModal');
    renderItemsTable();
    clearValidationAlert();
  }

  /* ---- Save Draft, Preview, Finalize, Discard ---- */

  function clearValidationAlert() {
    const el = document.getElementById('billing-validation-alert');
    if (el) {
      el.classList.add('d-none');
      el.innerHTML = '';
    }
  }

  function showValidationErrors(errors) {
    const el = document.getElementById('billing-validation-alert');
    if (!el) return;
    const listItems = errors.map(function (msg) {
      return '<li>' + VBS.Calculations.escapeHtml(msg) + '</li>';
    }).join('');
    el.innerHTML = '<strong>Please fix the following before finalizing:</strong><ul class="mb-0 mt-1">' + listItems + '</ul>';
    el.classList.remove('d-none');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function persistBillRecord(targetStatus) {
    const Calc = VBS.Calculations;
    const now = new Date().toISOString();

    ensureNumberReserved();

    const bills = VBS.Storage.getBills();
    const grandTotalPaise = Calc.calculateGrandTotalPaise(currentBill.items);

    const record = {
      id: currentBill.id || VBS.Storage.generateId('bill'),
      billNumber: currentBill.billNumber,
      date: currentBill.date,
      customerId: currentBill.customerId,
      customerName: currentBill.customerName,
      status: targetStatus,
      items: currentBill.items.map(function (it) {
        return Object.assign({}, it, {
          name: String(it.name || '').trim(),
          amountPaise: Calc.calculateItemAmountPaise(it)
        });
      }),
      grandTotalPaise: grandTotalPaise,
      revisions: Array.isArray(currentBill.revisions) ? currentBill.revisions.slice() : [],
      revisionCount: currentBill.revisionCount || 0,
      createdAt: currentBill.createdAt || now,
      updatedAt: now
    };

    if (targetStatus === 'revised' && originalFinalizedSnapshot) {
      record.revisions.push({
        revisedAt: now,
        previousTotalPaise: originalFinalizedSnapshot.grandTotalPaise || Calc.calculateGrandTotalPaise(originalFinalizedSnapshot.items),
        previousItemCount: (originalFinalizedSnapshot.items || []).length,
        previousDate: originalFinalizedSnapshot.date,
        previousCustomerName: originalFinalizedSnapshot.customerName
      });
      record.revisionCount = record.revisions.length;
    }

    const existingIdx = bills.findIndex(function (b) { return b.id === record.id; });
    if (existingIdx !== -1) {
      bills[existingIdx] = record;
    } else {
      bills.push(record);
    }

    const saveRes = VBS.Storage.saveBills(bills);
    if (!saveRes.ok) {
      VBS.App.showToast(saveRes.error, 'danger');
      return null;
    }

    currentBill = Object.assign({}, record, { numberReserved: true });
    return record;
  }

  function handleSaveDraft() {
    if (!currentBill) return;
    if (!currentBill.customerId && currentBill.items.length === 0) {
      VBS.App.showToast('Add a customer or at least one item before saving a draft.', 'warning');
      return;
    }

    // Validate non-negative numbers only (zero allowed in drafts)
    const Calc = VBS.Calculations;
    for (let i = 0; i < currentBill.items.length; i += 1) {
      const res = Calc.validateItem(currentBill.items[i], true);
      if (!res.valid) {
        renderItemsTable([i]);
        showValidationErrors(['Row ' + (i + 1) + ': ' + res.message]);
        return;
      }
    }

    if (originalFinalizedSnapshot) {
      VBS.App.showToast('A finalized bill cannot be downgraded to a draft. Save revision or cancel editing.', 'warning');
      return;
    }

    const saved = persistBillRecord('draft');
    if (saved) {
      syncFormFromState();
      VBS.App.refreshAllViews();
      VBS.App.showToast('Draft ' + saved.billNumber + ' saved.', 'success');
    }
  }

  function handlePreviewBill() {
    if (!currentBill) return;
    const Calc = VBS.Calculations;
    const snapshot = Object.assign({}, currentBill, {
      grandTotalPaise: Calc.calculateGrandTotalPaise(currentBill.items)
    });
    VBS.BillTemplate.openPreview(snapshot, {
      backLabel: 'Back to Editing'
    });
  }

  function handleShareBill(event) {
    if (!currentBill) return;
    const Calc = VBS.Calculations;
    const snapshot = Object.assign({}, currentBill, {
      grandTotalPaise: Calc.calculateGrandTotalPaise(currentBill.items)
    });
    VBS.BillTemplate.shareBillPdf(snapshot, event ? event.currentTarget : null);
  }

  function handleFinalizeBill() {
    if (!currentBill) return;
    const Calc = VBS.Calculations;
    const validation = Calc.validateBillForFinalize(currentBill);

    if (!validation.valid) {
      renderItemsTable(validation.invalidItemIndices);
      showValidationErrors(validation.errors);
      return;
    }

    clearValidationAlert();
    const targetStatus = originalFinalizedSnapshot ? 'revised' : 'finalized';
    const saved = persistBillRecord(targetStatus);
    if (!saved) return;

    VBS.App.refreshAllViews();
    VBS.App.showToast(
      targetStatus === 'revised'
        ? 'Bill ' + saved.billNumber + ' revised and saved.'
        : 'Bill ' + saved.billNumber + ' finalized and saved.',
      'success'
    );

    // Open traditional bill preview, and once closed reset composer to next fresh bill
    // so finalized bills cannot be accidentally overwritten.
    VBS.BillTemplate.openPreview(saved, {
      backLabel: 'Done (Start Next Bill)',
      onClose: function () {
        startNewBill();
      }
    });
  }

  function handleDiscardOrCancel() {
    if (!currentBill) return;

    const isRevising = Boolean(originalFinalizedSnapshot);
    const hasData = Boolean(currentBill.id || currentBill.customerId || currentBill.items.length > 0);

    if (!hasData) {
      startNewBill();
      return;
    }

    VBS.App.confirmAction({
      title: isRevising ? 'Cancel Revision' : 'Cancel / Clear Bill',
      body: isRevising
        ? 'Discard your unsaved changes to <strong>' + VBS.Calculations.escapeHtml(currentBill.billNumber) + '</strong>? The original finalized bill will remain unchanged.'
        : 'Clear this bill workspace? Notice: bill number <strong>' + VBS.Calculations.escapeHtml(currentBill.billNumber) + '</strong> will not be reused for future bills.',
      confirmText: isRevising ? 'Discard Changes' : 'Clear & Start Fresh',
      confirmClass: 'btn-danger',
      onConfirm: function () {
        if (!isRevising) {
          ensureNumberReserved();
        }
        startNewBill();
        VBS.App.refreshAllViews();
        VBS.App.showToast(isRevising ? 'Revision cancelled.' : 'Cleared bill. Next bill number ready.', 'info');
      }
    });
  }

  /* ---- Quick Pick Chips & Keyboard Handling ---- */

  function renderQuickPickChips() {
    const container = document.getElementById('quick-pick-chips');
    if (!container) return;
    const Calc = VBS.Calculations;

    container.innerHTML = QUICK_ITEMS.map(function (item, idx) {
      return '<button type="button" class="quick-chip" data-quick-idx="' + idx + '">' + Calc.escapeHtml(item.label) + '</button>';
    }).join('');
  }

  function blockNegativeKeydown(e) {
    if (e.key === '-' || e.key === 'Subtract') {
      e.preventDefault();
    }
  }

  function init() {
    renderQuickPickChips();

    // Entry type radios
    document.querySelectorAll('input[name="entry-type"]').forEach(function (radio) {
      radio.addEventListener('change', updateEntryTypeVisibility);
    });

    // Entry live amount calculation
    ['entry-kg', 'entry-kg-rate', 'entry-qty', 'entry-qty-rate', 'entry-direct-amount'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', blockNegativeKeydown);
        el.addEventListener('input', function () {
          if (String(el.value).trim().startsWith('-')) {
            el.value = String(el.value).replace(/-/g, '');
          }
          updateEntryLivePreview();
        });
      }
    });

    // Keyboard Enter flow inside entry bar (no page reload!)
    const entryNameEl = document.getElementById('entry-name');
    const entryKgEl = document.getElementById('entry-kg');
    const entryKgRateEl = document.getElementById('entry-kg-rate');
    const entryQtyEl = document.getElementById('entry-qty');
    const entryUnitEl = document.getElementById('entry-unit');
    const entryQtyRateEl = document.getElementById('entry-qty-rate');
    const entryDirectEl = document.getElementById('entry-direct-amount');

    if (entryNameEl) {
      entryNameEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const t = getSelectedEntryType();
          if (t === 'kg') entryKgEl.focus();
          else if (t === 'quantity') entryQtyEl.focus();
          else entryDirectEl.focus();
        }
      });
    }
    if (entryKgEl) {
      entryKgEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); entryKgRateEl.focus(); }
      });
    }
    if (entryQtyEl) {
      entryQtyEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); entryQtyRateEl.focus(); }
      });
    }
    if (entryUnitEl) {
      entryUnitEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); entryQtyRateEl.focus(); }
      });
    }
    [entryKgRateEl, entryQtyRateEl, entryDirectEl].forEach(function (el) {
      if (el) {
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddItem();
          }
        });
      }
    });

    const btnAddItem = document.getElementById('btn-add-item');
    if (btnAddItem) btnAddItem.addEventListener('click', handleAddItem);

    // Quick pick chips
    const chipsWrap = document.getElementById('quick-pick-chips');
    if (chipsWrap) {
      chipsWrap.addEventListener('click', function (e) {
        const chip = e.target.closest('.quick-chip');
        if (!chip) return;
        const qi = QUICK_ITEMS[parseInt(chip.getAttribute('data-quick-idx'), 10)];
        if (!qi) return;

        setSelectedEntryType(qi.type);
        entryNameEl.value = qi.name;
        if (qi.type === 'quantity' && qi.unit) {
          entryUnitEl.value = qi.unit;
        }
        updateEntryLivePreview();
        if (qi.type === 'kg') entryKgEl.focus();
        else if (qi.type === 'quantity') entryQtyEl.focus();
        else entryDirectEl.focus();
      });
    }

    // Customer selection & bill date changes
    const custSelect = document.getElementById('bill-customer-select');
    if (custSelect) {
      custSelect.addEventListener('change', function () {
        if (!currentBill) return;
        const custId = custSelect.value;
        const cust = VBS.Storage.getCustomers().find(function (c) { return c.id === custId; });
        currentBill.customerId = custId;
        currentBill.customerName = cust ? cust.name : '';
        if (custId) {
          ensureNumberReserved();
          if (currentBill.status === 'new') currentBill.status = 'draft';
        }
        updateCustomerPreviewInfo();
        clearValidationAlert();
      });
    }

    const dateInput = document.getElementById('bill-date-input');
    if (dateInput) {
      dateInput.addEventListener('change', function () {
        if (currentBill) currentBill.date = dateInput.value;
      });
    }

    // Inline Quick Add Customer
    const btnQuickAddCust = document.getElementById('btn-quick-add-customer');
    if (btnQuickAddCust) {
      btnQuickAddCust.addEventListener('click', function () {
        VBS.Customers.openCustomerModal(null, function (newCust) {
          if (currentBill && newCust) {
            currentBill.customerId = newCust.id;
            currentBill.customerName = newCust.name;
            ensureNumberReserved();
            if (currentBill.status === 'new') currentBill.status = 'draft';
            refreshCustomerDropdown();
          }
        });
      });
    }

    // Items Table Inline Edits & Row Actions
    const tbody = document.getElementById('billing-items-tbody');
    if (tbody) {
      tbody.addEventListener('keydown', function (e) {
        if (e.target.type === 'number') {
          blockNegativeKeydown(e);
        }
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
          e.preventDefault();
        }
      });
      tbody.addEventListener('input', handleInlineTableInput);
      tbody.addEventListener('click', function (e) {
        const btnEdit = e.target.closest('.btn-row-edit');
        if (btnEdit) {
          openEditItemModal(parseInt(btnEdit.getAttribute('data-idx'), 10));
          return;
        }
        const btnRemove = e.target.closest('.btn-row-remove');
        if (btnRemove) {
          const idx = parseInt(btnRemove.getAttribute('data-idx'), 10);
          if (currentBill && currentBill.items[idx]) {
            currentBill.items.splice(idx, 1);
            renderItemsTable();
            clearValidationAlert();
          }
        }
      });
    }

    // Edit Item Modal Events
    const editTypeSelect = document.getElementById('edit-item-type');
    if (editTypeSelect) editTypeSelect.addEventListener('change', syncEditModalGroups);
    ['edit-item-kg', 'edit-item-kg-rate', 'edit-item-qty', 'edit-item-qty-rate', 'edit-item-direct'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', blockNegativeKeydown);
        el.addEventListener('input', function () {
          if (String(el.value).trim().startsWith('-')) {
            el.value = String(el.value).replace(/-/g, '');
          }
          updateEditModalPreview();
        });
      }
    });
    const btnSaveEditedItem = document.getElementById('btn-save-edited-item');
    if (btnSaveEditedItem) btnSaveEditedItem.addEventListener('click', saveEditedItemFromModal);

    // Top & Bottom Action Buttons
    document.getElementById('btn-billing-discard').addEventListener('click', handleDiscardOrCancel);
    document.getElementById('btn-billing-save-draft').addEventListener('click', handleSaveDraft);
    document.getElementById('btn-billing-save-draft-bottom').addEventListener('click', handleSaveDraft);
    document.getElementById('btn-billing-preview').addEventListener('click', handlePreviewBill);
    document.getElementById('btn-billing-preview-bottom').addEventListener('click', handlePreviewBill);
    document.getElementById('btn-billing-share-whatsapp').addEventListener('click', handleShareBill);
    document.getElementById('btn-billing-share-whatsapp-bottom').addEventListener('click', handleShareBill);
    document.getElementById('btn-billing-finalize').addEventListener('click', handleFinalizeBill);
    document.getElementById('btn-billing-finalize-bottom').addEventListener('click', handleFinalizeBill);

    // Initialize clean blank bill
    startNewBill();
  }

  VBS.Billing = {
    init: init,
    startNewBill: startNewBill,
    loadBillForEditing: loadBillForEditing,
    refreshCustomerDropdown: refreshCustomerDropdown,
    syncFormFromState: syncFormFromState,
    getCurrentBill: function () { return currentBill; }
  };
})(window);

