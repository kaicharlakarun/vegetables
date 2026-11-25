# Vegetable Billing Management System

A lightweight, offline-capable web application for a vegetable supply business to create, calculate, store, print, and export cash bills in a traditional Telugu/English ruled paper format matching the original handwritten supply bill pad.

Built with pure **HTML5, CSS3, Vanilla JavaScript, Bootstrap 5, Bootstrap Icons, Google Fonts (`Noto Sans Telugu` & `Inter`), LocalStorage, and jsPDF / browser A4 Print**.

---

## Features

- **Dashboard**: Real-time summary cards (Total Bills, Today's Bills, Today's Sales, Total Billed Amount), recent bills, recent customers, unfinished draft alerts, and quick actions.
- **Fast Bill Creation**:
  - Sequential auto-generated bill numbers (`VS-001`, `VS-002`, ...) that are never reused even if drafts are cancelled or deleted.
  - Three exact item billing types:
    - **KG Based**: `Amount = KG × Rate` (supports decimals such as `0.5`, `1.25`, `2.75`)
    - **Quantity Based**: `Amount = Quantity × Rate` with optional unit (`Bags`, `Bundles`, `Pieces`, `No`, etc.)
    - **Direct Amount**: Direct rupee amount only (no KG, quantity, or rate fields)
  - Instant integer-paise decimal-safe calculations with zero floating-point errors.
  - Inline editable table, item type switcher modal, quick-pick chips, keyboard `Enter` navigation, and clear draft vs. finalized validation.
- **Traditional Printable Bill Design (A4 Portrait)**:
  - Faithful reproduction of the original Telugu supply cash bill (`క్యాష్ బిల్లు`):
    - Double rectangular border frame
    - Top bar with Bill Number, Bill Title (`క్యాష్ బిల్లు`), and dotted Date (`తేది`)
    - Business name, proprietor, phone numbers, and address (all editable in Settings)
    - Customer `శ్రీ` dotted lines
    - 5-column ruled black table (`నెం.`, `వివరములు`, `కేజీలు`, `రేటు`, `మొత్తం` with `రూ॥ / పై॥` sub-header)
    - Minimum 15 pre-numbered rows (`01.`–`15.`) with graceful multi-page pagination for larger bills
    - Bottom `మొత్తం` total row and `సంతకం` signature area
  - Clean separation between the modern green dashboard UI and the black-and-white traditional printed paper bill.
- **Print & PDF Export**:
  - Native A4 portrait browser print (`window.print()`) with dedicated `@media print` rules that hide all dashboard UI elements.
  - Direct PDF download via `jsPDF` + `html2canvas` (with automatic native Save-as-PDF fallback when offline).
- **WhatsApp Sharing**:
  - Generate and share the exact A4 bill PDF from the composer or preview screen. On supported mobile browsers, select WhatsApp from the device share sheet to attach and send the file.
  - On browsers without PDF file sharing, the PDF is downloaded so it can be attached in WhatsApp manually.
- **Bill History**:
  - Search by bill number or customer name, filter by exact date, month, year, or status (`Finalized`, `Revised`, `Draft`).
  - View, Print, Download PDF, Duplicate into a new bill, Revise finalized bills (preserving revision history), or Delete with confirmation.
  - Export bills to Excel-compatible UTF-8 CSV.
- **Customer Management**:
  - Add, edit, and search institutional or regular customers (`APTDC`, `School 1`, `School 2`, etc. pre-seeded as editable sample entries).
  - Safe protection: customers linked to saved bills cannot be deleted directly and can be deactivated/reactivated instead.
- **Settings, Backup & Restore**:
  - Edit business details, optional business logo, bill prefix, starting bill number, heading language (`Telugu`, `Bilingual`, `English`), and individual table labels without editing source code.
  - Export full JSON backup, restore from JSON backup with schema validation and confirmation, or export CSV.

---

## How to Run Locally

No Node.js, database, or build step is required.

### Option 1: Open Directly
Double-click `index.html` (or open `index.html` in Google Chrome, Safari, Edge, or Firefox).

### Option 2: Local Static Server (Recommended)
From the `vegetable` project directory:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

---

## Project Structure

```
vegetable/
├── index.html
├── css/
│   ├── style.css
│   ├── dashboard.css
│   ├── billing.css
│   └── print.css
├── js/
│   ├── app.js
│   ├── bill-history.js
│   ├── bill-template.js
│   ├── billing.js
│   ├── calculations.js
│   ├── customers.js
│   ├── dashboard.js
│   ├── settings.js
│   └── storage.js
├── assets/
│   ├── images/
│   └── fonts/
├── README.md
└── .gitignore
```

---

## Data Storage & Backup Notice

All data is stored in your browser's **LocalStorage** under versioned keys:
- `vegetable_billing_customers`
- `vegetable_billing_bills`
- `vegetable_billing_settings`
- `vegetable_billing_counter`

Data stays on the current browser and device and is **not** synchronized across devices automatically. Use **Settings → Export JSON Backup** regularly to keep a safe backup copy.

