/* =========================================================
   BILL TEMPLATE, PREVIEW, PRINT & PDF GENERATION MODULE
   Design System B: Traditional Paper Bill (Reference Match)
   ========================================================= */

(function (global) {
  'use strict';

  const VBS = (global.VBS = global.VBS || {});
  const ROWS_PER_PAGE = 15;

  let activePreviewBill = null;
  let onPreviewCloseCallback = null;

  function formatRowSl(num) {
    return String(num).padStart(2, '0') + '.';
  }

  function buildItemRowHtml(item, rowNumber) {
    const Calc = VBS.Calculations;
    const slText = formatRowSl(rowNumber);

    if (!item) {
      return (
        '<tr>' +
          '<td class="bill-cell-sl">' + slText + '</td>' +
          '<td class="bill-cell-particulars">&nbsp;</td>' +
          '<td class="bill-cell-qty">&nbsp;</td>' +
          '<td class="bill-cell-rate">&nbsp;</td>' +
          '<td class="bill-cell-amount">&nbsp;</td>' +
        '</tr>'
      );
    }

    const name = Calc.escapeHtml(item.name || '');
    const amountStr = Calc.formatPaise(Calc.calculateItemAmountPaise(item));
    let qtyHtml = '—';
    let rateHtml = '—';
    let rateClass = 'bill-cell-rate is-dash';

    if (item.type === 'kg') {
      qtyHtml = Calc.formatQtyNumber(item.kg) + ' KG';
      rateHtml = Calc.formatRate(item.rate);
      rateClass = 'bill-cell-rate';
    } else if (item.type === 'quantity') {
      const unitStr = item.unit ? ' ' + Calc.escapeHtml(item.unit) : '';
      qtyHtml = Calc.formatQtyNumber(item.quantity) + unitStr;
      rateHtml = Calc.formatRate(item.rate);
      rateClass = 'bill-cell-rate';
    }

    return (
      '<tr>' +
        '<td class="bill-cell-sl">' + slText + '</td>' +
        '<td class="bill-cell-particulars">' + name + '</td>' +
        '<td class="bill-cell-qty">' + qtyHtml + '</td>' +
        '<td class="' + rateClass + '">' + rateHtml + '</td>' +
        '<td class="bill-cell-amount">' + amountStr + '</td>' +
      '</tr>'
    );
  }

  function buildBillSheetHtml(bill, settings, customerObj, pageItems, startIndex, pageIndex, totalPages) {
    const Calc = VBS.Calculations;
    const h = settings.headings;
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === totalPages - 1;
    const grandTotalPaise = Calc.calculateGrandTotalPaise(bill.items || []);
    const grandTotalFormatted = Calc.formatPaise(grandTotalPaise);

    const dateFormatted = Calc.formatDateDisplay(bill.date, true) || '____ / ____ / ______';
    const billNoText = Calc.escapeHtml(bill.billNumber || '');
    const draftTag = bill.status === 'draft' ? ' (DRAFT)' : '';
    const pageTag = totalPages > 1 ? ' (' + (pageIndex + 1) + '/' + totalPages + ')' : '';

    // Business header lines (only rendered if present in Settings — never invented)
    const logoHtml = settings.logoDataUrl
      ? '<img src="' + Calc.escapeHtml(settings.logoDataUrl) + '" alt="Business Logo" class="bill-logo-img">'
      : '';

    const businessNameHtml = settings.businessName
      ? '<h1 class="bill-business-name">' + Calc.escapeHtml(settings.businessName) + '</h1>'
      : '';

    const proprietorParts = [];
    if (settings.proprietor && settings.proprietor.trim()) {
      proprietorParts.push(Calc.escapeHtml(settings.proprietor.trim()));
    }
    if (settings.phone && settings.phone.trim()) {
      const phoneLabel = settings.defaultLanguage === 'english' ? 'Cell : ' : 'సెల్ : ';
      proprietorParts.push(phoneLabel + Calc.escapeHtml(settings.phone.trim()));
    }
    const proprietorLineHtml = proprietorParts.length
      ? '<p class="bill-proprietor-line">' + proprietorParts.join(' &nbsp; ') + '</p>'
      : '';

    const addressLineHtml = settings.address && settings.address.trim()
      ? '<p class="bill-address-line">' + Calc.escapeHtml(settings.address.trim()) + '</p>'
      : '';

    // Customer details lines
    const customerName = Calc.escapeHtml(bill.customerName || '');
    const secondLineParts = [];
    if (customerObj) {
      if (customerObj.address && customerObj.address.trim()) {
        secondLineParts.push(Calc.escapeHtml(customerObj.address.trim()));
      }
      if (customerObj.phone && customerObj.phone.trim()) {
        secondLineParts.push('Ph: ' + Calc.escapeHtml(customerObj.phone.trim()));
      }
    }
    const secondLineText = secondLineParts.join(' | ');

    // Header amount cell with optional రూ॥  పై॥ sub-header
    const amountHeaderHtml = settings.showRupeesPaise
      ? (
        '<th class="bill-col-amount bill-amount-th">' +
          '<div class="bill-amount-th-title">' + Calc.escapeHtml(h.amount) + '</div>' +
          '<div class="bill-amount-th-sub"><span>రూ॥</span><span>పై॥</span></div>' +
        '</th>'
      )
      : '<th class="bill-col-amount">' + Calc.escapeHtml(h.amount) + '</th>';

    // Rows on this page
    const minRows = settings.padMinimum15Rows ? ROWS_PER_PAGE : Math.max(1, pageItems.length);
    const totalRowsOnSheet = Math.max(pageItems.length, minRows);
    let rowsHtml = '';
    for (let i = 0; i < totalRowsOnSheet; i += 1) {
      const item = i < pageItems.length ? pageItems[i] : null;
      rowsHtml += buildItemRowHtml(item, startIndex + i + 1);
    }

    // Bottom Total Row (or Continued note on intermediate pages)
    let bottomRowHtml = '';
    if (isLastPage) {
      bottomRowHtml = (
        '<tr class="bill-total-row">' +
          '<td>&nbsp;</td>' +
          '<td>&nbsp;</td>' +
          '<td>&nbsp;</td>' +
          '<td class="bill-total-label-cell">' + Calc.escapeHtml(h.totalLabel) + '</td>' +
          '<td class="bill-total-value-cell">' + grandTotalFormatted + '</td>' +
        '</tr>'
      );
    } else {
      const contText = settings.defaultLanguage === 'english' ? 'Continued...' : 'తదుపరి పేజీలో...';
      bottomRowHtml = (
        '<tr class="bill-total-row">' +
          '<td>&nbsp;</td>' +
          '<td colspan="4" class="bill-continued-note">' + contText + ' (' + (pageIndex + 1) + '/' + totalPages + ')</td>' +
        '</tr>'
      );
    }

    const wordsHtml = isLastPage && settings.showAmountInWords
      ? '<div class="bill-words-area">' + Calc.escapeHtml(Calc.amountToWordsINR(grandTotalPaise)) + '</div>'
      : '<div class="bill-words-area">&nbsp;</div>';

    const revisionFootHtml = isLastPage && bill.status === 'revised' && bill.revisionCount > 0
      ? '<div class="bill-revision-foot">Revised Copy (v' + (bill.revisionCount + 1) + ')</div>'
      : '';

    const fullHeaderHtml = isFirstPage
      ? (
        '<div class="bill-business-header">' +
          '<div class="bill-business-top-row">' +
            logoHtml +
            '<div>' + businessNameHtml + '</div>' +
          '</div>' +
          proprietorLineHtml +
          addressLineHtml +
        '</div>' +
        '<div class="bill-customer-block">' +
          '<div class="bill-sri-row">' +
            '<span class="bill-sri-prefix">' + Calc.escapeHtml(h.sriLabel) + '</span>' +
            '<div class="bill-dotted-line">' + customerName + '</div>' +
          '</div>' +
          '<div class="bill-dotted-line-full">' + (secondLineText || '&nbsp;') + '</div>' +
        '</div>'
      )
      : (
        '<div class="bill-customer-block" style="margin-bottom: 2.5mm;">' +
          '<div class="bill-sri-row">' +
            '<span class="bill-sri-prefix">' + Calc.escapeHtml(h.sriLabel) + '</span>' +
            '<div class="bill-dotted-line">' + customerName + ' (Contd.)</div>' +
          '</div>' +
        '</div>'
      );

    return (
      '<article class="bill-sheet">' +
        '<div class="bill-frame-outer">' +
          '<div class="bill-frame-inner">' +
            '<div class="bill-top-meta">' +
              '<div class="bill-top-no">' + billNoText + draftTag + pageTag + '</div>' +
              '<div class="bill-top-title">' + Calc.escapeHtml(settings.defaultBillTitle) + '</div>' +
              '<div class="bill-top-date">' +
                Calc.escapeHtml(h.dateLabel) +
                '<span class="bill-date-dots">' + dateFormatted + '</span>' +
              '</div>' +
            '</div>' +
            fullHeaderHtml +
            '<div class="bill-table-wrap">' +
              '<table class="bill-paper-table">' +
                '<thead>' +
                  '<tr>' +
                    '<th class="bill-col-sl">' + Calc.escapeHtml(h.slNo) + '</th>' +
                    '<th class="bill-col-particulars">' + Calc.escapeHtml(h.particulars) + '</th>' +
                    '<th class="bill-col-qty">' + Calc.escapeHtml(h.qty) + '</th>' +
                    '<th class="bill-col-rate">' + Calc.escapeHtml(h.rate) + '</th>' +
                    amountHeaderHtml +
                  '</tr>' +
                '</thead>' +
                '<tbody>' +
                  rowsHtml +
                  bottomRowHtml +
                '</tbody>' +
              '</table>' +
            '</div>' +
            '<div class="bill-footer-area">' +
              wordsHtml +
              '<div class="bill-signature-area">' + Calc.escapeHtml(h.signatureLabel) + '</div>' +
            '</div>' +
            revisionFootHtml +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  /**
   * Render complete traditional paper bill HTML (1 or more A4 pages) into a target element.
   */
  function renderBillInto(containerEl, bill, settingsOverride) {
    if (!containerEl || !bill) return;
    const settings = settingsOverride || VBS.Storage.getSettings();
    const customers = VBS.Storage.getCustomers();
    const customerObj = customers.find(function (c) { return c.id === bill.customerId; }) || null;
    const items = Array.isArray(bill.items) ? bill.items : [];

    // Chunk items into pages of 15 rows so multi-page bills never clip borders or rows
    const pages = [];
    if (items.length === 0) {
      pages.push([]);
    } else {
      for (let i = 0; i < items.length; i += ROWS_PER_PAGE) {
        pages.push(items.slice(i, i + ROWS_PER_PAGE));
      }
    }

    let html = '';
    for (let p = 0; p < pages.length; p += 1) {
      html += buildBillSheetHtml(bill, settings, customerObj, pages[p], p * ROWS_PER_PAGE, p, pages.length);
    }

    containerEl.innerHTML = html;
  }

  function updatePreviewScale() {
    const scaler = document.getElementById('bill-preview-scaler');
    const target = document.getElementById('bill-render-target');
    const stage = document.getElementById('print-stage');
    if (!scaler || !target || !stage || stage.classList.contains('d-none')) return;

    scaler.style.transform = '';
    scaler.style.width = '';
    scaler.style.height = '';

    const viewportW = global.innerWidth || 0;
    const sheetW = target.scrollWidth || 0;
    const sheetH = target.scrollHeight || 0;
    if (viewportW > 0 && sheetW > 0 && viewportW < sheetW + 24) {
      const scale = Math.max(0.35, (viewportW - 20) / sheetW);
      scaler.style.transform = 'scale(' + scale.toFixed(4) + ')';
      scaler.style.width = Math.round(sheetW * scale) + 'px';
      scaler.style.height = Math.round(sheetH * scale) + 'px';
    }
  }

  /**
   * Open the dedicated Preview / Print stage.
   */
  function openPreview(bill, options) {
    const opts = options || {};
    activePreviewBill = bill;
    onPreviewCloseCallback = typeof opts.onClose === 'function' ? opts.onClose : null;

    const stage = document.getElementById('print-stage');
    const target = document.getElementById('bill-render-target');
    const badge = document.getElementById('preview-bill-badge');
    const backLabel = document.getElementById('preview-back-label');

    renderBillInto(target, bill);

    if (badge) {
      const Calc = VBS.Calculations;
      const totalStr = Calc.formatPaise(Calc.calculateGrandTotalPaise(bill.items || []));
      badge.textContent = (bill.billNumber || 'Bill') + ' • ' + totalStr;
    }
    if (backLabel) {
      backLabel.textContent = opts.backLabel || 'Back to Editing';
    }

    stage.classList.remove('d-none');
    stage.setAttribute('aria-hidden', 'false');
    stage.scrollTop = 0;

    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(updatePreviewScale);
    } else {
      updatePreviewScale();
    }

    if (opts.autoPrint) {
      setTimeout(function () {
        printCurrentBill();
      }, 150);
    }
  }

  function closePreview() {
    const stage = document.getElementById('print-stage');
    stage.classList.add('d-none');
    stage.setAttribute('aria-hidden', 'true');
    activePreviewBill = null;
    if (onPreviewCloseCallback) {
      const cb = onPreviewCloseCallback;
      onPreviewCloseCallback = null;
      cb();
    }
  }

  /**
   * Trigger native A4 browser print.
   */
  function printCurrentBill() {
    if (!activePreviewBill) return;
    const prevTitle = document.title;
    const billNo = (activePreviewBill.billNumber || 'Bill').replace(/[^\w\-]+/g, '_');
    const cust = (activePreviewBill.customerName || 'Customer').replace(/[^\w\u0C00-\u0C7F\-]+/g, '_').slice(0, 30);
    document.title = billNo + '_' + cust;

    global.print();

    setTimeout(function () {
      document.title = prevTitle;
    }, 500);
  }

  function getPdfFilename(bill) {
    const safeNo = (bill.billNumber || 'Bill').replace(/[^\w\-]+/g, '_');
    const safeCust = (bill.customerName || 'Customer')
      .replace(/[^\w\-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24);
    return safeCust ? safeNo + '_' + safeCust + '.pdf' : safeNo + '.pdf';
  }

  function canGeneratePdf() {
    return typeof global.html2canvas === 'function' &&
      global.jspdf &&
      typeof global.jspdf.jsPDF === 'function';
  }

  function setPdfActionState(button, busy, label) {
    if (!button) return function () {};
    const originalHtml = button.innerHTML;
    const originalLabel = button.getAttribute('aria-label');

    if (busy) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('aria-label', label);
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span><span>' + label + '</span>';
    }

    return function () {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.innerHTML = originalHtml;
      if (originalLabel === null) button.removeAttribute('aria-label');
      else button.setAttribute('aria-label', originalLabel);
    };
  }

  /** Generate the exact A4 PDF used by the Download PDF action. */
  async function createBillPdf(bill) {
    const offscreenHost = document.createElement('div');
    offscreenHost.style.position = 'fixed';
    offscreenHost.style.left = '-9999px';
    offscreenHost.style.top = '0';
    offscreenHost.style.width = '190mm';
    offscreenHost.style.background = '#ffffff';
    offscreenHost.style.zIndex = '-1';
    document.body.appendChild(offscreenHost);

    try {
      renderBillInto(offscreenHost, bill);
      const sheets = offscreenHost.querySelectorAll('.bill-sheet');

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const JsPDFCtor = global.jspdf.jsPDF;
      const pdf = new JsPDFCtor({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      for (let i = 0; i < sheets.length; i += 1) {
        const sheet = sheets[i];
        sheet.style.boxShadow = 'none';
        sheet.style.padding = '0';

        const canvas = await global.html2canvas(sheet, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });
        const pageW = 190;
        const pageH = Math.min(277, (canvas.height * pageW) / canvas.width);

        if (i > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, pageW, pageH, undefined, 'FAST');
      }

      return { pdf: pdf, filename: getPdfFilename(bill) };
    } finally {
      if (offscreenHost.parentNode) offscreenHost.parentNode.removeChild(offscreenHost);
    }
  }

  /**
   * Shares the generated A4 PDF through the native share sheet. On mobile,
   * choose WhatsApp in that sheet to send the attached bill file.
   */
  async function shareBillPdf(billToShare, triggerButton) {
    const bill = billToShare || activePreviewBill;
    if (!bill) {
      VBS.App.showToast('Open or create a bill before sharing it.', 'warning');
      return;
    }

    if (!canGeneratePdf()) {
      VBS.App.showToast('PDF sharing is unavailable right now. Use the PDF button to save the bill first.', 'warning');
      return;
    }

    const restoreButton = setPdfActionState(triggerButton, true, 'Preparing PDF…');
    try {
      const result = await createBillPdf(bill);
      const file = typeof global.File === 'function'
        ? new global.File([result.pdf.output('blob')], result.filename, { type: 'application/pdf' })
        : null;
      const sharePayload = { files: file ? [file] : [], title: result.filename };
      let canUseNativeShare = Boolean(file) &&
        global.navigator &&
        typeof global.navigator.share === 'function';
      if (canUseNativeShare && global.navigator.canShare) {
        try {
          canUseNativeShare = global.navigator.canShare(sharePayload);
        } catch (err) {
          canUseNativeShare = false;
        }
      }

      if (canUseNativeShare) {
        try {
          await global.navigator.share(sharePayload);
          VBS.App.showToast('PDF shared successfully.', 'success');
        } catch (err) {
          if (err && err.name !== 'AbortError') {
            VBS.App.showToast('Could not open sharing. The PDF has been downloaded instead.', 'info');
            result.pdf.save(result.filename);
          }
        }
      } else {
        result.pdf.save(result.filename);
        VBS.App.showToast('PDF downloaded. Attach ' + result.filename + ' in WhatsApp to send it.', 'info');
      }
    } catch (err) {
      VBS.App.showToast('Could not create the PDF. Please try the PDF button or print as PDF.', 'danger');
    } finally {
      restoreButton();
    }
  }

  /**
   * Download PDF via html2canvas + jsPDF when available, with reliable browser Save-as-PDF fallback.
   */
  async function downloadBillPdf(billToExport) {
    const bill = billToExport || activePreviewBill;
    if (!bill) return;

    const btn = document.getElementById('btn-preview-download-pdf');

    // Ensure target is rendered cleanly even if triggered directly from Bill History
    const stage = document.getElementById('print-stage');
    const wasHidden = stage.classList.contains('d-none');
    if (billToExport && wasHidden) {
      activePreviewBill = billToExport;
    }

    if (!canGeneratePdf()) {
      if (wasHidden) {
        openPreview(bill, { backLabel: 'Close Preview', autoPrint: true });
      } else {
        printCurrentBill();
      }
      VBS.App.showToast('Use "Save as PDF" in the Print dialog to save the A4 PDF.', 'info');
      return;
    }

    const restoreButton = btn && !wasHidden ? setPdfActionState(btn, true, 'Creating PDF…') : function () {};

    try {
      const result = await createBillPdf(bill);
      result.pdf.save(result.filename);
      VBS.App.showToast('Downloaded ' + result.filename, 'success');
    } catch (err) {
      VBS.App.showToast('Opening print dialog — choose "Save as PDF" to export.', 'info');
      if (wasHidden) {
        openPreview(bill, { backLabel: 'Close Preview', autoPrint: true });
      } else {
        printCurrentBill();
      }
    } finally {
      restoreButton();
    }
  }

  function init() {
    const btnBack = document.getElementById('btn-preview-back');
    const btnPrint = document.getElementById('btn-preview-print');
    const btnPdf = document.getElementById('btn-preview-download-pdf');
    const btnWhatsApp = document.getElementById('btn-preview-share-whatsapp');

    if (btnBack) btnBack.addEventListener('click', closePreview);
    if (btnPrint) btnPrint.addEventListener('click', printCurrentBill);
    if (btnPdf) {
      btnPdf.addEventListener('click', function () {
        downloadBillPdf(null);
      });
    }
    if (btnWhatsApp) btnWhatsApp.addEventListener('click', function (event) { shareBillPdf(null, event.currentTarget); });

    global.addEventListener('resize', updatePreviewScale);

    // Escape closes preview stage if open
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const stage = document.getElementById('print-stage');
        if (stage && !stage.classList.contains('d-none')) {
          closePreview();
        }
      }
    });
  }

  VBS.BillTemplate = {
    init: init,
    renderBillInto: renderBillInto,
    openPreview: openPreview,
    closePreview: closePreview,
    printCurrentBill: printCurrentBill,
    downloadBillPdf: downloadBillPdf,
    shareBillPdf: shareBillPdf
  };
})(window);

