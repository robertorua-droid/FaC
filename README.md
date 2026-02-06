# Gestionale Cloud – Professionisti (didattico)

Questo progetto simula la gestione di un professionista e supporta due modalità **gestionali**:

- **Ordinario** (IVA + acquisti/fornitori + registri IVA + simulazione redditi ordinario)
- **Forfettario** (no IVA: semplifica UI e flussi; simulazione quadro LM)

> Il rendering resta centralizzato in `js/ui/ui-render.js` (unico) per ridurre rischio bug.

---

## Documentazione aggiornata
La documentazione completa (manuale utente, guida laboratorio, workflow tecnico, etc.) è in:
- `DOCUMENTAZIONE/00_INDICE.md`

---

## Novità principali (versione stabile)
- **Impostazioni → Uso dati (stima)**: stima dimensione dati su quota 1 GiB (Spark).
- **Impostazioni → Gestione Dati** (ex “Migrazione”): backup JSON completo, import merge, eliminazioni per anno, ripristino totale (reset+import), reset totale “classe”.
- **Acquisti**: import XML FatturaPA fornitore con creazione fornitore su conferma.
- **Export Timesheet CSV**: date `gg/mm/aaaa`, pulizia `\n`, ordine colonne stabile, filtri funzionanti.

---

## Struttura cartelle

- `index.html` – entrypoint UI
- `css/` – stili
- `docs/` – note di step storici (step-by-step)
- `DOCUMENTAZIONE/` – **documentazione aggiornata**
- `js/`
  - `core/`
    - `utils.js` (store in memoria `globalData`, helper numerici/date, inattività)
    - `form-helpers.js` (helper UI: natura/esenzione IVA, ecc.)
  - `services/`
    - `firebase-cloud.js` (load/save/delete su Firestore)
  - `ui/`
    - `ui-render.js` (**unico file UI**: render tabelle, pagine, modali, dashboard)
  - `features/` (moduli per area funzionale, ognuno con `bind()` idempotente)
    - `auth/` – login/logout, `auth.onAuthStateChanged`
    - `navigation/` – sidebar + guard (regime obbligatorio)
    - `company/` – anagrafica azienda + show/hide campi per regime
    - `masterdata/` – clienti/servizi/fornitori
    - `invoices/` – form fattura + elenco + export XML + import ore timesheet
    - `purchases/` – acquisti (solo ordinario) + import XML (modulo separato)
    - `registri-iva/` – totali IVA mensili/trimestrali (solo ordinario)
    - `scadenziario/` – scadenze incassi/pagamenti/IVA (in forfettario solo incassi)
    - `tax/` – simulazioni: quadro LM (forfettario) + ordinario (RE/RN/RR)
    - `notes/`, `migration/` (uso dati + gestione dati)
  - `app/`
    - `invoice-xml-migration.js` (**orchestratore**, mantiene nome storico)
    - `app-bootstrap.js`

---

## Avvio applicazione

1. `app-bootstrap.js` → `initFirebase()` → `bindEventListeners()`
2. `invoice-xml-migration.js` registra i listener chiamando i `bind()` dei moduli.
3. Se l’utente è loggato: `loadAllDataFromCloud()` → `renderAll()`.

---

## Regime fiscale (gestionale) – comportamento UI

In **Azienda** il campo **Regime fiscale (gestionale)** è **obbligatorio**.

### Ordinario
- Menu: visibili **Registri IVA**, **Acquisti**, **Fornitori**, **Simulazione Redditi (Ordinario)**.
- Anagrafica azienda: visibili campi IVA (aliquota, periodicità).

### Forfettario
- Menu: nascosti **Registri IVA**, **Fornitori** e l’intera sezione **Acquisti**.
- IVA: in servizi e in fattura l’IVA è **forzata a 0**.
- Visualizzazione documento: riepilogo IVA nascosto (evita confusione).

---

## Nota tecnica
Ogni modulo feature usa un `bind()` **idempotente** (non registra più volte gli stessi listener).


---

## Step24
- Coerenza regime fiscale: introdotti helper unificati (getResolvedTaxRegime / isForfettario / isOrdinario / hasTaxRegime) e aggiornati i moduli UI/calcolo per usarli.
