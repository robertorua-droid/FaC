:root {
    --bg-color: #f8f9fa;
    --card-bg: #ffffff;
    --text-main: #212529;
    --text-muted: #6c757d;
    --sidebar-bg: #2c3e50;
    --sidebar-text: #bdc3c7;
    --sidebar-active: #ffffff;
    --border-color: #dee2e6;
    --input-bg: #ffffff;
    --input-text: #212529;
    --header-bg: #ffffff;
    --shadow-sm: 0 4px 8px rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] {
    --bg-color: #1a252f;
    --card-bg: #2c3e50;
    --text-main: #ecf0f1;
    --text-muted: #bdc3c7;
    --sidebar-bg: #141d26;
    --sidebar-text: #8b97a2;
    --sidebar-active: #ffffff;
    --border-color: rgba(255, 255, 255, 0.1);
    --input-bg: #34495e;
    --input-text: #ecf0f1;
    --header-bg: #2c3e50;
    --shadow-sm: 0 4px 8px rgba(0, 0, 0, 0.4);
}

/* Transizioni globali per cambio tema fluido */
*,
*::before,
*::after {
    transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

/* Scrollbar globale adattiva */
[data-theme="dark"] ::-webkit-scrollbar {
    width: 10px;
}

[data-theme="dark"] ::-webkit-scrollbar-track {
    background: var(--bg-color);
}

[data-theme="dark"] ::-webkit-scrollbar-thumb {
    background: var(--input-bg);
    border: 2px solid var(--bg-color);
    border-radius: 10px;
}

[data-theme="dark"] ::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
}

/* Firefox */
[data-theme="dark"] {
    scrollbar-color: var(--input-bg) var(--bg-color);
}

/* Adattamento componenti Bootstrap al tema scuro */
[data-theme="dark"] .modal-content,
[data-theme="dark"] .card {
    background-color: var(--card-bg);
    color: var(--text-main);
    border-color: var(--border-color);
}

[data-theme="dark"] .form-control,
[data-theme="dark"] .form-select {
    background-color: var(--input-bg);
    color: var(--input-text);
    border-color: var(--border-color);
}

[data-theme="dark"] .form-control:focus,
[data-theme="dark"] .form-select:focus {
    background-color: var(--input-bg);
    color: var(--input-text);
    border-color: #3498db;
    box-shadow: 0 0 0 0.25rem rgba(52, 152, 219, 0.25);
}

[data-theme="dark"] .table {
    color: var(--text-main);
    border-color: var(--border-color);
}

[data-theme="dark"] .table-light {
    background-color: var(--input-bg) !important;
    color: var(--text-main) !important;
}

[data-theme="dark"] .list-group-item {
    background-color: var(--card-bg);
    color: var(--text-main);
    border-color: var(--border-color);
}

[data-theme="dark"] .dropdown-menu {
    background-color: var(--card-bg);
    border-color: var(--border-color);
}

[data-theme="dark"] .dropdown-item {
    color: var(--text-main);
}

[data-theme="dark"] .dropdown-item:hover {
    background-color: var(--bg-color);
    color: white;
}

[data-theme="dark"] .btn-close {
    filter: invert(1) grayscale(100%) brightness(200%);
}

[data-theme="dark"] .form-text,
[data-theme="dark"] .text-muted,
[data-theme="dark"] .small.text-muted,
[data-theme="dark"] #breadcrumb {
    color: var(--text-muted) !important;
}

/* Fix contrasti Form e Input */
[data-theme="dark"] label,
[data-theme="dark"] .form-label,
[data-theme="dark"] h4,
[data-theme="dark"] h5 {
    color: var(--text-main) !important;
}

[data-theme="dark"] .form-control::placeholder {
    color: #a0a0a0 !important;
    opacity: 1;
}

[data-theme="dark"] .form-control::-ms-input-placeholder {
    color: #a0a0a0 !important;
}

[data-theme="dark"] .form-control:-ms-input-placeholder {
    color: #a0a0a0 !important;
}

[data-theme="dark"] .form-control-plaintext {
    color: var(--text-main) !important;
}

/* Override bg-light e bg-white in Dark Mode */
[data-theme="dark"] .bg-light,
[data-theme="dark"] .bg-white {
    background-color: rgba(255, 255, 255, 0.05) !important;
    color: var(--text-main) !important;
}

[data-theme="dark"] .alert-warning {
    background-color: rgba(255, 193, 7, 0.1) !important;
    border-color: rgba(255, 193, 7, 0.2) !important;
    color: #ffc107 !important;
}

[data-theme="dark"] .bg-warning-subtle {
    background-color: rgba(255, 193, 7, 0.05) !important;
    border-color: rgba(255, 193, 7, 0.2) !important;
    color: var(--text-main) !important;
}

/* Fatture: blocco allegato XML da Timesheet in Dark Mode
   Correzione mirata per bg-light-subtle, non coperto dagli override globali. */
[data-theme="dark"] #invoice-timesheet-attachment-options {
    background-color: rgba(52, 152, 219, 0.08) !important;
    color: var(--text-main) !important;
    border-color: rgba(52, 152, 219, 0.28) !important;
}

[data-theme="dark"] #invoice-timesheet-attachment-options .form-check-label,
[data-theme="dark"] #invoice-timesheet-attachment-options .fw-semibold {
    color: var(--text-main) !important;
}

[data-theme="dark"] #invoice-timesheet-attachment-options .text-muted {
    color: var(--text-muted) !important;
}

[data-theme="dark"] #invoice-timesheet-attachment-options .form-check-input:disabled ~ .form-check-label {
    color: rgba(236, 240, 241, 0.62) !important;
}

/* ============================================
   STILE TABELLE UNIFORMATO (GLOBAL + THEMES)
   ============================================ */

.table {
    border-collapse: separate;
    border-spacing: 0;
}

/* Header Tabelle - Stile Comune */
.table thead th {
    text-transform: uppercase;
    font-size: 0.85rem;
    letter-spacing: 0.5px;
    padding: 12px 8px;
    font-weight: bold !important;
}

/* Zebra Striping Globale (Default Light) */
html:not([data-theme="dark"]) .table tbody tr:nth-of-type(even)>td,
html:not([data-theme="dark"]) .table tbody tr:nth-of-type(even)>th {
    background-color: rgba(0, 0, 0, 0.03) !important;
}

/* LIGHT MODE O DEFAULT (Se html non è dark) */
html:not([data-theme="dark"]) .table thead th,
html:not([data-theme="dark"]) .table-light,
html:not([data-theme="dark"]) .table-light th {
    background-color: #e9ecef !important;
    /* Grigio più distinto */
    color: #495057 !important;
    border-bottom: 2px solid #dee2e6 !important;
}

html:not([data-theme="dark"]) .table tfoot tr,
html:not([data-theme="dark"]) .table tr.table-info,
html:not([data-theme="dark"]) .table tr.table-primary,
html:not([data-theme="dark"]) .table tr.table-secondary,
html:not([data-theme="dark"]) .table tr.table-success {
    background-color: #dee2e6 !important;
    color: #212529 !important;
    font-weight: bold !important;
}

/* DARK MODE SPECIFICS */
html[data-theme="dark"] .table {
    --bs-table-bg: transparent;
    --bs-table-color: var(--text-main);
    --bs-table-border-color: var(--border-color);
}

/* Forza Dark Mode su testate (anche se hanno classi table-light nell'HTML) */
html[data-theme="dark"] .table thead th,
html[data-theme="dark"] .table-light,
html[data-theme="dark"] .table-light th,
html[data-theme="dark"] .table-light td {
    background-color: #34495e !important;
    color: #ffffff !important;
    border-bottom: 2px solid var(--border-color) !important;
}

html[data-theme="dark"] .table tr,
html[data-theme="dark"] .table td {
    background-color: transparent !important;
    color: var(--text-main);
    border-color: var(--border-color) !important;
}

html[data-theme="dark"] .table tbody tr:nth-of-type(even) {
    background-color: rgba(255, 255, 255, 0.04) !important;
}

html[data-theme="dark"] .table tbody tr:nth-of-type(odd) {
    background-color: transparent !important;
}

/* Forza Dark Mode su Totali e varianti */
html[data-theme="dark"] .table tfoot tr,
html[data-theme="dark"] .table tr.table-info,
html[data-theme="dark"] .table tr.table-primary,
html[data-theme="dark"] .table tr.table-secondary,
html[data-theme="dark"] .table tr.table-success,
html[data-theme="dark"] .table tfoot td {
    background-color: #2c3e50 !important;
    color: #ffffff !important;
    font-weight: bold !important;
    border-top: 2px solid var(--border-color) !important;
}

html[data-theme="dark"] .table-hover>tbody>tr:hover>* {
    background-color: rgba(255, 255, 255, 0.08) !important;
    color: var(--text-main) !important;
}

html[data-theme="dark"] .table tr.table-warning {
    background-color: rgba(255, 193, 7, 0.2) !important;
    color: #ffc107 !important;
}

/* Fix Calendario */
html[data-theme="dark"] #calendar-widget td,
html[data-theme="dark"] #calendar-widget th {
    border-color: var(--border-color);
    color: var(--text-main);
}

/* Stile generale */
* {
    box-sizing: border-box;
}

body {
    background-color: var(--bg-color);
    color: var(--text-main);
    margin: 0;
    padding: 0;
    transition: background-color 0.3s ease, color 0.3s ease;
}

/* Schermata di Login */
#login-container .card {
    border: none;
    background-color: var(--card-bg);
    color: var(--text-main);
    box-shadow: var(--shadow-sm);
}

/* Layout principale dell'applicazione */
#main-app {
    display: flex;
    min-height: 100vh;
}

/* Sidebar */
.sidebar {
    width: 260px !important;
    min-width: 260px !important;
    max-width: 260px !important;
    background-color: var(--sidebar-bg);
    color: var(--sidebar-active);
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    padding-top: 10px;
    flex-shrink: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: #455d75 var(--sidebar-bg);
    /* Riserva spazio per la scrollbar su Windows preventivamente */
    transition: transform 0.3s ease;
    z-index: 1050;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
}

/* Personalizzazione Scrollbar Sidebar (Chrome, Safari, Edge) */
.sidebar::-webkit-scrollbar {
    width: 6px;
}

.sidebar::-webkit-scrollbar-track {
    background: var(--sidebar-bg);
}

.sidebar::-webkit-scrollbar-thumb {
    background: #455d75;
    border-radius: 10px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
    background: #5d7a96;
}

.sidebar-collapsed .sidebar {
    transform: translateX(-100%);
}

.sidebar-header {
    padding: 15px;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 10px;
}

.sidebar h4 {
    color: #ffffff;
    font-size: 1.1rem;
    margin-bottom: 2px;
}

.sidebar #user-name-sidebar {
    font-size: 0.8rem;
    margin-bottom: 0;
}

.sidebar .nav-link {
    color: #bdc3c7;
    padding: 8px 20px;
    font-size: 0.95rem;
    transition: all 0.2s;
    border-left: 3px solid transparent;
}

.sidebar .nav-link:hover {
    background-color: rgba(255, 255, 255, 0.05);
    color: white;
    border-left-color: rgba(255, 255, 255, 0.3);
}

.sidebar .nav-link.active {
    background-color: #3498db;
    color: white;
    border-left-color: white;
}

/* Sezioni Collassabili */
.nav-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 0.8rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: background-color 0.2s;
}

.nav-section-header:hover {
    background-color: rgba(255, 255, 255, 0.03);
    color: var(--text-main);
}

.nav-section-header i.chevron {
    transition: transform 0.3s;
    font-size: 0.7rem;
}

.sidebar-action-icon {
    font-size: 0.85rem;
    color: #7f8c8d;
    cursor: pointer;
    transition: all 0.2s;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
}

.sidebar-action-icon:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
}

.nav-section-container.collapsed .nav-section-content {
    display: none;
}

.nav-section-container:not(.collapsed) .nav-section-header i.chevron {
    transform: rotate(180deg);
}

.sidebar .nav-item i:not(.chevron) {
    width: 20px;
    margin-right: 10px;
    text-align: center;
}


.sidebar-theme-toggle {
    margin: 0 4px;
    padding: 10px 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
}

.sidebar-theme-toggle .form-check {
    min-height: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.sidebar-theme-toggle .form-check-label {
    color: #d7e3ef;
    display: inline-flex;
    align-items: center;
    font-size: 0.92rem;
    cursor: pointer;
}

.sidebar-theme-toggle .form-check-input {
    float: none;
    margin: 0;
    cursor: pointer;
    background-color: rgba(255,255,255,0.2);
    border-color: rgba(255,255,255,0.25);
}

.sidebar-theme-toggle .form-check-input:checked {
    background-color: #3498db;
    border-color: #3498db;
}

.sidebar-theme-toggle .form-check-input:focus {
    box-shadow: 0 0 0 0.2rem rgba(52, 152, 219, 0.25);
}

#logout-btn {
    color: #dc3545;
}

#logout-btn:hover {
    background-color: #dc3545;
    color: white;
}

/* Hamburger Menu Container */
#top-navbar {
    position: sticky;
    top: 0;
    z-index: 1040;
    background: var(--header-bg);
    padding: 10px 20px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
}

#sidebar-toggle-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--text-main);
    cursor: pointer;
    padding: 5px 10px;
    border-radius: 4px;
    margin-right: 15px;
}

#sidebar-toggle-btn:hover {
    background-color: var(--bg-color);
}

/* Area Contenuto Principale */
.main-content {
    margin-left: 260px;
    padding: 0;
    width: calc(100% - 260px);
    flex: 1;
    min-width: 0;
    transition: margin-left 0.3s ease;
}

.sidebar-collapsed .main-content {
    margin-left: 0;
    width: 100%;
}

.content-wrapper {
    padding: 30px;
}

.content-section {
    background-color: var(--card-bg);
    padding: 25px;
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
}

.content-section h2 {
    margin-bottom: 25px;
    border-bottom: 2px solid #3498db;
    padding-bottom: 10px;
    color: var(--text-main);
}

/* Stili per Markdown Viewer */
.markdown-body {
    line-height: 1.6;
    color: var(--text-main);
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
    margin-top: 1.5rem;
    margin-bottom: 1rem;
    color: var(--text-main);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 10px;
}

[data-theme="dark"] .markdown-body code {
    background-color: rgba(255, 255, 255, 0.1);
    color: #e6edf3;
    padding: 2px 4px;
    border-radius: 3px;
}

[data-theme="dark"] .markdown-body blockquote {
    background-color: rgba(255, 255, 255, 0.05);
    border-left: 4px solid #3498db;
    padding: 10px 15px;
    color: var(--text-muted);
}

.markdown-body blockquote {
    border-left: 4px solid #3498db;
    padding-left: 15px;
    color: #7f8c8d;
    font-style: italic;
}

/* Classe di utilit� per allineare i numeri a destra */
.text-end-numbers {
    text-align: right;
}

.col-align-right {
    text-align: right;
}

/* MODIFICATO: Nuove classi per larghezza colonne pi� aggressive */
.col-description {
    width: 35%;
}

.col-customer {
    width: 30%;
}

.col-price {
    width: 220px;
}

/* Aumentato molto */
.col-total {
    width: 220px;
}

/* Aumentato molto */
.col-actions {
    width: 240px;
}


/* Stile per il calendario */
#calendar-widget table {
    width: 100%;
    border-collapse: collapse;
}

#calendar-widget th,
#calendar-widget td {
    text-align: center;
    padding: 8px;
    border: 1px solid #dee2e6;
}

#calendar-widget th {
    background-color: var(--bg-color);
    color: var(--text-main);
}

#calendar-widget .today {
    background-color: #0d6efd;
    color: white;
    font-weight: bold;
    border-radius: 50%;
}


/* Stampa fattura: micro-refactor tipografico */
.invoice-print-table {
    table-layout: fixed;
    width: 100%;
    font-size: 0.96rem;
}

.invoice-print-table th,
.invoice-print-table td {
    vertical-align: top;
    padding-top: 0.45rem;
    padding-bottom: 0.45rem;
}

.invoice-print-table thead th {
    letter-spacing: 0.04em;
}

.invoice-print-table .invoice-line-desc {
    line-height: 1.35;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.invoice-print-table .invoice-col-qty,
.invoice-print-table .invoice-col-price,
.invoice-print-table .invoice-col-total,
.invoice-print-table .invoice-col-vat,
.invoice-print-table .invoice-num {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
}

.invoice-print-table .invoice-money {
    white-space: nowrap;
    display: inline-block;
    min-width: 6.5ch;
}

.invoice-print-table--with-vat .invoice-col-desc { width: 57%; }
.invoice-print-table--with-vat .invoice-col-qty { width: 8%; }
.invoice-print-table--with-vat .invoice-col-price { width: 12%; }
.invoice-print-table--with-vat .invoice-col-vat { width: 9%; }
.invoice-print-table--with-vat .invoice-col-total { width: 14%; }

.invoice-print-table--no-vat .invoice-col-desc { width: 61%; }
.invoice-print-table--no-vat .invoice-col-qty { width: 8%; }
.invoice-print-table--no-vat .invoice-col-price { width: 13%; }
.invoice-print-table--no-vat .invoice-col-total { width: 18%; }

/* Stile per le fatture pagate */
tr.invoice-paid {
    color: var(--text-muted);
    background-color: var(--bg-color) !important;
}

tr.invoice-paid .btn {
    opacity: 0.7;
}

/* Stili per la stampa */
@media print {
    body * {
        visibility: hidden;
    }

    .sidebar,
    .sidebar * {
        display: none !important;
    }

    .main-content {
        margin-left: 0;
        padding: 0;
        width: 100%;
    }

    .modal-body,
    .modal-body * {
        visibility: visible;
    }

    .modal {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        border: none !important;
        box-shadow: none !important;
        overflow: visible !important;
    }

    .modal-dialog {
        max-width: 100% !important;
        margin: 0 !important;
    }

    .modal-content {
        border: none !important;
        box-shadow: none !important;
    }

    .invoice-print-table {
        font-size: 10.5pt;
    }

    .invoice-print-table .invoice-line-desc {
        padding-right: 0.75rem;
    }

    .modal-header,
    .modal-footer {
        display: none !important;
    }

    .no-print {
        display: none !important;
    }
}

/* ============================================
   COLORI RIGHE ELENCO DOCUMENTI (ADATTIVI)
   ============================================ */

/* Tipo documento: Fattura */
#invoices-table-body tr:has(> td:first-child .badge.bg-primary) {
    background-color: rgba(227, 242, 253, 0.1);
}

[data-theme="light"] #invoices-table-body tr:has(> td:first-child .badge.bg-primary) {
    background-color: #e3f2fd;
}

/* Tipo documento: Nota di Credito */
#invoices-table-body tr:has(> td:first-child .badge.bg-warning.border.border-dark) {
    background-color: rgba(255, 243, 205, 0.1);
}

[data-theme="light"] #invoices-table-body tr:has(> td:first-child .badge.bg-warning.border.border-dark) {
    background-color: #fff3cd;
}

/* Stato: Pagata (bordo verde) */
#invoices-table-body tr:has(> td:nth-child(7) .badge.bg-success) {
    border-left: 4px solid #198754;
}

/* Stato: Da Incassare (bordo giallo) */
#invoices-table-body tr:has(> td:nth-child(7) .badge.bg-warning) {
    border-left: 4px solid #ffc107;
}

/* Stato: Emessa (bordo azzurro) */
#invoices-table-body tr:has(> td:nth-child(7) .badge.bg-info) {
    border-left: 4px solid #0dcaf0;
}

/* Stato: Bozza (bordo grigio) */
#invoices-table-body tr:has(> td:nth-child(7) .badge.bg-secondary) {
    border-left: 4px solid #6c757d;
}
/* ============================================
   COMMESSE: ottimizzazione colonna "Fatturo a"
   - evita wrap eccessivo (ellipsis + tooltip)
   ============================================ */

.table-commesse {
    table-layout: fixed;
}

/* Lascia più spazio a "Fatturo a" (nomi lunghi) */
.table-commesse th:nth-child(2) { /* Nome */
    width: 32%;
}

.table-commesse th:nth-child(3) { /* Fatturo a */
    width: 46%;
}

.table-commesse td:nth-child(2),
.table-commesse td:nth-child(3) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}


/* Dark-mode: migliora contrasto bottoni outline */
[data-theme="dark"] .btn-outline-secondary,
[data-theme="dark"] .btn-outline-dark {
    color: var(--text-main);
    border-color: var(--text-muted);
}

[data-theme="dark"] .btn-outline-secondary:hover,
[data-theme="dark"] .btn-outline-dark:hover {
    color: var(--text-main);
    background-color: rgba(236, 240, 241, 0.12);
    border-color: var(--text-main);
}

/* In dark mode, i bottoni .btn-dark possono risultare poco visibili su sfondo scuro */
[data-theme="dark"] .btn-dark {
    color: var(--text-main);
    background-color: rgba(236, 240, 241, 0.12);
    border-color: var(--text-muted);
}
[data-theme="dark"] .btn-dark:hover {
    background-color: rgba(236, 240, 241, 0.18);
    border-color: var(--text-main);
}

/* Home: Google Calendar incorporato */
#google-calendar-frame {
    width: 100%;
    min-height: 620px;
    border: 0;
}

.google-calendar-card .card-footer {
    background-color: var(--card-bg, #fff);
}

html[data-theme="dark"] .google-calendar-card .card-footer {
    color: var(--text-muted) !important;
    border-top-color: var(--border-color);
}
