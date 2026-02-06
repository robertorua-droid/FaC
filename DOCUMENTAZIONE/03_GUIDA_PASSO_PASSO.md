# 3. Guida passo‑passo (esercitazioni)

Questa guida propone un percorso “tipo” per una lezione/laboratorio.

## 3.1 Preparazione docente (prima della lezione)
1) Accedi con un utente “docente” (o crea un utente demo).
2) Entra in **Impostazioni → Azienda** e imposta il regime (Ordinario o Forfettario).
3) Carica un set dati base (opzionale) tramite **Gestione Dati → Importa Backup JSON**.
4) Verifica le pagine: anagrafiche, documenti, commesse/progetti, timesheet.

> Suggerimento: conserva 1–2 file di backup “standard” (uno ordinario e uno forfettario) per ripartire rapidamente.

## 3.2 Esercitazione A – Ordinario (IVA + acquisti)
### A1) Setup
- Compila/controlla i dati **Azienda** e periodicità IVA.
- Crea 2–3 **Clienti** e 2–3 **Servizi**.
- Crea 1–2 **Fornitori**.

### A2) Vendite
- Crea una **Fattura** con 2 righe (IVA 22% e/o altre aliquote se previste).
- Imposta pagamento “Bonifico” e termini (data riferimento + giorni).
- Salva ed esporta XML.

### A3) Acquisti
- Crea un **Acquisto** manualmente con 1–2 righe.
- (Opzionale) usa **Importa XML** nel form acquisti per precompilare da file FatturaPA.
- Verifica scadenza (data riferimento + giorni) e stato “Da pagare/Pagata”.

### A4) Scadenziario e Registri IVA
- Vai in **Scadenziario** e verifica: incassi, pagamenti e scadenze IVA.
- Vai in **Registri IVA** e verifica i totali per mese/trimestre.

### A5) Backup
- Esegui **Gestione Dati → Backup dal Cloud** e salva il file (sarà utile come “stato esercitazione”).

## 3.3 Esercitazione B – Forfettario (LM)
### B1) Setup
- Imposta **Forfettario** in Azienda.
- Crea clienti e servizi (IVA verrà forzata a 0 nei documenti).

### B2) Documenti
- Crea 1–2 fatture, marca pagata/da pagare.
- Vai in **Simulazione Fiscale (LM)** e controlla le metriche.

## 3.4 Esercitazione C – Commesse/Progetti/Timesheet
### C1) Commesse e progetti
- Crea una **Commessa** con “Cliente finale” e “Fatturo a”.
- Crea 2 **Progetti** agganciati alla commessa.

### C2) Worklog
- Inserisci worklog su più giorni e su più progetti.
- Marca alcuni worklog come “non fatturabili”.

### C3) Import ore in fattura
- Crea una nuova fattura per lo stesso cliente “Fatturo a”.
- Usa **Importa ore dal timesheet** per generare righe.

### C4) Export CSV
- Vai su **Export Timesheet** e genera il CSV in modalità **Dettaglio**.
- (Opzionale) prova anche **Giorno (progetti in colonne)**.

## 3.5 Fine lezione – ripartenza pulita per la classe successiva
### Opzione 1 (consigliata): Reset totale
- **Gestione Dati → Reset totale dati (Reset classe)**
- Conferma + digita **ELIMINA**

### Opzione 2: Ripristino totale
- **Gestione Dati → Ripristino totale (Reset + Import)**
- Seleziona un backup “standard”
- Conferma + digita **ELIMINA**

> Questa opzione è utile se vuoi ripartire sempre con un dataset identico (esercitazione guidata).
