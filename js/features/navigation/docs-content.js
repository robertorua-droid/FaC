(function () {
  window.AppDocumentationContent = {
    "00_INDICE": `# Documentazione – Gestionale Cloud (didattico)

Questa cartella raccoglie la documentazione aggiornata della versione **stabile** del progetto.

> Nota: il progetto è didattico. Le simulazioni fiscali e i calcoli sono semplificazioni e non sostituiscono consulenza professionale o adempimenti reali.

## Indice

1) [Panoramica del progetto](./01_PANORAMICA_PROGETTO.md)
2) [Manuale utente](./02_MANUALE_UTENTE.md)
3) [Guida passo‑passo (esercitazioni)](./03_GUIDA_PASSO_PASSO.md)
4) [Gestione Dati (Backup / Import / Reset)](./04_GESTIONE_DATI.md)
5) [Uso dati (stima) – quota Spark](./05_USO_DATI_STIMA.md)
6) [Import XML fattura fornitore (Acquisti)](./06_IMPORT_XML_ACQUISTI.md)
7) [Export Timesheet in CSV](./07_EXPORT_TIMESHEET_CSV.md)
8) [Workflow tecnico per sviluppo/manutenzione](./08_WORKFLOW_TECNICO.md)
9) [FAQ e Troubleshooting](./09_FAQ_TROUBLESHOOTING.md)
10) [Dashboard (Annuale/Mensile)](./10_DASHBOARD.md)
11) [Changelog (principali aggiunte)](./11_CHANGELOG.md)
12) [Guida F24 e dati dichiarativi annuali](./12_GUIDA_F24_FISCALITA.md)
`,

    "01_PANORAMICA_PROGETTO": `# 1. Panoramica del progetto

## Obiettivo didattico
L'applicazione simula la gestione di un professionista con due **regimi gestionali**:

- **Ordinario**: gestione IVA, acquisti/fornitori, registri IVA, simulazione ordinario.
- **Forfettario**: semplificazione (IVA assente/forzata a 0), simulazione quadro LM.

L'app è pensata per esercitazioni: anagrafiche, documenti, scadenze, commesse/progetti, timesheet, backup e ripristini.

## Stack tecnico
- Front-end: **HTML + Bootstrap + jQuery** (single page app).
- Backend: **Firebase**
  - **Authentication** (login)
  - **Cloud Firestore** (dati utente)

> Non usa un backend custom: tutti i dati sono salvati su Firestore sotto l’utente autenticato.

## Dati e struttura Firestore
Dati per utente:

- Path base: \`users/{uid}/...\`
- Impostazioni: \`users/{uid}/settings/*\` (es. \`settings/companyInfo\`)
- Collezioni principali:
  - \`products\` (servizi)
  - \`customers\` (clienti)
  - \`suppliers\` (fornitori)
  - \`invoices\` (fatture + note di credito)
  - \`purchases\` (acquisti)
  - \`notes\` (block-notes)
  - \`commesse\` (collegate a un cliente "Fatturo a"; possono avere **Ore previste** come budget gestionale opzionale)
  - \`projects\` (collegate a una commessa; contengono **codice progetto** e **cliente finale**)
  - \`worklogs\` (timesheet giornaliero; collegabili a una fattura tramite \`invoiceId\`)

## Pagine principali (menu)
- **Home**: dashboard, block-notes e calendario. Il calendario locale può essere sostituito da un Google Calendar incorporato in vista 7 giorni configurando l’URL embed/ID in **Dati Azienda**.
- **Statistiche**: riepiloghi annuali
- **Registri IVA** *(solo Ordinario)*
- **Simulazioni fiscali**: Ordinario / LM
- **Anagrafiche**: Clienti, Fornitori *(solo Ordinario)*, Servizi
- **Documenti**: Nuova Fattura, Nuova Nota Credito, Elenco Documenti
- Le fatture in stato **Bozza** possono essere stampate con filigrana “BOZZA”, utile per distinguere copie non definitive.
- **Acquisti** *(solo Ordinario)*: Nuovo Acquisto, Elenco Acquisti
- **Scadenziario**: incassi, pagamenti, scadenze IVA
- **Commesse / Progetti / Timesheet** con export CSV/JSON integrato nella pagina Timesheet
- **Impostazioni**: Azienda, Uso dati (stima), Gestione Dati

## Regime gestionale: effetto sulle funzionalità
Il regime viene scelto in **Impostazioni → Azienda**.

### Ordinario
- Abilita: Fornitori, Acquisti, Registri IVA, simulazione ordinario.
- L’IVA è gestita in righe documenti, riepiloghi e registri.

### Forfettario
- Nasconde/Disabilita: Fornitori e Acquisti, Registri IVA.
- L’IVA viene forzata a 0 nei flussi per evitare errori.
- Abilita: simulazione quadro LM.

## Concetti chiave per l’uso didattico
- **Timesheet**: è salvato come \`worklogs\` (giorno/commessa/progetto/minuti) e viene esportato in CSV/JSON dalla pagina Timesheet.
- **Import ore in fattura**: dal timesheet puoi generare righe fattura. Il sistema gestisce un **binding sicuro**: i worklog vengono marcati come "fatturati" solo al salvataggio definitivo della fattura, garantendo coerenza in caso di annullamento o modifiche del form.
- **Gestione Dati**: backup, import, cancellazioni per anno, reset totale per “passaggio classe”.
- **Uso dati (stima)**: utile per parlare di quote/limiti (stima su 1 GiB Spark).

### Nota fiscale UI
I campi percentuali fiscali dell’anagrafica azienda supportano valori decimali, utili per aliquote contributive come \`26.07\`. La normalizzazione numerica accetta anche la virgola italiana nei calcoli.
`,

    "02_MANUALE_UTENTE": `# 2. Manuale utente

Questo manuale descrive l’uso quotidiano del gestionale, con particolare attenzione a:
- configurazione iniziale dell’**anagrafica azienda**
- differenze operative tra **Ordinario** e **Forfettario**
- ciclo completo **commesse → progetti → timesheet → fattura**
- uso corretto di documenti, acquisti, scadenziario e gestione dati

---

## 2.1 Accesso e primo avvio
1) Apri l’app da hosting statico o da server locale.
2) Effettua il login.
   - Se hai dimenticato la password, usa **Password dimenticata?** nella schermata di accesso: inserendo l'email, Firebase invia il link per reimpostarla.
   - Il messaggio di conferma è volutamente neutro e non indica se l'indirizzo è registrato.
3) Al primo accesso entra in **Impostazioni → Azienda**.
4) Compila l’anagrafica in modo completo.
5) Imposta il **Regime fiscale (gestionale)**.
6) Salva.

> Finché l’anagrafica azienda non è stata impostata in modo coerente, alcune sezioni possono restare limitate o comportarsi in modo incompleto.

---

## 2.2 Impostazioni → Azienda
Questa è la pagina più importante del progetto. Da qui dipendono:
- comportamento del gestionale
- visibilità di alcune sezioni
- calcoli IVA e fiscali
- generazione XML
- dati mostrati in stampa e dettaglio documento

### 2.2.1 Cosa conviene compilare sempre
Compila con attenzione almeno questi gruppi di dati:

#### A. Dati identificativi dello studio/azienda
- denominazione / ragione sociale
- nome e cognome, se lavori come persona fisica
- partita IVA
- codice fiscale
- indirizzo
- CAP
- comune
- provincia
- nazione

Questi dati vengono usati in più punti:
- intestazioni documento
- stampa PDF
- export XML
- validazione formale

#### B. Regime fiscale gestionale
Campo chiave del progetto.

Puoi scegliere tra:
- **Ordinario**
- **Forfettario**

Il regime gestionale determina il comportamento dell’app:

**Ordinario**
- abilita gestione IVA
- abilita fornitori e acquisti
- abilita registri IVA
- abilita scadenze IVA nello scadenziario
- abilita simulazione ordinaria

**Forfettario**
- semplifica la UI
- disattiva acquisti/fornitori/registri IVA
- forza IVA = 0 nelle fatture
- abilita simulazione quadro LM
- mantiene il focus su incassi, compensi e simulazione forfettaria

> Se il dato \`taxRegime\` non è valorizzato, il sistema prova a risolvere il comportamento anche da \`codiceRegimeFiscale\`, ma è sempre meglio compilare esplicitamente il regime gestionale.

#### C. Dati bancari
Compila almeno il conto principale:
- nome banca
- IBAN

Se usi più conti, puoi compilare anche il conto secondario.

Questi dati servono per:
- dettaglio fattura
- esportazione XML
- controlli formali sui pagamenti

#### D. Parametri IVA e fiscali
In **Ordinario** compila in modo coerente:
- aliquota IVA predefinita
- periodicità IVA (mensile/trimestrale)
- eventuali parametri contributivi e previdenziali richiesti dal tuo scenario didattico

In **Forfettario** verifica invece:
- codice regime fiscale corretto
- eventuali aliquote contributive / parametri usati dalla simulazione

### 2.2.2 Buone pratiche per la compilazione
- salva l’anagrafica azienda **prima** di creare documenti
- compila sempre indirizzo, CAP, comune e provincia
- compila sempre almeno un IBAN valido se usi pagamenti bancari
- ricontrolla il regime prima di iniziare un’esercitazione

### 2.2.3 Preferenze App
Nella pagina Azienda trovi anche le **Preferenze App**, tra cui il tema.

In più, nella sidebar è presente un toggle rapido **Dark mode** per passare velocemente tra chiaro e scuro. Il cambio tema aggiorna anche la sidebar/menu di navigazione, oltre alla finestra principale.

### 2.2.4 Google Calendar in Home
Il campo opzionale **Google Calendar Home** permette di sostituire il calendario locale della Home con un calendario Google incorporato in vista **7 giorni**.

Puoi inserire:
- l'URL embed copiato da Google Calendar
- oppure direttamente l'ID del calendario

Il calendario deve essere pubblico oppure condiviso con l'utente che apre l'app. Se il campo resta vuoto o l'URL non è valido, la Home continua a mostrare il calendario locale precedente.

---

## 2.3 Anagrafiche
Le anagrafiche sono la base dei documenti e dei flussi timesheet/fatturazione.

### 2.3.1 Clienti
Menu: **Anagrafiche → Clienti**

Per ogni cliente puoi inserire:
- ragione sociale oppure nome/cognome
- partita IVA e/o codice fiscale
- indirizzo completo
- codice destinatario / PEC
- condizioni di pagamento
- opzioni fiscali e contributive legate al cliente

#### Opzioni importanti in anagrafica cliente
- **Rivalsa INPS**
- **Scorporo Rivalsa**
- **Sostituto d’imposta**
- **Bollo a carico studio**

Questi flag incidono direttamente su:
- calcolo fattura
- totale documento
- XML
- riepiloghi in dettaglio

#### Solo Forfettario: prefisso import timesheet
Puoi impostare un testo da usare come prefisso nelle righe importate dal timesheet in fattura.

Esempio:
- “Attività di docenza”
- “Prestazione professionale”
- “Supporto progettuale”

Se lasci il campo vuoto, l’import non aggiunge alcun prefisso fisso.

### 2.3.2 Servizi
Menu: **Anagrafiche → Servizi**

Qui definisci il catalogo base delle prestazioni:
- codice
- descrizione
- prezzo
- IVA
- eventuali attributi usati nei flussi progetto/fattura

In **Forfettario**, l’IVA proposta dal servizio non prevale sul comportamento del regime: nel documento l’IVA viene comunque gestita come zero.

### 2.3.3 Fornitori
Menu: **Anagrafiche → Fornitori**

Disponibile solo in **Ordinario**.

Serve per:
- acquisti manuali
- import XML acquisti
- scadenziario pagamenti
- analisi e registri IVA

---

## 2.4 Fatture di vendita
Menu: **Fatture di Vendita**

### 2.4.1 Nuova fattura
Crea una nuova fattura selezionando:
- cliente
- data documento
- numero
- metodo di pagamento
- eventuale banca/conto

Poi aggiungi le righe documento.

Ogni riga può includere:
- descrizione
- quantità
- prezzo
- aliquota IVA / natura
- subtotal calcolato

### 2.4.2 Nuova nota di credito
La nota di credito funziona come un documento collegato a un’operazione precedente.

Compila con attenzione:
- tipo documento
- causale
- riferimento alla fattura collegata
- data e numero del documento collegato, se richiesti dal tuo flusso

Il sistema usa questi dati anche nella costruzione dell’XML.

### 2.4.3 Ricalcolo totali
Il gestionale ricalcola i totali in base a:
- righe documento
- regime fiscale
- impostazioni cliente
- bollo
- rivalsa
- ritenuta
- scorporo

In **Forfettario**:
- IVA = 0
- viene usata la natura prevista
- il bollo può essere inserito automaticamente sopra soglia

### 2.4.4 Elenco documenti
Menu: **Fatture di Vendita → Elenco Documenti**

Da qui puoi:
- filtrare per anno
- aprire il dettaglio
- modificare
- eliminare
- marcare come pagata
- marcare come inviata
- esportare il singolo XML dal dettaglio o dalle azioni disponibili

Gli export massivi sono raccolti nella voce separata **Fatture di Vendita → Esportazioni Documenti**, visibile in questo step solo in regime Forfettario. In questo modo l’elenco operativo resta dedicato alla gestione dei documenti. La pagina export mostra solo i comandi operativi necessari, senza badge tecnici di step.

### 2.4.5 Export massivo XML forfettario
Menu: **Fatture di Vendita → Esportazioni Documenti**

Nel pannello **Export massivo XML** puoi selezionare un intervallo **Da / A** e scegliere se includere fatture e/o note di credito. Il periodo viene precompilato automaticamente quando disponibile, ma resta modificabile manualmente.

La funzione è disponibile in questo step solo in regime **Forfettario**. Ogni documento esportabile viene scaricato come file XML separato, senza generare uno ZIP.

Regole operative:
- vengono considerati i documenti con data compresa nell’intervallo selezionato;
- le bozze non vengono esportate;
- i documenti con dati mancanti o non validi per l’XML vengono saltati;
- al termine viene mostrato un riepilogo dei file scaricati e degli eventuali documenti saltati;
- l’export non modifica stato documento, dati salvati, Timesheet o calcoli fiscali.

Per periodi con molti documenti, il browser potrebbe chiedere conferma per consentire download multipli.

### 2.4.6 PDF unico documenti emessi forfettario
Menu: **Fatture di Vendita → Esportazioni Documenti**

Nel pannello **PDF unico documenti emessi** puoi selezionare un intervallo **Da / A** e scegliere se includere fatture e/o note di credito. Il periodo viene precompilato automaticamente quando disponibile, ma resta modificabile manualmente.

La funzione è disponibile in questo step solo in regime **Forfettario**. Il gestionale prepara un fascicolo unico stampabile con una copertina e un documento per pagina. Per ottenere il file devi usare la finestra di stampa del browser e scegliere **Salva come PDF**.

Regole operative:
- vengono considerati i documenti con data compresa nell’intervallo selezionato;
- le bozze non vengono incluse nel fascicolo dei documenti emessi;
- ogni documento usa una resa di stampa coerente con il dettaglio fattura;
- il PDF finale è un unico file prodotto dal browser, non una raccolta ZIP e non una serie di download separati;
- la funzione non modifica stato documento, dati salvati, Timesheet, XML o calcoli fiscali.

### 2.4.7 Dettaglio documento
Nel dettaglio fattura trovi:
- riepilogo cliente
- riepilogo documento
- righe
- totali
- pulsante stampa
- menu **XML**

Il menu **XML** contiene:
- **Genera XML**
- **Copia XML**
- **Apri FatturaCheck**
- **Apri FEX**
- **Apri Agenzia Entrate**

> I siti di validazione esterni si aprono in una nuova tab e non ricevono automaticamente il file. Il caricamento o l’incolla dell’XML resta sempre sotto il controllo dell’utente.

---

## 2.5 Fatture di acquisto
Menu: **Fatture di Acquisto**

Disponibile solo in **Ordinario**.

### 2.5.1 Nuovo acquisto
Compila:
- fornitore
- numero documento
- data documento
- data riferimento pagamento
- giorni termine
- eventuale data scadenza
- righe acquisto

Il sistema usa questi dati per:
- totale acquisto
- scadenziario pagamenti
- analisi
- registri IVA

### 2.5.2 Import XML acquisti
Nel form **Nuovo Acquisto** puoi importare un XML ricevuto dal fornitore.

Il sistema prova a precompilare:
- testata documento
- fornitore
- righe
- dati di scadenza, se presenti

Se il fornitore non esiste, viene proposta la creazione in anagrafica.

---

## 2.6 Scadenziario
Menu: **Analisi → Scadenziario**

Lo scadenziario raccoglie eventi di natura diversa:
- incassi fatture
- pagamenti acquisti
- scadenze IVA

### In Ordinario
Puoi vedere:
- incassi
- pagamenti acquisti
- scadenze IVA

### In Forfettario
Restano soprattutto:
- incassi delle fatture

Lo scadenziario è utile per simulare il comportamento operativo di un piccolo studio professionale.

---

## 2.7 Commesse, progetti e timesheet
Questa è una delle parti più importanti del progetto perché collega l’operatività quotidiana alla fatturazione.

## 2.7.1 Logica generale
Il flusso corretto è questo:

1. **Cliente**
2. **Commessa**
3. **Progetto**
4. **Worklog / Timesheet**
5. **Import ore in fattura**

### Cliente
È il soggetto a cui emetterai il documento.

### Commessa
La commessa rappresenta il contenitore principale del lavoro commissionato da un cliente.

In pratica la commessa risponde alla domanda:
**“Per quale incarico sto lavorando e a chi fatturo?”**

### Progetto
Il progetto è un sotto-livello della commessa.

Serve per suddividere il lavoro in attività più specifiche.

In pratica il progetto risponde alla domanda:
**“Su quale attività concreta sto lavorando dentro questa commessa?”**

### Worklog / Timesheet
Il worklog è la registrazione puntuale del lavoro svolto:
- data
- commessa
- progetto
- durata
- note
- fatturabilità

### Import in fattura
Le ore registrate nel timesheet possono diventare righe fattura, mantenendo il legame logico con il lavoro svolto.

---

## 2.7.2 Commesse
Menu: **Commesse → Commesse**

Per ogni commessa definisci almeno:
- nome/descrizione
- cliente “Fatturo a”
- stato

Quando salvi una commessa esistente cambiandone lo stato da **Attiva** a **Chiusa**, l’app verifica se ci sono progetti collegati ancora attivi. In quel caso chiede se vuoi archiviarli automaticamente: scegliendo **Sì** i progetti collegati vengono impostati come **archiviati**, scegliendo **No** restano invariati.

La commessa è il livello giusto per rappresentare un incarico, un contratto o una linea di lavoro verso un cliente.

### Esempio
Cliente: **Alfa Srl**
Commessa: **Supporto consulenziale 2025**

All’interno della stessa commessa puoi poi avere più progetti.

---

## 2.7.3 Progetti
Menu: **Commesse → Progetti**

Ogni progetto è collegato a una commessa.

Campi importanti:
- **Codice progetto**
- **Cliente finale**
- **Servizio predefinito**
- **Tariffa**
- tipo **Lavoro / Costo**

### Cliente finale: a cosa serve
È utile quando lavori per un cliente che ti commissiona attività verso un destinatario finale diverso.

Esempio:
- Fatturo a: **Società Beta**
- Cliente finale: **Comune di Gamma**

Così puoi distinguere:
- chi riceve la fattura
- per chi è stata effettivamente svolta l’attività

### Servizio e tariffa del progetto
Se associ un servizio al progetto, il sistema può proporre in automatico:
- descrizione coerente
- tariffa coerente
- tipo di attività

Questo aiuta molto nei flussi timesheet → fattura.

---

## 2.7.4 Timesheet
Menu: **Commesse → Timesheet**

Qui registri il lavoro svolto giorno per giorno.

Ogni worklog può contenere:
- data
- commessa
- progetto
- minuti / ore
- minuti / ore cliente finale, se previsti
- numero **Ticket** opzionale collegato all’intervento
- flag fatturabile
- note

### Buone pratiche
- usa sempre commessa e progetto coerenti
- indica il numero ticket quando l’intervento fa riferimento a una richiesta tracciata
- descrivi le attività nelle note in modo chiaro
- marca come non fatturabili le attività interne o escluse dalla rendicontazione

### Modifica worklog
Puoi riaprire un worklog già salvato e modificarlo.

Se il worklog è già stato importato in fattura, conviene verificare con attenzione il suo stato prima di intervenire.

---

## 2.7.5 Import ore dal timesheet in fattura
Nel form fattura puoi usare l’import ore dal timesheet.

Il flusso corretto è:
1. selezioni cliente / documento
2. apri import timesheet
3. filtri il periodo
4. selezioni commessa/progetto, se necessario
5. il sistema costruisce righe fattura
6. salvi il documento

### Cosa fa il sistema
- genera righe documento dalle ore selezionate
- tiene traccia dei worklog collegati
- evita, per quanto possibile, doppie fatturazioni accidentali
- in fase di salvataggio collega i worklog alla fattura

### Cosa controllare sempre
- descrizione riga generata
- quantità/ore
- tariffa applicata
- cliente corretto
- eventuale prefisso forfettario

### Se elimini o modifichi
In base al flusso:
- rimuovere righe importate
- modificare la fattura
- eliminare la fattura

può influire sul legame con i worklog importati.

Per questo conviene fare attenzione soprattutto nelle esercitazioni dove si prova più volte lo stesso scenario.

---

## 2.8 Export Timesheet CSV
Percorso: **Commesse → Timesheet**, card filtri, dropdown **Esporta**

Puoi esportare i worklog con diversi filtri e formati. L’export include anche i campi **Ticket** e **Note**, così da mantenere nel CSV il riferimento alla richiesta e il dettaglio operativo dell’intervento.

Utilissimo per:
- esercitazioni
- rendicontazioni
- confronti tra ore registrate e ore fatturate

Formati disponibili:
- dettaglio
- raggruppamento per progetto
- raggruppamento per commessa
- pivot per giorno/progetto

---

## 2.9 Dashboard e statistiche
Menu: **Analisi → Dashboard** / **Statistiche**

Queste pagine aiutano a leggere i dati gestionali del periodo:
- ore lavorate
- ore fatturabili
- fatturato
- andamento per periodo
- top progetti / commesse

Usale per confrontare:
- attività svolta
- documenti emessi
- sostenibilità del carico di lavoro

---

## 2.10 Simulazioni fiscali
Menu: **Fiscalità**

### Ordinario
Disponibile in regime ordinario.

Serve per simulare il comportamento del professionista con IVA, costi e logica fiscale ordinaria.

### LM + RR/PXX / Forfettario
Disponibile in regime forfettario.

Serve per stimare il comportamento del reddito forfettario, dell’imposta sostitutiva e dei contributi previdenziali RR/PXX.

Nei dati azienda i campi percentuali fiscali supportano valori decimali. Per esempio, nel campo **INPS %** del forfettario è possibile indicare \`26.07\`; i calcoli accettano anche la virgola italiana (\`26,07\`) normalizzandola internamente.

#### Dati dichiarativi annuali
Dal ramo **V.13.20** la pagina Fiscalità distingue tra:
- **parametri globali** dell’azienda, come regime fiscale, codice RF, coefficiente di redditività, aliquota sostitutiva, aliquota INPS e rivalsa;
- **dati dichiarativi annuali**, cioè versamenti, acconti, crediti e saldi F24 forniti dal commercialista.

I dati dichiarativi si inseriscono direttamente nella pagina **Fiscalità**, dopo aver selezionato un anno specifico nel campo **Anno**. Non vengono più inseriti nella scheda Azienda perché non sono valori globali. I vecchi campi globali di versamenti/acconti, se presenti in backup precedenti, non vengono usati come fonte automatica dei nuovi calcoli annuali: vanno reinseriti una volta nell’anno corretto.

Per ogni anno redditi puoi compilare:
- **LM / Imposta sostitutiva**: contributi LM35 deducibili versati, acconti imposta già versati, crediti/compensazioni e saldo F24 1792 per confronto;
- **Quadro RR / INPS-PXX**: contributi/PXX già versati per l’anno, saldo F24 PXX e acconti PXX dell’anno successivo;
- **Acconti anno successivo**: 1790, 1791 e rate PXX indicate dal commercialista.

Esempio: se stai visualizzando il **2025**, il gestionale salva i saldi del 2025 sull’anno 2025 e gli acconti del 2026 sull’anno 2026. In questo modo, se poi apri il 2024 o il 2026, non vengono riutilizzati per errore dati di un altro anno.

Dal pulsante **Help compilazione F24** puoi aprire una guida rapida direttamente nella pagina Fiscalità. La guida spiega come leggere:
- codici **1790**, **1791** e **1792** della sezione Erario;
- causale **PXX** nella sezione INPS;
- periodo di riferimento PXX per capire se il dato è saldo dell’anno redditi o acconto dell’anno successivo.

Per una guida più completa consulta anche **Documentazione → Guida F24 e dati dichiarativi annuali**.

#### Riquadro Versamenti stimati FAC
Dal ramo **V.13.20_step 03** la pagina Fiscalità mostra anche il riquadro **Versamenti stimati FAC**.

Il riquadro serve come riepilogo operativo rapido e mostra:
- saldo imposta sostitutiva dell’anno selezionato;
- saldo **Quadro RR/PXX** dell’anno selezionato;
- acconti imposta dell’anno successivo;
- acconti **RR/PXX** dell’anno successivo;
- scadenze tipiche riepilogative, normalmente 30/06 e 30/11 dell’anno successivo.

Se hai inserito valori F24/manuali nei dati dichiarativi annuali, il riquadro li usa e li segnala come **F24 inserito**. Se non hai inserito valori manuali, mostra la **stima FAC**.

#### Riporto assistito degli acconti F24
Dal ramo **V.13.20_step 04**, quando apri un anno che contiene acconti F24 già registrati dall’anno precedente, FAC mostra un riquadro di suggerimento.

Esempio operativo:
- visualizzando il **2025**, inserisci gli acconti 2026 ricevuti dal commercialista: **1790**, **1791** e rate **PXX**;
- questi importi vengono salvati sull’anno **2026**;
- quando in futuro apri la Fiscalità **2026**, FAC ti propone di copiarli nei campi “già versati” del 2026.

Il riporto non è automatico. Devi premere esplicitamente:
- **Usa per acconti imposta 2026**, per copiare 1790 + 1791 nel campo **Acconti imposta già versati**;
- **Usa per contributi RR/PXX 2026**, per copiare le rate PXX nel campo **Contributi RR/PXX già versati per l’anno**.

Dopo il click devi premere **Salva e ricalcola**. Questa scelta evita applicazioni nascoste e riduce il rischio di doppio conteggio se il commercialista fornisce rettifiche o valori aggiornati.

> Le simulazioni sono strumenti didattici: vanno interpretate come supporto allo studio, non come consulenza fiscale ufficiale.

---

## 2.11 Gestione dati
Menu: **Impostazioni → Gestione Dati**

Da qui puoi:
- fare backup JSON
- importare un backup
- eliminare documenti per anno
- eliminare acquisti per anno
- fare reset totale
- ripristinare un dataset standard

Questa sezione è molto utile in laboratorio, quando vuoi:
- preparare una classe
- ripartire da uno stato pulito
- distribuire uno scenario già pronto

---

## 2.12 Suggerimento operativo per l’uso corretto
Per lavorare bene col progetto, l’ordine consigliato è:

1. **Compila Azienda**
2. **Configura il regime**
3. **Crea Clienti e Servizi**
4. **Crea Commesse**
5. **Crea Progetti**
6. **Inserisci Timesheet**
7. **Importa ore in fattura** oppure crea documenti manuali
8. **Esporta PDF/XML**
9. **Controlla Scadenziario e Simulazioni**
10. **Fai Backup**

Questo ordine riduce errori e rende più chiaro il legame tra i moduli.


## Allegato XML da Timesheet

Nel form fattura, sotto i pulsanti di importazione ore dal Timesheet, puoi attivare l'opzione **Allega il dettaglio non aggregato del timesheet all'XML della fattura (PDF)**.

Quando è attiva, il gestionale genera durante l'export XML un allegato PDF con il dettaglio dei worklog collegati alla fattura. Puoi anche scegliere se **includere le note operative** del timesheet. L'allegato è solo descrittivo e non modifica i totali fiscali della fattura.


### Export Timesheet JSON
Il dropdown **Esporta** nella pagina Timesheet permette di scaricare sia **CSV** sia **JSON**. Il JSON usa gli stessi filtri e raggruppamenti del CSV e mantiene Ticket e Note.


### Commesse: ore previste e residue
Le commesse possono avere un campo opzionale **Ore previste**. La tabella calcola a video **Ore caricate** dal Timesheet e **Ore residue**. Il calcolo non modifica Timesheet, fatture o import ore in fattura.

### Stampa delle fatture in bozza

Se una fattura è salvata con stato **Bozza**, la stampa dal dettaglio documento mostra una filigrana **BOZZA**. La filigrana serve a distinguere chiaramente le stampe non definitive e non modifica XML, importi, stato documento o dati salvati.
`,

    "03_GUIDA_PASSO_PASSO": `# 3. Guida passo‑passo (esercitazioni)

Questa guida propone un percorso pratico per usare il progetto in aula o in autoapprendimento.

---

## 3.1 Percorso consigliato di avvio
Prima di iniziare un’esercitazione completa, esegui questo setup minimo:

1. Accedi all’app.
2. Vai in **Impostazioni → Azienda**.
3. Compila l’anagrafica completa.
4. Scegli il **Regime fiscale (gestionale)**.
5. Inserisci almeno un **IBAN**.
6. Crea almeno:
   - 1 cliente
   - 1 servizio
   - 1 commessa
   - 1 progetto

> Se l’anagrafica azienda non è completa, stampa PDF ed export XML possono risultare incompleti o bloccati dai controlli formali.

---

## 3.2 Esercitazione A — Ciclo minimo fattura
### Obiettivo
Capire il flusso base documento → dettaglio → PDF → XML.

### Passaggi
1. Crea un cliente.
2. Crea un servizio.
3. Vai su **Fatture di Vendita → Nuova Fattura**.
4. Inserisci cliente, numero, data, pagamento.
5. Aggiungi una riga servizio.
6. Salva.
7. Apri il dettaglio documento.
8. Prova:
   - **Stampa**
   - menu **XML → Genera XML**
   - menu **XML → Copia XML**
   - menu **XML → Apri FatturaCheck / FEX / Agenzia Entrate**

### Cosa osservare
- dati anagrafici corretti
- totali corretti
- banca/IBAN corretti
- XML formalmente valido

---

## 3.3 Esercitazione B — Ordinario
### Obiettivo
Vedere il comportamento di un professionista in regime ordinario.

### Passaggi
1. Imposta il regime **Ordinario** in Azienda.
2. Crea 2 clienti, 2 servizi, 1 fornitore.
3. Crea una fattura con IVA.
4. Crea un acquisto con IVA.
5. Vai in:
   - **Scadenziario**
   - **Registri IVA**
   - **Simulazione ordinario**

### Cosa osservare
- scadenze IVA presenti
- fornitori e acquisti disponibili
- riepiloghi IVA attivi
- simulazione fiscale coerente con il regime

---

## 3.4 Esercitazione C — Forfettario
### Obiettivo
Vedere come cambia il gestionale in regime forfettario.

### Passaggi
1. Imposta il regime **Forfettario**.
2. Crea 1–2 clienti e 1–2 servizi.
3. Crea una fattura.
4. Verifica il dettaglio documento.
5. Esporta XML.
6. Vai in **Simulazione LM**.

### Cosa osservare
- IVA a zero
- natura corretta in XML
- acquisti e fornitori non centrali / nascosti
- focus su compensi e simulazione forfettaria
- possibilità di usare percentuali fiscali decimali, ad esempio INPS \`26.07\`

---

## 3.5 Esercitazione D — Commesse, Progetti e Timesheet
### Obiettivo
Capire il modello operativo del gestionale.

### Passaggi
1. Crea un cliente.
2. Crea una **Commessa** associata al cliente.
3. Crea 2 **Progetti** dentro la stessa commessa.
4. Per ogni progetto imposta:
   - codice progetto
   - cliente finale
   - servizio predefinito
   - tariffa
5. Inserisci 3–4 worklog nel **Timesheet**.
6. Marca alcuni worklog come non fatturabili.
7. Crea una nuova fattura.
8. Usa **Importa ore dal timesheet**.
9. Salva la fattura.

### Cosa osservare
- coerenza tra commessa, progetto e worklog
- costruzione delle righe fattura dalle ore
- rapporto tra “Fatturo a” e “Cliente finale”
- stato dei worklog dopo il salvataggio

---

## 3.6 Esercitazione E — Nota di credito
### Obiettivo
Simulare la correzione di una fattura già emessa.

### Passaggi
1. Parti da una fattura già salvata.
2. Crea una **Nuova Nota Credito**.
3. Inserisci causale e riferimento al documento collegato.
4. Salva.
5. Apri il dettaglio.
6. Esporta XML.

### Cosa osservare
- tipo documento corretto
- riferimento documento coerente
- segni e importi corretti
- XML formalmente valido

---

## 3.7 Esercitazione F — Export CSV Timesheet
### Obiettivo
Capire la differenza tra lavoro registrato e fatturazione.

### Passaggi
1. Inserisci worklog su più giorni e progetti.
2. Vai in **Timesheet** e usa il dropdown **Esporta** nella card dei filtri.
3. Prova i filtri per periodo, commessa, progetto e fatturabilità.
4. Esporta:
   - dettaglio
   - per progetto
   - per commessa
   - pivot giorno/progetto

### Cosa osservare
- differenza tra dettaglio e aggregati
- confronto tra ore registrate e ore importate in fattura

---

## 3.8 Fine lezione / ripartenza pulita
### Opzione 1 — Backup
Usa **Gestione Dati → Backup JSON** per salvare lo stato dell’esercitazione.

### Opzione 2 — Reset totale
Usa **Gestione Dati → Reset totale dati** per svuotare l’ambiente.

### Opzione 3 — Ripristino standard
Usa **Ripristino totale (Reset + Import)** per ripartire sempre dallo stesso dataset.

---

## 3.9 Metodo consigliato per il collaudo manuale finale
Quando vuoi verificare che il refactoring non abbia rotto i flussi, prova sempre almeno questi casi:

1. nuova fattura ordinaria
2. nuova fattura forfettaria
3. modifica fattura
4. copia fattura
5. nota di credito
6. PDF
7. XML
8. commessa → progetto → timesheet → import in fattura
9. acquisto ordinario
10. scadenziario

Se tutti questi casi funzionano, il progetto è in uno stato molto solido anche a livello funzionale.
`,

    "04_GESTIONE_DATI": `# 4. Gestione Dati (Backup / Import / Eliminazioni / Reset)

Percorso: **Impostazioni → Gestione Dati**.

Questa pagina contiene operazioni “amministrative” sull’utente corrente (dati su Firestore).

> Tutte le operazioni con etichetta **rosso** sono **irreversibili**.

## 4.1 Backup dal Cloud (utente corrente)
**Scarica Backup JSON** esporta un file \`.json\` con **TUTTI** i dati salvati nel Cloud per l’utente connesso:
- \`companyInfo\` (Azienda)
- \`products\`, \`customers\`, \`suppliers\`
- \`invoices\` (fatture/NC), \`purchases\` (acquisti)
- \`commesse\`, \`projects\`, \`worklogs\` (timesheet)
- \`notes\`

Il file si chiama \`gestionale-backup-YYYY-MM-DD.json\`.

## 4.2 Importa Backup JSON (merge/aggiorna)
**Carica Backup JSON** importa un file creato con “Scarica Backup JSON” e salva i dati nel Cloud dell’utente corrente.

Comportamento:
- aggiorna/crea record con lo **stesso ID**
- **non elimina** record già presenti ma assenti nel backup (import non distruttivo)

Se nel file è presente un \`userId\` diverso dall’utente loggato, viene mostrato un avviso.

Quando usarlo:
- “aggiorno” o “porto avanti” un dataset
- “aggiungo” dati sopra una base già esistente

## 4.3 Elimina Documenti per Anno (utente corrente)
Elimina dal Cloud **Fatture** e **Note di Credito** dell’anno selezionato.

- serve per pulizie parziali (es. “riparto dall’anno nuovo”)
- richiede doppia conferma

Suggerimento: fai prima un **Backup JSON**.

## 4.4 Elimina Acquisti per Anno (utente corrente)
Elimina dal Cloud i **Documenti di acquisto** dell’anno selezionato.

- richiede doppia conferma
- aggiorna automaticamente: elenco acquisti, registri IVA e scadenziario

Suggerimento: fai prima un **Backup JSON**.

## 4.5 Ripristino totale da Backup JSON (Reset + Import)
Operazione “forte” pensata per ripartire da uno stato controllato.

Cosa fa:
1) Cancella **TUTTI** i dati dell’utente corrente
2) Cancella anche **tutti i documenti sotto \`settings/*\`** (incluse impostazioni future)
3) Importa il backup selezionato

Conferma:
- popup di conferma
- richiesta di digitare \`ELIMINA\`

Quando usarlo:
- in laboratorio, per ripartire sempre con lo stesso dataset
- per recuperare uno stato “pulito” dopo test

## 4.6 Reset totale dati (Reset classe)
Cancella **TUTTI** i dati dell’utente corrente dal Cloud:
- anagrafiche (clienti/fornitori/servizi)
- documenti (fatture/NC) e acquisti
- commesse, progetti, worklog/timesheet, note
- **settings** (tutti i doc presenti e futuri)

Conferma:
- popup
- digitazione \`ELIMINA\`

Quando usarlo:
- “classe successiva parte da zero”

## Note tecniche (per chi mantiene il progetto)
- Le cancellazioni avvengono a batch (massimo ~450 doc a batch).
- I dati sono per-utente (\`users/{uid}/...\`).
- L’import salva \`companyInfo\` in \`settings/companyInfo\` e le collezioni principali nelle rispettive collection.

`,

    "05_USO_DATI_STIMA": `# 5. Uso dati (stima) – quota Spark

Percorso: **Impostazioni → Uso dati (stima)**.

## Cosa mostra
La pagina mostra una stima della “dimensione dati” dell’utente, calcolata come:

- dimensione (in byte) della serializzazione **JSON** di ciascuna categoria di dati già caricata dal Cloud
- somma totale confrontata con una quota di riferimento **1 GiB** (piano Firebase gratuito “Spark”)

Categorie principali:
- Azienda (\`companyInfo\`)
- Clienti, Servizi, Fornitori
- Documenti, Acquisti
- Note
- Commesse, Progetti
- Worklog (Timesheet)

## Limiti della stima (importanti)
Questa stima è **indicativa** e serve a scopo didattico:
- non include overhead Firestore (metadati, indici, struttura interna)
- non include eventuale Firebase Storage
- misura solo ciò che l’app ha già caricato in memoria

## Come usarla
- Premi **Ricalcola** per aggiornare tabella e progress bar.
- Se stai facendo molte prove (import massivi, worklog numerosi), è utile per capire quali categorie “pesano” di più.

## Interpretazione rapida
- Sotto il 5–10%: uso molto basso.
- 10–50%: dataset già significativo (utile in laboratorio).
- Oltre 50%: probabilmente molti worklog o molti documenti (verifica e fai pulizia/backup).

`,

    "06_IMPORT_XML_ACQUISTI": `# 6. Import XML fattura fornitore (Acquisti)

Percorso: **Acquisti → Nuovo Acquisto → Importa XML**.

## Obiettivo
Velocizzare l’inserimento di un documento di acquisto partendo da un file **XML FatturaPA** (fattura elettronica ricevuta dal fornitore).

L’import è implementato come modulo separato (\`js/features/purchases/purchase-xml-import-module.js\`) per non alterare la logica core del modulo acquisti.

## Come usare
1) Vai in **Nuovo Acquisto**
2) Clicca **Importa XML**
3) Seleziona un file \`.xml\` (FatturaPA)
4) Verifica i campi precompilati
5) Salva l’acquisto

## Cosa viene compilato
- **Fornitore** (da *CedentePrestatore*)
  - se esiste già in anagrafica viene selezionato
  - se non esiste viene chiesta conferma per crearlo automaticamente
- **Numero** e **Data documento**
- **Termini e scadenza** se presenti (da *DatiPagamento*)
- **Righe documento** (da *DatiBeniServizi/DettaglioLinee*)
- Se presenti:
  - **Cassa previdenziale** (*DatiCassaPrevidenziale*) → aggiunta come riga extra
  - **Ritenuta** (*DatiRitenuta*) e info pagamento (IBAN/istituto) → inserite nelle **Note**

## Fornitore non presente: cosa succede
Se il fornitore dell’XML non è in **Anagrafica Fornitori**, l’app mostra un popup di conferma:
- **OK** → crea il fornitore e prosegue con l’import
- **Annulla** → import annullato (per evitare un acquisto senza fornitore selezionato)

## Limitazioni note (volute)
- L’import prova a mappare IVA e “Natura” in modo robusto, ma è comunque una semplificazione didattica.
- Alcuni dettagli FatturaPA molto specifici (es. sconti complessi, più blocchi pagamento) possono finire solo nelle note o non essere riportati.

## Suggerimento didattico
Usa l’import per far vedere:
- come sono strutturati header/body FatturaPA
- come si trasformano dati “strutturati” (XML) in un modello “gestionale” (testata + righe)
- perché la presenza di un’anagrafica fornitori coerente è utile (matching P.IVA/CF)
`,

    "07_EXPORT_TIMESHEET_CSV": `# 7. Export Timesheet in CSV / JSON

Percorso: **Commesse → Timesheet**, nella card dei filtri usa **Raggruppa export** e il dropdown **Esporta**.

## Obiettivo
Esportare i worklog (timesheet) in CSV, con:
- date in formato italiano **gg/mm/aaaa**
- intestazioni e colonne in ordine stabile
- nessun carattere “\n” sporcante nei campi
- inclusione di **Ticket** e **Note** per rendicontazioni operative

## Filtri disponibili
- **Da / A** (intervallo date)
- **Fatturo a** (cliente in anagrafica collegato alla commessa)
- **Commessa**
- **Progetto**
- **Fatturabile** (SI/NO)
- **Già fatturato** (worklog con invoiceId)

## Formati di esportazione (“Raggruppa per”)
### Dettaglio (default)
- una riga per ogni worklog
- colonne:
  \`Date | EndCustomer | BillToCustomer | Commessa | ProjectCode | Project | Minutes | Hours | FinalMinutes | FinalHours | Billable | Ticket | Note\`

### Giorno (progetti in colonne) – pivot
- una riga per **Giorno + Commessa**
- ogni progetto diventa una colonna con le ore
- aggiunge anche \`TotalHours\`, \`FinalTotalMinutes\`, \`FinalTotalHours\`, \`Billable\` (SI/NO/MISTO), \`Ticket\` e \`Note\`

### Altri raggruppamenti
- Giorno + Progetto
- Progetto
- Commessa

> Nota: nei raggruppamenti, alcune colonne possono risultare vuote (es. Date fuori dal raggruppamento), per mantenere un layout CSV coerente.

## Caratteristiche del file CSV
- Separatore: \`;\`
- Decimali ore: \`0.00\`
- Nome file: \`timesheet_YYYYMMDD_YYYYMMDD.csv\`

## Compatibilità con Excel / Google Sheets
- Importa come CSV con separatore \`;\`.
- Le date sono già in formato italiano (di solito Excel le riconosce correttamente).

## Colonne: significato
- **Date**: data worklog (gg/mm/aaaa)
- **EndCustomer**: cliente finale del progetto (testo)
- **BillToCustomer**: cliente “Fatturo a” (anagrafica clienti)
- **Commessa**: nome commessa
- **ProjectCode**: codice progetto (se presente)
- **Project**: nome progetto
- **Minutes**: minuti (commessa / fatturo a)
- **Hours**: Minutes convertiti in ore (2 decimali)
- **FinalMinutes**: minuti per il cliente finale (se non compilati, uguali a Minutes)
- **FinalHours**: FinalMinutes convertiti in ore (2 decimali)
- **Billable**: \`SI\` / \`NO\` / \`MISTO\`
- **Ticket**: numero ticket/richiesta collegato all’intervento, se compilato
- **Note**: note operative del worklog; nei raggruppamenti più note vengono aggregate con \` | \`


## Export JSON

Il dropdown **Esporta** nella pagina **Timesheet** permette anche di scaricare un file \`.json\` con gli stessi filtri e raggruppamenti del CSV. Il file include metadati di esportazione, filtri applicati, riepilogo totali e righe esportate. I campi **Ticket** e **Note** sono mantenuti anche nel formato JSON.


## Nota V.13.10_step 26
- L’export JSON mantiene le righe a capo delle note operative; l’export CSV continua invece a produrre campi testo su singola riga per compatibilità con i fogli di calcolo.
`,

    "08_WORKFLOW_TECNICO": `# 8. Workflow tecnico (sviluppo/manutenzione)

Questa guida è per chi modifica il progetto.

## 8.1 Avvio in locale
Essendo una single page app con Firebase, è consigliato servirla via HTTP.

Opzioni semplici:
- VS Code: estensione **Live Server**
- Python: \`python -m http.server 8080\`

Apri poi \`http://localhost:8080\`.

## 8.2 Struttura moduli
- \`index.html\`: layout e sezioni (\`div.content-section\`) con \`id\` uguale al \`data-target\` del menu.
- \`js/services/firebase-cloud.js\`: init Firebase + CRUD su Firestore.
- \`js/ui/ui-render.js\`: orchestratore UI di alto livello.
- \`js/ui/*-render.js\`: moduli di rendering per area (company, dashboard, scadenziario, tax, masterdata, analysis).
- \`js/features/*\`: moduli funzionali; ciascuno espone \`bind()\` idempotente.
- \`js/features/invoices/invoices-xml-module.js\`: gestisce sia l’export XML singolo sia l’export massivo XML forfettario, riusando \`InvoiceExportService\`.
- \`js/features/invoices/invoice-print-service.js\`: renderer read-only per la stampa dei documenti emessi.
- \`js/features/invoices/invoices-pdf-module.js\`: gestisce la stampa massiva PDF come fascicolo unico browser-based.
- \`js/app/invoice-xml-migration.js\`: orchestratore che chiama i \`bind()\` dei moduli.

## 8.3 Convenzioni importanti
### \`globalData\` come store in memoria
I dati caricati dal cloud finiscono in \`globalData\` (vedi \`utils.js\` e \`firebase-cloud.js\`).

### \`bind()\` idempotente
Ogni modulo feature deve:
- controllare una flag \`_bound\`
- registrare eventi una sola volta

### Refresh UI
Pattern tipico dopo una modifica dati:
1) aggiornare cloud (\`saveDataToCloud\` / \`batchSaveDataToCloud\` / delete)
2) ricaricare dati (\`loadAllDataFromCloud\`) se necessario
3) ridisegnare (\`renderAll\` oppure render specifici)

## 8.4 Aggiungere una nuova funzione (approccio “sicuro”)
1) Creare un nuovo file modulo in \`js/features/<area>/...\`.
2) Esportare \`window.AppModules.<nome>.bind = bind;\`.
3) Includere il file nello script loader (di solito in \`index.html\` o nel bootstrap, a seconda della versione).
4) Chiamare il \`bind()\` dall’orchestratore (\`invoice-xml-migration.js\`).
5) Evitare di toccare \`ui-render.js\` se non necessario.


### Export massivo XML forfettario
Lo step 31 mantiene l’export massivo nel modulo \`invoices-xml-module.js\` per evitare nuove dipendenze e non introdurre un packaging ZIP.

Principi tecnici:
- il pannello UI è in \`index.html\` nella sezione dedicata \`#esportazioni-documenti\`;
- la visibilità è limitata al regime Forfettario tramite \`TaxRegimePolicy\`;
- ogni XML viene generato con \`InvoiceExportService.buildXmlPayload(invoice.id)\`, quindi eredita le stesse validazioni dell’export singolo;
- il download è sequenziale e produce file XML separati;
- nessuna scrittura Firestore e nessuna modifica a stati, Timesheet, calcoli fiscali o mapper XML.

### PDF unico documenti emessi forfettario
Lo step 32 aggiunge una stampa massiva PDF senza introdurre librerie PDF e senza packaging ZIP.

Principi tecnici:
- il pannello UI è in \`index.html\` nella sezione dedicata \`#esportazioni-documenti\`;
- la visibilità è limitata al regime Forfettario tramite \`TaxRegimePolicy\`;
- \`invoices-pdf-module.js\` filtra i documenti per data/tipo, esclude le bozze e prepara il contenuto da stampare;
- \`invoice-print-service.js\` genera HTML read-only del documento usando i normalizzatori e il calcolo fattura già disponibili;
- \`#bulkPdfPrintArea\` e gli stili \`body.bulk-pdf-print-mode\` in \`css/style.css\` isolano la stampa massiva dalla UI ordinaria;
- l’utente ottiene il PDF tramite stampa browser → **Salva come PDF**;
- nessuna scrittura Firestore e nessuna modifica a XML, Timesheet, stati o calcoli fiscali.

### Sezione dedicata Esportazioni Documenti
Lo step 33 separa la UI degli export dalla pagina \`#elenco-fatture\` senza modificare i moduli funzionali degli step 31–32.

Principi tecnici:
- nuova voce sidebar \`#menu-esportazioni-documenti\` con \`data-target="esportazioni-documenti"\`;
- nuova \`content-section\` \`#esportazioni-documenti\` contenente gli stessi pannelli e gli stessi ID dei controlli esistenti;
- visibilità della voce gestita da \`navigation-visibility.js\` tramite \`TaxRegimePolicy\`;
- guard aggiuntivo in \`navigation-module.js\` per il regime Ordinario;
- nessuna duplicazione degli handler e nessun nuovo accesso a Firestore.

### Pulizia UI Esportazioni Documenti
Lo step 34 pulisce la nuova pagina export senza cambiare la logica funzionale.

Principi tecnici:
- rimossi da \`index.html\` i badge tecnici di step presenti nella pagina \`#esportazioni-documenti\`;
- rimossi i pulsanti **Anno filtro** perché poco chiari dopo la separazione dalla pagina elenco fatture;
- la precompilazione automatica dei campi \`Da/A\` resta gestita da \`setBulkXmlDefaultPeriod(false)\` e \`setBulkPdfDefaultPeriod(false)\` all’aggiornamento dei pannelli;
- rimossi solo i binding dei pulsanti non più presenti, mantenendo invariati gli handler principali di export XML e stampa PDF;
- nessuna modifica a navigazione, Firestore, stati documento, XML mapper, stampa documento singolo, Timesheet o calcoli fiscali.


### Riquadro Versamenti stimati FAC
Lo step V.13.20_step 03 reintroduce un riepilogo sintetico dei versamenti nella UI forfettaria, senza cambiare il modello dati e senza alterare le formule principali.

Principi tecnici:
- il riquadro è renderizzato in \`tax-render.js\` usando il \`summary\` già calcolato da \`ForfettarioCalc.computeYearlySummary\`;
- i dati provengono da \`forfettarioSimulation.versamenti\` e dai valori annuali \`companyInfo.taxAdjustmentsByYear\`;
- se sono presenti valori F24/manuali vengono mostrati come fonte operativa, altrimenti resta visibile la stima FAC;
- le scadenze 30/06 e 30/11 sono riepilogative e didattiche, senza introdurre nuove logiche di rateazione, proroga, interessi o compensazione F24;
- nessun impatto su fatture, XML, Timesheet, export documenti, Firestore esistente o regime Ordinario.

### Riporto assistito acconti F24
Lo step V.13.20_step 04 aggiunge un suggerimento UI per gli acconti F24 già salvati sull’anno selezionato.

Principi tecnici:
- \`tax-render.js\` legge gli acconti già presenti in \`companyInfo.taxAdjustmentsByYear[anno].lm.acconto1F24/acconto2F24\` e \`companyInfo.taxAdjustmentsByYear[anno].inps.acconto1F24/acconto2F24\`;
- il riquadro appare solo se l’anno specifico selezionato contiene acconti F24 registrati;
- i pulsanti compilano solo i campi UI \`#lm-dich-acconti-imposta\` e \`#lm-dich-inps-versati-anno\`;
- nessun salvataggio automatico viene eseguito: l’utente deve premere **Salva e ricalcola**;
- non vengono modificate formule fiscali, schema dati, fatture, XML, Timesheet, export documenti o regime Ordinario.

### Quadro RR/PXX e Help F24 Fiscalità
Lo step V.13.20_step 02 è una rifinitura prudente della UI fiscale forfettaria.

Principi tecnici:
- il modello dati \`companyInfo.taxAdjustmentsByYear\` resta invariato;
- la logica di calcolo del motore forfettario non cambia nelle formule principali;
- il prospetto UI distingue meglio **Quadro LM** e **Quadro RR/PXX**;
- il pulsante **Help compilazione F24** usa un collapse Bootstrap locale, senza nuovi moduli o nuove dipendenze;
- i campi dichiarativi manuali accettano anche importi copiati in formato italiano (\`1.513,52\`) tramite normalizzazione locale in \`tax-render.js\` e nel parser puro di \`forfettario-calc.js\`;
- nessun impatto su fatture, XML, Timesheet, export documenti, Firestore esistente o regime Ordinario.

### Dati dichiarativi annuali Fiscalità
Lo step V.13.20_step 01 introduce un modello additivo per i dati dichiarativi annuali del regime Forfettario.

Principi tecnici:
- i parametri fiscali stabili restano in \`companyInfo\` come campi globali (\`taxRegime\`, \`codiceRegimeFiscale\`, \`coefficienteRedditivita\`, \`aliquotaSostitutiva\`, \`aliquotaContributi\`, \`aliquotaInps\`);
- i dati variabili per anno sono salvati in \`companyInfo.taxAdjustmentsByYear\`;
- la struttura è indicizzata per anno fiscale e distingue \`lm\` e \`inps\`;
- la pagina **Fiscalità** scrive solo patch additive via \`saveDataToCloud('companyInfo', patch)\`;
- \`forfettario-calc.js\` resta una funzione pura e legge i dati annuali senza accedere a DOM/Firebase;
- se i nuovi campi annuali sono assenti, il motore preserva il comportamento teorico precedente;
- per compatibilità vengono ancora letti, se presenti, i vecchi mapping per anno \`contributiVersatiByYear\`, \`accontiVersatiByYear\` e \`creditiImpostaByYear\`; i vecchi campi globali semplici non vengono più usati come fallback automatico.

Schema indicativo:
\`\`\`js
companyInfo.taxAdjustmentsByYear = {
  "2025": {
    lm: {
      contributiDeducibiliVersati: 3267.75,
      accontiImpostaVersati: 0,
      creditiImposta: 0,
      saldoF24: 0
    },
    inps: {
      versatiAnno: 3267.75,
      saldoF24: 516.00
    },
    notes: "Dichiarazione 2026 su redditi 2025"
  },
  "2026": {
    lm: {
      acconto1F24: 229.00,
      acconto2F24: 229.00
    },
    inps: {
      acconto1F24: 1513.52,
      acconto2F24: 1513.52
    }
  }
};
\`\`\`

La modifica non tocca fatture, XML, Timesheet, registri IVA, acquisti o regime Ordinario.


## 8.5 Firestore: collezioni e batch
- Batch Firestore: limite 500 operazioni; nel progetto si usa ~450 come margine.
- Collezioni per utente: \`users/{uid}/<collection>\`
- Settings: \`users/{uid}/settings/*\`

## 8.6 Backup/Import: note per manutenzione
- Il backup JSON include tutte le collezioni principali + \`companyInfo\`.
- L’import “merge” aggiorna per ID e non cancella record extra.
- Il “ripristino totale” esegue prima reset completo (incl. \`settings/*\`) e poi importa.

## 8.7 Modificare Firebase (nuovo progetto)
In \`js/services/firebase-cloud.js\` aggiorna:
- \`firebaseConfig\` (apiKey, projectId, ...)

Ricorda di configurare:
- Authentication provider (es. Email/Password)
- Firestore rules (accesso per \`uid\`)

`,

    "09_FAQ_TROUBLESHOOTING": `# 9. FAQ e Troubleshooting

## Login / dati non si vedono
- Verifica di essere loggato.
- Se i menu “spariscono” o alcune sezioni non funzionano, entra in **Impostazioni → Azienda** e controlla di aver salvato il **Regime fiscale (gestionale)**.
- Se hai appena importato un backup, rientra in Home oppure ricarica la pagina per aggiornare tutti i render.

## In Forfettario non vedo Acquisti/Fornitori
È normale: in regime forfettario la sezione **Acquisti** e **Fornitori** è disabilitata (scopo didattico: niente IVA a credito).

## Import XML acquisto: “XML non valido”
- Il file deve essere un XML **FatturaPA** con \`FatturaElettronicaHeader\` e \`FatturaElettronicaBody\`.
- Alcuni file “stampati” o esportati da gestionali possono non essere FatturaPA completi.

## Import XML acquisto: fornitore non trovato
Non è bloccante.
- Se il fornitore non è presente, l’app chiede conferma e può **crearlo automaticamente**.
- Se annulli, l’import viene interrotto per evitare di salvare un acquisto “orfano”.

## Export Timesheet: le combo filtro non si aprono
Se succede (in genere dopo modifiche o cache vecchie):
- ricarica la pagina
- verifica di essere nella pagina **Timesheet** e di usare il dropdown **Esporta** nella card dei filtri

Nella versione stabile le combo **Fatturo a / Commessa / Progetto** sono popolate all’apertura della pagina Export.

## Gestione Dati: import “non cancella”
È corretto: **Importa Backup JSON** è un import *non distruttivo* (merge).
Se vuoi un ripristino “pulito” usa:
- **Ripristino totale (Reset + Import)**

## Reset totale: è davvero totale?
Sì. Cancella tutte le collezioni principali e **tutti i documenti sotto \`settings/*\`** (incluse eventuali impostazioni future).

## Ho cancellato per errore
Non c’è “undo”.
- Se hai un backup, usa **Ripristino totale (Reset + Import)**.
- Se non hai un backup, i dati non sono recuperabili dall’app.

## Suggerimento per laboratori
Per evitare problemi, salva sempre:
1) un backup “standard” per l’esercitazione
2) un backup “fine esercizio” per confronto/valutazione


## Posso inserire aliquote fiscali decimali come 26.07?
Sì. I campi percentuali fiscali supportano valori decimali. Per massima compatibilità puoi digitare il punto (\`26.07\`); la normalizzazione dei calcoli interpreta anche la virgola italiana (\`26,07\`).

`,

    "10_CHANGELOG": `# 10. Changelog (principali aggiunte)

Questo changelog riassume le implementazioni introdotte negli ultimi step fino alla versione “stabile”.

## v11.08 (Stable Cloud)
### Gestione Dati (ex Migrazione)
- Rinomina “Migrazione” → **Gestione Dati**.
- **Backup dal Cloud**: esportazione JSON completa (companyInfo + tutte le collezioni).
- **Importa Backup JSON**: import “merge” (aggiorna per ID, non cancella record extra).
- **Ripristino totale (Reset + Import)** con doppia conferma (prompt \`ELIMINA\`).
- **Reset totale dati (Reset classe)** con doppia conferma e cancellazione di:
  - tutte le collezioni principali
  - **tutti i doc in \`settings/*\`** (anche futuri)
- Eliminazioni parziali:
  - **Elimina Documenti per anno** (fatture/NC)
  - **Elimina Acquisti per anno**

### Impostazioni
- **Uso dati (stima)**: tabella + progress bar su 1 GiB (Spark), basata su dimensione JSON dei dati.

### Acquisti
- **Importa XML** (FatturaPA fornitore) nel form Nuovo Acquisto:
  - parsing header/body
  - creazione fornitore con conferma se mancante
  - precompilazione righe e scadenze (se presenti)

### Timesheet / Export CSV
- Esportazione CSV migliorata:
  - date in formato italiano \`gg/mm/aaaa\`
  - rimozione newline e sequenze \`\\n\` dai campi testo
  - ordine colonne: \`Date|EndCustomer|BillToCustomer|Commessa|Project|Minutes|Hours|Billable\`
- Fix popolamento combo filtri (Fatturo a / Commessa / Progetto) all’apertura pagina Export.

### Migliorie UX
- Forzato refresh delle select anno all’apertura della pagina Gestione Dati.

### Dashboard
- Aggiunta pagina **Dashboard** con selettore **Annuale/Mensile**.
- KPI principali: **Ore timesheet totali**, **Ore fatturabili**, **Ore già fatturate**, **N. worklog**.
- Tabelle: dettaglio mensile/giornaliero e Top Progetti/Commesse per ore fatturabili.
`,

    "10_DASHBOARD": `# Dashboard (Annuale / Mensile)

La **Dashboard** è una pagina di riepilogo pensata per dare, a colpo d’occhio, lo stato dell’attività in un periodo selezionato.

## A cosa serve
- Visualizzare **Ore timesheet totali** e **Ore fatturabili** (prioritarie in un contesto didattico).
- Identificare rapidamente i **progetti** e le **commesse** più rilevanti per ore.
- Vedere un dettaglio **mensile** (in modalità annuale) o **giornaliero** (in modalità mensile).

## Dove si trova
Menu laterale: **Dashboard**.

## Periodo
In alto trovi i controlli:
- **Periodo**: \`Annuale\` oppure \`Mensile\`.
- **Anno**: selezionabile in base agli anni presenti nei dati (fatture, acquisti, worklog) + anno corrente.
- **Mese**: visibile solo in modalità \`Mensile\`.
- **Aggiorna**: forza il ricalcolo e l’aggiornamento della pagina.

## KPI (card)
Le card KPI mostrano:
- **Ore totali**: somma di tutti i worklog nel periodo.
- **Ore fatturabili**: somma dei worklog con flag \`Fatturabile\` attivo.
- **Ore già fatturate**: worklog collegati a una fattura (\`invoiceId\` presente).
- **Ore Cliente Finale (CF)**: somma delle ore valorizzate per il cliente finale (\`FinalHours\`).
- **N. worklog**: numero di righe timesheet nel periodo.

> Nota: nel progetto il “Timesheet” è derivato dai **worklog**. Quindi, per ripristinare/analizzare le ore, è sufficiente che i worklog siano presenti.

## Tabelle sotto ai KPI
### 1) Dettaglio periodo (Timesheet)
- In **Annuale**: tabella per **mese** con ore totali, ore fatturabili e percentuale.
- In **Mensile**: tabella per **giorno** con ore totali, ore fatturabili e percentuale.

### 2) Top Progetti (ore fatturabili)
Mostra i 10 progetti con più ore fatturabili nel periodo:
- Progetto
- Commessa
- Ore totali
- Ore fatturabili
- **Ore CF** (Cliente Finale)
- % fatturabili

### 3) Top Commesse (ore fatturabili)
Mostra le 10 commesse con più ore fatturabili nel periodo:
- Commessa
- End Customer
- Fatturo a
- Ore totali
- Ore fatturabili
- % fatturabili

## Regole e definizioni
- **Ore totali** = somma di \`minutes\` / 60.
- **Ore fatturabili** = somma di \`minutes\` dei worklog con \`billable !== false\`.
- **Ore già fatturate** = somma di \`minutes\` dei worklog che hanno \`invoiceId\` valorizzato.

`,

    "11_CHANGELOG": `## V.13.20_step 05 — Scorporo rivalsa e netto da incassare
- Corretto il rilevamento delle opzioni cliente per lo scorporo Rivalsa INPS nelle righe fattura manuali; lo scorporo resta applicato anche modificando quantità o prezzo.
- Allineate le righe manuali al comportamento delle righe importate dal Timesheet, mantenendo i prezzi lordi marcati per il calcolo inverso della rivalsa.
- Aggiunta una regressione sul caso di 155 ore a € 47,25 con rivalsa al 4%, inclusi imponibile, IVA, ritenuta e netto.
- Nell’elenco dei documenti emessi la colonna mostra ora il **Netto da incassare**; per documenti storici senza il campo persistito usa totale documento meno ritenuta.
- Il dettaglio documento continua a mostrare separatamente totale documento e netto da incassare.

## V.13.20_step 04 — Riporto assistito acconti F24
- Aggiunto nella pagina **Fiscalità → Simulazione Fiscale (Quadro LM + Quadro RR/PXX)** un riquadro di suggerimento quando l’anno selezionato contiene acconti F24 già registrati come anno successivo da una dichiarazione precedente.
- Il riquadro propone il riporto esplicito di **1790 + 1791** nel campo **Acconti imposta già versati** e degli acconti **PXX** nel campo **Contributi RR/PXX già versati per l’anno**.
- Nessun dato viene applicato automaticamente: l’utente deve premere i pulsanti di copia e poi **Salva e ricalcola**, riducendo il rischio di doppio conteggio.
- La modifica è limitata alla UI e al binding dei pulsanti in \`tax-render.js\`; non cambia formule fiscali, schema \`taxAdjustmentsByYear\`, fatture, XML, Timesheet, export documenti o regime Ordinario.

## V.13.20_step 03 — Riquadro Versamenti stimati FAC
- Reintrodotto nella pagina **Fiscalità → Simulazione Fiscale (Quadro LM + Quadro RR/PXX)** un riquadro sintetico **Versamenti stimati FAC**, recuperando la leggibilità operativa della vecchia sezione “VERSAMENTI (stima)”.
- Il riquadro usa il nuovo modello annuale \`companyInfo.taxAdjustmentsByYear\`: se sono presenti importi F24/manuali, li evidenzia come **F24 inserito**; altrimenti mostra la **stima FAC**.
- Mostrati in modo compatto saldo imposta sostitutiva, saldo RR/PXX, acconti imposta anno successivo, acconti RR/PXX anno successivo e scadenze tipiche riepilogative 30/06 e 30/11.
- Nessuna modifica alle formule fiscali principali, ai campi dichiarativi annuali, a Firestore esistente, fatture, XML, Timesheet, export documenti o regime Ordinario.

## V.13.20_step 02 — Quadro RR/PXX e Help F24 Fiscalità
- Rinominata la simulazione forfettaria in **Quadro LM + Quadro RR/PXX**, distinguendo meglio imposta sostitutiva e previdenza.
- Aggiunta nel prospetto Fiscalità una mappa didattica **Quadro RR / PXX** con reddito previdenziale stimato, aliquota INPS, contributi stimati, contributi già versati, saldo stimato, saldo F24 PXX e acconti PXX dell’anno successivo.
- Aggiunto il pulsante **Help compilazione F24** nel blocco **Dati dichiarativi annuali**, con istruzioni operative su 1790, 1791, 1792 e causale PXX.
- Aggiunta la nuova guida documentale **12_GUIDA_F24_FISCALITA.md**, inclusa nella documentazione in-app.
- Migliorata la lettura degli importi manuali in formato italiano, inclusi valori copiati come \`1.513,52\`.
- Nessuna modifica a fatture, note di credito, XML, Timesheet, Firestore esistente, export documenti o regime Ordinario.

## V.13.20_step 01 — Dati dichiarativi annuali Fiscalità

Introdotto un modello dati annuale opzionale per rendere la simulazione fiscale forfettaria più confrontabile con il prospetto del commercialista/F24.

### Implementato
- Separati i parametri fiscali globali stabili dai dati dichiarativi variabili per anno.
- Rimossi dalla scheda Azienda i campi globali ambigui per versamenti/acconti/crediti.
- Aggiunto nella pagina **Fiscalità → Simulazione Fiscale (Quadro LM)** il blocco **Dati dichiarativi annuali**.
- Nuovi campi annuali per **LM / Imposta sostitutiva**:
  - LM35 contributi deducibili versati;
  - acconti imposta già versati;
  - crediti/compensazioni;
  - saldo F24 imposta 1792, solo per confronto.
- Nuovi campi annuali per **INPS / PXX**:
  - contributi/PXX già versati per l’anno redditi;
  - saldo F24 PXX dell’anno redditi;
  - acconti PXX dell’anno successivo.
- Aggiunti i campi per acconti dell’anno successivo:
  - imposta sostitutiva 1790/1791;
  - INPS/PXX prima e seconda rata.
- I dati sono salvati in \`companyInfo.taxAdjustmentsByYear\`, indicizzati per anno.
- Se l’utente non inserisce dati annuali, la simulazione teorica resta compatibile con il comportamento precedente; i vecchi campi globali semplici di versamenti/acconti non vengono più applicati automaticamente per evitare contaminazioni tra anni.

### Non modificato
- Nessuna modifica a fatture, note di credito, XML, Timesheet o Firestore esistente.
- Nessuna modifica al regime Ordinario.
- Nessuna modifica ai parametri globali fiscali già presenti: regime, RF, coefficiente redditività, aliquote e rivalsa.

### Controlli
- Aggiornati test browser-based del motore forfettario per il nuovo schema annuale.

---

## V.13.10_step 34 — Pulizia UI Esportazioni Documenti
- Rimossi dalla pagina **Esportazioni Documenti** i badge tecnici “Step 31”, “Step 32” e “Step 33”, perché utili solo alla tracciabilità interna e non all’operatività utente.
- Rimossi i pulsanti **Anno filtro** dai pannelli export XML e PDF unico, evitando un comando poco chiaro nella nuova sezione separata.
- Mantenuta la precompilazione automatica del periodo **Da/A** all’apertura dei pannelli, senza dipendere da un’azione manuale aggiuntiva.
- Nessuna modifica alla logica di export XML, alla stampa PDF, alla navigazione, a Firestore, stati documento, Timesheet, calcoli fiscali o regime Ordinario.

## V.13.10_step 33 — Sezione dedicata Esportazioni Documenti
- Aggiunta nella sidebar, sotto **Fatture di Vendita**, la nuova voce **Esportazioni Documenti**, disponibile solo in regime **Forfettario**.
- Spostati nella nuova pagina i pannelli **Export massivo XML** e **PDF unico documenti emessi**, alleggerendo la schermata **Elenco Documenti**.
- Mantenuti invariati ID dei controlli, handler, servizi e logiche introdotte negli step 31–32; la modifica riguarda esclusivamente collocazione UI, navigazione e visibilità per regime.
- Aggiunto un guard nella navigazione per impedire l’apertura della pagina in regime Ordinario anche tramite richiamo non previsto.
- Nessuna modifica a Firestore, stato documenti, calcoli fiscali, XML mapper, stampa documenti, Timesheet o regime Ordinario.

## V.13.10_step 32 — PDF unico documenti emessi forfettario
- Aggiunto in **Documenti Emessi** un pannello **PDF unico documenti emessi** disponibile solo in regime **Forfettario**.
- L’utente può selezionare un intervallo **Da / A** e includere fatture e/o note di credito; il sistema prepara un fascicolo unico stampabile.
- La generazione resta browser-based: non crea file PDF separati, non usa ZIP e non introduce nuove librerie PDF. L’utente salva il file dalla finestra di stampa scegliendo **Salva come PDF**.
- Le bozze sono escluse dal fascicolo dei documenti emessi e vengono riepilogate tra i documenti non inclusi.
- Nessuna modifica a stato documento, Firestore, Timesheet, calcoli fiscali, XML o regime Ordinario.

## V.13.10_step 31 — Export massivo XML forfettario
- Aggiunto in **Documenti Emessi** un pannello **Export massivo XML** disponibile solo in regime **Forfettario**.
- L’utente può scegliere un intervallo **Da / A** e includere fatture e/o note di credito; i documenti vengono filtrati per data documento.
- L’export riusa \`InvoiceExportService.buildXmlPayload()\` per ogni documento, quindi mantiene le stesse validazioni e la stessa generazione XML del download singolo.
- I file vengono scaricati come XML separati, senza creare ZIP e senza introdurre nuove dipendenze esterne.
- Le bozze e i documenti non esportabili vengono saltati e mostrati nel riepilogo finale; non vengono modificati stato documento, Firestore, calcoli fiscali, Timesheet o XML mapper.
- Il regime **Ordinario** non è stato alterato: il pannello resta nascosto in questo step.

## V.13.10_step 30 — Percentuali fiscali decimali
- Abilitato l’inserimento di valori decimali nei principali campi percentuali fiscali dell’anagrafica azienda, inclusi **INPS %** forfettario, **Coeff. Redditività %**, **Imposta Sostitutiva %** e **Rivalsa INPS %**.
- Il campo **INPS %** forfettario può ora accettare valori come \`26.07\`, evitando la validazione HTML che prima consentiva solo interi.
- Aggiornata la normalizzazione numerica usata dai calcoli per interpretare anche la virgola italiana (\`26,07\`) come valore decimale.
- Nessuna modifica alle formule fiscali, alle fatture, all’XML, al Timesheet o ai dati già salvati.

## V.13.10_step 29 — Filigrana BOZZA nella stampa fattura
- Aggiunta una filigrana **BOZZA** nelle stampe delle fatture salvate con stato Bozza.
- La filigrana è applicata solo in fase di stampa/anteprima stampa dal dettaglio fattura.
- Le fatture emesse, inviate o pagate non mostrano la filigrana.
- Modifica solo UI/CSS di stampa: nessuna variazione a XML, calcoli, Firestore o stati documento.

## V.13.10_step 28 — Fix allineamento tabella Commesse
- Corretto il rischio di disallineamento nella tabella Commesse dopo l’aggiunta delle colonne **Ore previste**, **Ore caricate** e **Ore residue**.
- Aggiunto versionamento agli asset locali JS/CSS caricati da \`index.html\`, così il browser non riutilizza versioni vecchie di \`ui-render.js\` o altri moduli dopo il deploy.
- Rafforzata la resa della tabella Commesse con allineamento verticale e celle numeriche non spezzate.
- Nessuna modifica a dati, Timesheet, fatturazione o logiche fiscali.

## V.13.10_step 27 — Ore previste e residue sulle Commesse
- Aggiunto nella modale Commessa il campo opzionale **Ore previste**, salvato come dato gestionale della commessa.
- La tabella Commesse mostra ora **Ore previste**, **Ore caricate** dal Timesheet e **Ore residue** calcolate a video.
- Le ore residue hanno evidenza visiva: positivo = disponibilità residua, zero = commessa esaurita, negativo = ore superate.
- Le ore residue non vengono salvate come dato persistente: sono sempre calcolate dai worklog collegati alla commessa.
- Nessuna modifica alla struttura del Timesheet, alla fatturazione, all’import ore in fattura o all’XML.

## V.13.10_step 26 — Fix Timesheet JSON, contatori e Dashboard mensile
- **Export Timesheet JSON**: le note/descrizioni preservano ora le righe a capo logiche invece di essere appiattite su una sola riga. Nei raggruppamenti JSON le note vengono concatenate con newline, mentre il CSV mantiene la sanitizzazione su singola riga.
- **Timesheet**: corretto il contatore in testata **Totale (cliente finale)**, che ora somma \`minutesFinal\` quando presente e usa \`minutes\` come fallback.
- **Dashboard mensile**: corretto il calcolo del periodo mese evitando \`toISOString()\`, che in alcuni fusi orari anticipava primo/fine mese di un giorno. Ora il mese va sempre dal giorno 01 all’ultimo giorno reale del mese selezionato.
- **Export CSV**: corretto un allineamento interno della riga di dettaglio per evitare una data duplicata rispetto all’intestazione.
- Nessuna modifica a Firestore, fatturazione, import ore in fattura o struttura dati.

## V.13.10_step 25 — Chiusura commessa e archiviazione progetti collegati
- Quando una commessa **esistente** viene salvata passando da **Attiva** a **Chiusa**, l’app verifica i progetti collegati non ancora archiviati.
- Se sono presenti progetti collegati ancora attivi, viene chiesta conferma all’utente prima di aggiornarli.
- Rispondendo **Sì**, solo i progetti collegati alla commessa vengono aggiornati con \`status: 'archiviato'\`; rispondendo **No**, i progetti restano invariati.
- La modifica non elimina dati e non tocca Timesheet, fatturazione, export o struttura Firestore.

## V.13.10_step 24 — Fix XML FatturaPA forfettario con rivalsa
- Corretto \`InvoiceXMLMapper\` per rimuovere \`RiferimentoNormativo\` da \`DatiCassaPrevidenziale\`, nodo non previsto dal tracciato FatturaPA in quel blocco.
- Corretto l’ordine di \`RiferimentoNormativo\` in \`DatiRiepilogo\`: ora viene scritto dopo \`ImponibileImporto\` e \`Imposta\`, come richiesto dalla sequenza XSD.
- Il tag \`NumeroCivico\` del cedente viene ora omesso quando è vuoto o non compatibile con il limite FatturaPA, invece di generare un tag vuoto.
- Aggiunti controlli nella suite \`invoice-xml-mapper.spec.js\` per prevenire regressioni su questi casi.

## V.13.10_step 23 — Export Timesheet integrato nella pagina Timesheet
- Rimossa dalla sidebar la voce separata **Export CSV**, per compattare il menu laterale.
- Aggiunto nella pagina **Timesheet** un dropdown **Esporta** con scelte **CSV** e **JSON**.
- Aggiunto un selettore compatto **Raggruppa export** nella card dei filtri Timesheet.
- L’export riusa la logica esistente di \`timesheet-export.js\`, applicando i filtri già presenti nella pagina Timesheet.
- La vecchia sezione tecnica \`export-timesheet\` resta nel codice come supporto/fallback interno, ma non è più esposta nel menu.

## V.13.10_step 22 — Export Timesheet JSON
- Aggiunto nella pagina **Export Timesheet** il pulsante **Esporta JSON** accanto all’export CSV.
- Il JSON riusa gli stessi filtri e le stesse modalità di raggruppamento del CSV: dettaglio, giorno pivot, giorno + progetto, progetto e commessa.
- Nel JSON sono inclusi anche **Ticket** e **Note**, coerentemente con l’export CSV introdotto nello step 15.
- Nessuna modifica al modello dati Timesheet, a Firestore, alla fatturazione o all’import ore in fattura.

## V.13.10_step 21 — Rifinitura finale spazi payoff logo FAC
- Corretta ulteriormente la spaziatura del payoff del logo nella schermata di login.
- Aumentata la distanza tra **Fast** e **Accounting** per evitare l’effetto di parola attaccata.
- Mantenuti spazi più uniformi tra **Fast**, **Accounting**, **&** e **Control**.
- Nessuna modifica alla logica applicativa o agli altri asset di branding.

## V.13.10_step 20 — Uniformazione spazi payoff logo FAC
- Rifinita la spaziatura del payoff del logo nella schermata di login.
- Gli spazi tra **Fast**, **Accounting**, **&** e **Control** sono stati riallineati per una resa più uniforme.
- Nessuna modifica a favicon, sidebar compatta o logica applicativa.

## V.13.10_step 19 — Fix spaziatura payoff logo FAC
- Corretto il payoff del logo orizzontale nella schermata di login, aumentando la distanza visiva tra “Accounting”, “&” e “Control”.
- Per evitare differenze di rendering tra browser, nella login viene usata la versione **PNG trasparente** del logo completo.
- Nessuna modifica alla favicon, alla sidebar compatta o alla logica applicativa.

## V.13.10_step 18 — Rifinitura logo/login FAC
- Corretta la spaziatura del payoff nel logo orizzontale per evitare sovrapposizioni tra “Accounting” e “&”.
- Rimossa dalla schermata di login la riga ripetuta “Fast Accounting & Control” sotto il logo, per una presentazione più pulita.
- Nessuna modifica alla favicon, alla sidebar compatta o al comportamento applicativo.

## V.13.10_step 17 — Branding FAC (logo + favicon)
- Integrati gli asset ufficiali **FAC – Fast Accounting & Control** nella UI.
- Aggiunta favicon globale in \`index.html\` e nuovi asset nella cartella \`assets/brand/\`.
- Inserito il logo orizzontale nella schermata di login.
- Inserito un brand compatto con icona FAC nella testata della sidebar.
- Asset PNG con trasparenza: nessuno sfondo bianco incorporato nel logo o nella favicon, così restano puliti in Light e Dark Mode.

## V.13.10_step 16 — Tema applicato anche alla sidebar/menu
- Il toggle **Dark mode** ora modifica anche la sidebar di navigazione e la barra menu, non solo la finestra principale.
- In modalità chiara la sidebar usa sfondo, bordi, testi, hover e toggle coerenti con il tema Light; in modalità scura mantiene il look blu notte esistente.
- Modifica solo CSS/UI: nessuna variazione a dati, Firestore, Timesheet, fatture o calendario.

## V.13.10_step 15 — Ticket Timesheet ed export CSV
- **Timesheet**: aggiunto campo opzionale **Ticket** sul worklog, utile per indicare il numero ticket/richiesta collegato all’intervento.
- **Tabella Timesheet**: aggiunta colonna **Ticket** accanto alle note.
- **Export Timesheet CSV**: aggiunte colonne **Ticket** e **Note** nell’export di dettaglio; nei raggruppamenti e nel pivot i valori vengono aggregati con separatore \` | \`.
- Modifica circoscritta al timesheet e all’export CSV: nessuna variazione a fatturazione, calcoli ore o import in fattura.

## V.13.10_step 14 — Fix caricamento acquisti dopo login
- Risolto l'errore post-login \`getNormalizedPurchases is not defined\`, emerso durante il caricamento dei dati/dashboard.
- Aggiunto nel modulo Acquisti un helper locale prudente che normalizza gli acquisti tramite \`DomainNormalizers.normalizePurchaseInfo()\` quando disponibile, mantenendo fallback sicuro ai dati grezzi.
- Nessuna modifica a recupero password, Timesheet, fatturazione o Google Calendar Home.

## V.13.10_step 13 — Recupero password Firebase in login
- aggiunto nella schermata di accesso il link **Password dimenticata?**.
- introdotta una modale Bootstrap per inserire l'email e richiedere a Firebase Auth l'invio del link di reset password.
- messaggio di conferma neutro: non espone se l'indirizzo email è registrato oppure no.
- nessuna modifica a Firestore, Timesheet, fatture, calendario o modello dati applicativo.

## V.13.10_step 12 — Google Calendar 7 giorni in Home
- aggiunta in **Dati Azienda** l'impostazione opzionale \`Google Calendar Home\` per inserire un URL embed Google Calendar o un ID calendario.
- la Home usa Google Calendar in modalità \`WEEK\` quando l'impostazione è presente e valida; in caso contrario mantiene il calendario locale esistente.
- integrazione volutamente prudente: nessun OAuth Calendar, nessuna modifica a Firebase Auth e nessun nuovo backend applicativo.

## V.13.10_step 11 — Dark Mode blocco Allegato XML da Timesheet
- migliorata la leggibilità del blocco **Allegato XML da Timesheet** nel form fattura quando è attiva la Dark Mode.
- aggiunto uno stile mirato per \`#invoice-timesheet-attachment-options\`, perché la classe Bootstrap \`bg-light-subtle\` non era coperta dagli override dark mode già presenti per \`bg-light\` e \`bg-white\`.
- nessuna modifica al flusso funzionale dell'allegato: il PDF resta descrittivo, opzionale e non modifica righe, totali o documento fiscale principale.

## V.13.10_step 10 — Allegato Timesheet PDF nell'XML della fattura
- aggiunte nel form fattura le opzioni per allegare all'XML un **PDF con il dettaglio non aggregato del timesheet** e per includere le **note operative** dei worklog.
- il dataset dell'allegato viene ricostruito dai worklog collegati alla fattura tramite \`timesheetImport\` e metadati \`tsWorklogIds\`, così il dettaglio resta separato dalle righe fiscali aggregate.
- introdotti \`invoice-timesheet-attachment-service.js\` e \`invoice-timesheet-pdf-service.js\` per costruire l'allegato e generare un PDF browser-side senza dipendenze esterne.
- \`InvoiceExportService\` prepara l'allegato solo se richiesto, mentre \`InvoiceXMLMapper\` serializza il blocco \`<Allegati>\` nel tracciato FatturaPA senza alterare i totali del documento.

## V.13.10_step 09 — Toggle visibilità password in login
- aggiunto nella schermata di accesso un pulsante con icona **occhio** per mostrare o nascondere la password digitata.
- nessuna modifica alla logica di autenticazione: cambia solo la visibilità del campo password lato interfaccia.

## V.13.10_step 08 — Revisione completa manuale utente
- riscritta e ampliata la sezione **Manuale utente** con spiegazioni più chiare su anagrafica azienda, regimi fiscali, documenti, acquisti, scadenziario e simulazioni.
- estesa la guida passo-passo con un percorso più completo su commesse, progetti, timesheet, import ore in fattura, nota di credito e collaudo finale.
- rigenerata la documentazione in-app (\`docs-content.js\`) a partire dai file Markdown aggiornati.

## V.13.10_step 08 — Azioni XML contestuali nel dettaglio fattura
- aggiunto nel footer della modale dettaglio documento un menu a tendina **XML** al posto del pulsante singolo di export.
- il menu include: **Genera XML**, **Copia XML**, **Apri FatturaCheck**, **Apri FEX** e **Apri Agenzia Entrate**.
- i validatori esterni si aprono sempre in una **nuova tab** e non ricevono automaticamente il file: il caricamento o l'incolla dell'XML resta sotto controllo dell'utente.
- aggiunto un disclaimer privacy sui servizi di validazione di terze parti.
- spostato anche il toggle **Dark mode** sopra la voce **Home** nella sidebar.

## V.13.10_step 08 — Ripristino toggle Dark Mode
- reintrodotto un toggle **Dark mode on/off** visibile in fondo alla sidebar, così il cambio tema torna accessibile senza entrare nella pagina Azienda
- \`theme-module.js\` sincronizza ora sia la select completa \`#app-theme-select\` sia il nuovo switch \`#sidebar-darkmode-toggle\`
- il toggle laterale forza rapidamente **Chiaro/Scuro**, mentre la select in Preferenze App continua a supportare anche l'opzione **Segui sistema**

## V.13.10_step 04 — Stati documento + audit store/read
- introdotto \`normalizeInvoiceStatusInfo()\` in \`js/core/domain-normalizers.js\` per riallineare stato documento, bozza, inviata ad ADE e nota di credito tra lista fatture, scadenziario e flussi di export
- \`invoices-list-module.js\`, \`scadenziario-module.js\` e \`scadenziario-render.js\` leggono ora una shape canonica degli stati, riducendo mismatch tra pagata/inviata/bozza e filtraggio scadenziario
- ridotti altri fallback a \`renderAll()\` nei CRUD semplici (azienda/anagrafiche/acquisti) e rimossa una lettura legacy diretta di \`globalData\` dall'import XML acquisti

## V.13.10_step 01 — Timesheet import hardening (checklist punto 6)
- introdotto \`normalizeTimesheetImportInfo()\` in \`js/core/domain-normalizers.js\` per riallineare batch import, gruppi, worklog IDs e stato import tra modale fattura, sessione e persistenza
- \`InvoiceFormSessionService\`, \`InvoiceFormStateService\` e \`InvoiceService\` usano ora lo stesso normalizzatore per leggere e salvare \`timesheetImport\`
- \`InvoicePersistenceService\` usa anche il fallback dello stato \`timesheetImport\` per marcare i worklog come fatturati quando le righe importate sono già state trasformate
- estesi i test browser-based dei normalizer con casi dedicati al flusso Timesheet → Fattura

## V.13.00_step 08 — Totali documento hardening (checklist punto 5)
- introdotto \`normalizeInvoiceTotalsInfo()\` in \`js/core/domain-normalizers.js\` per riallineare totali, bollo, rivalsa, IVA, ritenuta e netto tra preview, persistenza e export XML
- \`InvoiceService\`, \`invoices-form-module.js\`, \`invoices-list-module.js\` e \`InvoiceExportService\` usano ora una risoluzione canonica dei totali documento
- aggiunti test browser-based sui fallback dei totali calcolati/persistiti

## V.13.00_step 07 — Credit note hardening (checklist punto 4)
- introdotto \`normalizeCreditNoteInfo()\` in \`js/core/domain-normalizers.js\` per riallineare alias legacy e campi canonici di **nota di credito**, documento collegato, data documento collegato e causale
- \`InvoiceService\`, \`InvoiceFormStateService\`, \`InvoiceValidationService\`, \`InvoiceXMLValidator\` e \`InvoiceXMLMapper\` usano ora la stessa risoluzione dei dati di nota di credito
- il mapper XML aggiunge \`DatiFattureCollegate\` quando sono disponibili sia numero sia data del documento collegato
- estesi i test browser-based dei normalizer con casi dedicati alle note di credito

## V.13.00_step 06 — Payment/account selection hardening (checklist punto 3)
- introdotto \`normalizeInvoicePaymentInfo()\` in \`js/core/domain-normalizers.js\`
- riallineati metodo di pagamento, \`bankChoice\`, fallback conto principale/secondario e banca/IBAN selezionati
- preview fattura, validator XML e mapper XML leggono ora la stessa risoluzione del pagamento
- aggiunti test browser-based sui casi \`Rimessa Diretta\` e conto 2 non configurato

## V.13.00_step 01 (Fase 5 completata – versione ridisegnata)
- Chiusa la Fase 5 del refactoring con una rifinitura finale della strategia di test browser-based.
- Aggiunta \`tests/index.html\` come pagina indice unica delle suite di dominio: \`TaxRegimePolicy\`, \`InvoiceCalculator\`, \`InvoiceXMLValidator\` e \`InvoiceXMLMapper\`.
- Nessun cambio funzionale ai flussi gestionali: lo step serve a rendere più semplice l'esecuzione manuale dei test e a segnare il passaggio alla versione ridisegnata del progetto.

## v12.51 (Fase 5 – test unitari InvoiceXMLMapper)
- Aggiunta la suite browser-based \`tests/invoice-xml-mapper.spec.js\` con pagina dedicata \`tests/invoice-xml-mapper.test.html\`.
- Esteso \`tests/test-harness.js\` con \`assertIncludes(...)\` e \`assertMatch(...)\` per verificare in modo leggibile frammenti e pattern del tracciato XML.
- Coperti i casi più delicati del mapper: XML ordinario, forfettario con natura \`N2.2\` e riferimento normativo, note di credito \`TD04\`, pagamento con banca/IBAN, anagrafiche persona fisica/azienda, bollo, rivalsa previdenziale, scorporo e spezzatura delle causali lunghe.
- Nessun cambio funzionale al flusso applicativo: step dedicato alla qualità del layer di export XML.

## v12.50 (Fase 5 – test unitari InvoiceXMLValidator)
- Aggiunta la suite browser-based \`tests/invoice-xml-validator.spec.js\` con pagina dedicata \`tests/invoice-xml-validator.test.html\`.
- Coperti i casi principali del layer \`InvoiceXMLValidator\`: numero e data documento, identità cliente, identificativi fiscali, indirizzi azienda/cliente, righe esportabili, codice regime fiscale, pagamento con IBAN e note di credito.
- Verificato anche l'aggancio con il controllo base di \`InvoiceValidationService.validateXmlContext(...)\`, così i test coprono sia i blocchi introdotti in Fase 3 sia i fallback di validazione preesistenti.
- Nessun cambio funzionale alla UI: step dedicato a qualità e affidabilità dell'export XML.

## v12.49 (Fase 5 – test unitari InvoiceCalculator)
- Aggiunta la suite browser-based \`tests/invoice-calculator.spec.js\` con pagina dedicata \`tests/invoice-calculator.test.html\`.
- Esteso \`tests/test-harness.js\` con \`assertApprox(...)\` per verifiche numeriche affidabili sui calcoli monetari.
- Coperti i casi principali del layer \`InvoiceCalculator\`: default di regime, aliquota IVA effettiva, errore se il motore comune manca, fattura ordinaria semplice, forfettario con bollo automatico, rivalsa INPS, ritenuta, scorporo e opzione \`includeBolloInTotale\`.
- Nessun cambio funzionale alla UI: step focalizzato sulla qualità del dominio di calcolo fatture.

## v12.48 (Fase 5 – test unitari TaxRegimePolicy)
- Introdotta la prima suite di test unitari browser-based nella cartella \`tests/\`.
- Aggiunti \`tests/test-harness.js\`, \`tests/tax-regime-policy.spec.js\` e \`tests/tax-regime-policy.test.html\`.
- Coperti i casi base del layer \`TaxRegimePolicy\`: risoluzione del regime, fallback da \`codiceRegimeFiscale\`, capability, visibilità UI e default fattura.
- Nessun cambio funzionale al flusso applicativo: step dedicato alla qualità e verificabilità del dominio.

## v12.47 (Refactoring Fase 4 – store adoption controllata)
- Avviata l'adozione reale di **AppStore** nei moduli semplici: **Azienda, Clienti, Servizi, Fornitori**.
- I renderer di anagrafiche leggono ora in modo esplicito dallo store, con fallback legacy compatibile.
- \`company-render.js\` supporta refresh dal dato passato o dal dato corrente nello store.
- \`masterdata-helpers.js\` usa lo store per edit di clienti/prodotti/fornitori e per la lettura del \`companyInfo\` corrente.
- \`company-module.js\` è stato collegato allo store anche in lettura, mantenendo compatibilità con il flusso Firestore esistente.

## v12.46 (Refactoring Fase 4 – meno \`renderAll()\` nei CRUD frequenti)
- **\`UiRefresh\` esteso ancora**: aggiunti refresh combinati per \`fatture + analisi + scadenziario\` e \`acquisti + analisi + scadenziario\`, così le aree dipendenti si aggiornano insieme senza ricorrere al refresh globale.
- **CRUD Fatture più mirati**: cancellazione documento, marcatura come pagata e marcatura come inviata aggiornano ora vendite, analisi e scadenziario tramite refresh selettivi.
- **CRUD Acquisti più mirati**: eliminazione acquisto e cambio stato pagamento aggiornano acquisti, analisi e scadenziario senza passare da \`renderAll()\` quando non serve.
- **Cambio stato da Scadenziario riallineato**: le azioni sullo scadenziario usano il refresh combinato delle fatture, così tabella vendite, analisi e scadenze restano coerenti con meno lavoro inutile.

## v12.45 (Refactoring Fase 4 – refresh mirati sui flussi frequenti)
- **\`UiRefresh\` esteso**: aggiunti refresh dedicati per company/navigation, scadenziario e aree dipendenti dal regime, così il layer introdotto in v12.44 copre più casi reali senza forzare \`renderAll()\`.
- **Salvataggio anagrafica azienda**: \`company-module.js\` usa ora un refresh mirato di company + navigation + aree dipendenti, invece del redraw completo dell'app dopo ogni modifica aziendale.
- **Fatture e acquisti**: submit fattura e salvataggio acquisto aggiornano in modo selettivo vendite/acquisti/analisi prima di riportare l'utente alla lista.
- **Scadenziario**: il cambio stato di fatture e acquisti da scadenziario aggiorna ora solo le aree interessate (vendite/scadenziario oppure acquisti/analisi), riducendo refresh globali e accoppiamento UI.

## v12.44 (Refactoring Fase 4 – Store minimo e refresh mirati)
- **Introdotto \`AppStore\`**: layer minimo sopra \`globalData\` con \`get/set/update/mergeItem/removeItem/subscribe\`, pensato per avviare la Fase 4 senza rompere la compatibilità legacy.
- **Cloud sincronizzato con lo store**: \`loadAllDataFromCloud\`, \`saveDataToCloud\`, \`batchSaveDataToCloud\` e \`deleteDataFromCloud\` aggiornano anche lo store applicativo.
- **Introdotto \`UiRefresh\`**: refresh mirati per masterdata, vendite, acquisti e analisi, così le operazioni più semplici non devono sempre passare da \`renderAll()\`.
- **Primi moduli aggiornati**: anagrafiche, alcune azioni elenco fatture e toggle stato acquisti usano refresh selettivi e \`skipRender\` nelle delete.

## v12.43 (Refactoring Fatture – Fase 3 final cleanup)
- **Sessione Modale Fattura**: \`InvoiceFormSessionService\` ora mantiene stato coerente di documento in editing, righe temporanee e import timesheet, sincronizzando i fallback legacy solo per compatibilità.
- **Import Timesheet**: \`invoices-timesheet-import-module.js\` usa la sessione fattura al posto di \`tempInvoiceLines\`/\`App.invoices.timesheetImportState\` sparsi, riducendo l'accoppiamento tra modale, import e persistenza.
- **Form Fattura**: \`invoices-form-module.js\` è stato alleggerito ancora nei punti di rimozione righe e bootstrap dello stato in nuovo documento/modifica/copia.
- **XML più robusto**: precheck più stretti su identità fiscale azienda/cliente, controllo migliore sulle note di credito e aggiunta di \`DatiFattureCollegate\` quando è presente un documento collegato.

## v12.42 (Refactoring Fatture – Fase 3 consolidamento controller/export)
- **Introdotto \`InvoiceFormSessionService\`**: stato della modale fattura (ID corrente, righe locali, stato import Timesheet) centralizzato in un layer dedicato, così \`invoices-form-module.js\` riduce ulteriormente la dipendenza da globali sparsi.
- **Introdotto \`InvoiceExportService\`**: il flusso XML ora passa da un orchestratore dedicato che recupera il contesto, valida l’esportabilità, calcola i totali e gestisce il download senza lasciare questa logica dentro \`invoices-xml-module.js\`.
- **Confini service più puliti**: \`invoices-list-module.js\` usa direttamente \`InvoicePersistenceService\` per sbloccare i worklog collegati durante l’eliminazione documento, evitando di passare dal modulo form.
- **XML ancora più blindato**: \`InvoiceXMLValidator\` verifica ora anche sede azienda con alias robusti e presenza di un IBAN aziendale quando la modalità di pagamento è bonifico/rimessa diretta.
- **\`invoices-form-module.js\` alleggerito ancora**: molte letture/scritture dello stato locale passano da helper di sessione (\`getCurrentInvoiceIdSafe\`, \`getInvoiceLinesSafe\`, \`setInvoiceLinesSafe\`) invece di usare direttamente variabili globali.

## v12.41 (Refactoring Fatture – Fase 3 rifinitura prudente)
- **Introdotto \`InvoiceFormUiService\`**: creazione riga da input UI, aggiornamento inline della riga, modifica descrizione e rimozione riga vengono delegati fuori da \`invoices-form-module.js\`, che resta più vicino al ruolo di controller della modale.
- **\`invoices-form-module.js\` alleggerito ancora**: gli handler di aggiunta/modifica/cancellazione righe usano ora un service dedicato invece di contenere direttamente logica su scorporo, classificazione costo/lavoro e mutazioni dell'array locale.
- **XML più robusto senza strappi**: \`InvoiceXMLMapper\` normalizza meglio anagrafica e indirizzi di azienda/cliente (alias comuni come \`zip/cap\`, \`city/comune\`, \`address/indirizzo\`) e continua a generare il tracciato senza una riscrittura aggressiva.
- **Precheck XML più severi**: \`InvoiceXMLValidator\` richiede anche un identificativo fiscale del cliente e usa una risoluzione più robusta dei campi sede prima dell'export.

## v12.40 (Refactoring Fatture – Fase 3 hardening XML e submit)
- **Introdotti \`InvoiceFormStateService\` e \`InvoiceSubmitService\`**: raccolta stato form, validazione, duplicate check e persistenza del documento vengono orchestrati fuori da \`invoices-form-module.js\`, che resta più vicino al ruolo di controller UI.
- **\`invoices-form-module.js\` alleggerito ancora**: l’handler di submit delega ora a service dedicati invece di contenere tutta la procedura di costruzione payload e salvataggio.
- **Confini service più netti**: \`InvoiceFormStateService\` raccoglie i dati UI, \`InvoiceSubmitService\` orchestra il flusso di salvataggio, \`InvoiceService\` continua a costruire il payload, \`InvoicePersistenceService\` persiste, \`InvoiceXMLMapper\` trasforma.
- **XML più blindato**: \`InvoiceXMLValidator\` verifica meglio anagrafica cliente/azienda e nota di credito; \`InvoiceXMLMapper\` gestisce causali XML e anagrafica cliente persona fisica vs azienda senza riscrivere il tracciato in modo aggressivo.

## v12.39 (Refactoring Fatture – Fase 3 consolidamento prudente)
- **Introdotto \`InvoicePersistenceService\`**: il salvataggio della fattura e la sincronizzazione dei worklog importati non vivono più nel submit della form, ma in un layer dedicato che centralizza persist e binding documento/worklog.
- **\`invoices-form-module.js\` alleggerito ancora**: il submit delega il persist al service e mantiene solo orchestrazione UI, validazione finale e gestione feedback.
- **Attenzione ulteriore all’XML**: \`InvoiceXMLValidator\` verifica ora anche numero/data documento, denominazione cliente, presenza di almeno una riga esportabile e codice regime fiscale azienda prima di chiamare il mapper.
- **Compatibilità mantenuta**: \`InvoiceXMLMapper\` non viene riscritto e il tracciato FatturaPA resta stabile; il refactor agisce sul contorno per ridurre rischio di regressioni.

## v12.38 (Refactoring Fatture – Fase 3 continuazione cauta)
- **Introdotto \`InvoiceValidationService\`**: validazione minima del form documento, controllo duplicati soft e messaggi di conferma sono stati centralizzati fuori da \`invoices-form-module.js\`.
- **Introdotto \`InvoiceLineService\`**: creazione/aggiornamento righe documento e raccolta degli ID worklog importati passano da un layer dedicato, riducendo logica sparsa nel form.
- **\`InvoiceService\` esteso**: costruisce ora anche il payload persistito del documento (stato bozza, pagamenti, bollo, dati calcolati), alleggerendo il submit della form.
- **Attenzione all’XML**: aggiunto \`InvoiceXMLValidator\` come pre-check dedicato per l’export, così la sicurezza del contesto XML aumenta senza riscrivere \`InvoiceXMLMapper\` né cambiare il tracciato FatturaPA generato.
- **\`invoices-form-module.js\` ulteriormente alleggerito**: il submit delega validazione, duplicate check e costruzione payload; gli handler riga usano i nuovi service senza cambiare il comportamento funzionale della UI.

## v12.37 (Refactoring Fatture – Fase 3 avviata)
- **Introdotto \`InvoiceCalculator\`**: il calcolo documento viene richiamato da un layer dedicato, lasciando compatibilità con il motore già presente in \`invoices-common-calc.js\`.
- **Introdotto \`InvoiceService\`**: recupero contesto documento (fattura/azienda/cliente), stato iniziale del form e stato di editing/copia centralizzati in un modulo dedicato.
- **Introdotto \`InvoiceXMLMapper\`**: la costruzione del tracciato XML FatturaPA è stata estratta in un mapper puro, così \`invoices-xml-module.js\` si occupa solo di orchestrare contesto, calcolo e download del file.
- **Attenzione alla stabilità XML**: il refactor non cambia il flusso di export né il naming del file; isola la costruzione del tracciato per poter evolvere il dominio fatture riducendo il rischio di regressioni sul file XML.
- **\`invoices-form-module.js\` alleggerito**: default fattura e stato di caricamento documento passano da \`InvoiceService\`, riducendo logica sparsa nel form.

## v12.36 (Refactoring UI – Fase 2 completata)
- **Estratto \`masterdata-render.js\`**: ricerca anagrafiche e rendering tabelle di prodotti, clienti e fornitori non vivono più in \`js/ui/ui-render.js\`.
- **Estratto \`analysis-render.js\`**: filtri statistiche, registri IVA, Home e calendario sono stati spostati in un modulo dedicato.
- **\`ui-render.js\` rifinito come orchestratore**: resta il punto di coordinamento alto livello delle aree UI, mentre il dettaglio di rendering è distribuito in moduli specializzati.
- **Approccio prudente mantenuto**: nessun cambio aggressivo ai contratti pubblici dei moduli più fragili (fatture/acquisti), così la Fase 2 si chiude senza anticipare la Fase 3.

## v12.35 (Refactoring UI – Fase 2B cauta)
- **Estratto \`tax-render.js\`**: le simulazioni fiscali UI (Ordinario e Quadro LM) e i filtri anno dedicati non vivono più direttamente in \`js/ui/ui-render.js\`.
- **Approccio prudente**: \`ui-render.js\` mantiene solo wrapper difensivi che delegano a \`window.TaxRender\`, così il bootstrap legacy e i richiami globali esistenti continuano a funzionare senza cambiare contratto.
- **Ordine script aggiornato**: \`index.html\` carica ora \`js/ui/tax-render.js\` prima di \`ui-render.js\`, riducendo il peso del renderer generale senza toccare ancora le aree più fragili di fatture e acquisti.

## v12.34 (Refactoring UI – Fase 2A rifinitura)
- **Helper UI condivisi**: aggiunto \`js/ui/ui-regime-helpers.js\` per centralizzare accesso a \`companyInfo\`, capability del regime fiscale e visibilità UI.
- **Orchestrazione più leggibile**: \`renderAll()\` in \`js/ui/ui-render.js\` è stato rifinito in step chiari (\`renderMasterDataArea\`, \`renderPurchasesArea\`, \`renderSalesArea\`, \`renderAnalysisArea\`) invece di mantenere un unico blocco procedurale.
- **Moduli 2A uniformati**: \`company-render\`, \`navigation-visibility\`, \`scadenziario-render\` e \`dashboard-render\` usano ora helper condivisi, con meno dipendenze dirette da \`globalData\` e dalla policy richiamata in modo sparso.

## v12.33 (Refactoring UI – Fase 2A)

- **Estratto \`navigation-visibility.js\`**: la gestione della visibilità di menu, sezioni e filtri dipendenti dal regime fiscale non è più definita dentro \`ui-render.js\`.
- **Estratto \`company-render.js\`**: il rendering della form azienda è stato isolato in un modulo dedicato.
- **Estratto \`scadenziario-render.js\`**: il rendering della pagina scadenziario è stato separato dal renderer generale.
- **Estratto \`dashboard-render.js\`**: dashboard mensile/annuale, statistiche e simulazione fiscale lato UI sono stati spostati in un modulo dedicato.
- **\`renderAll()\` alleggerito**: \`js/ui/ui-render.js\` rimane l’orchestratore di alto livello, ma non contiene più direttamente queste aree di rendering.
- **\`index.html\` aggiornato**: caricati i nuovi moduli UI prima di \`ui-render.js\` per mantenere compatibilità e ordine di bootstrap.

# Changelog (principali aggiunte)

Questo changelog riassume le implementazioni introdotte negli ultimi step fino alla versione “stabile”.

## v12.32 (Tax Regime Policy – chiusura Fase 1)
- **Costanti di dominio**: introdotto \`js/core/domain-constants.js\` con costanti centralizzate per regime fiscale, codici RF, nature IVA documento e default aziendali.
- **Bonifica fallback residui**: gli ultimi punti ancora legati a controlli diretti su \`taxRegime\` ora passano dalla policy (\`company-module\`, \`ui-render\`).
- **Stringhe fiscali duplicate ridotte**: moduli fattura e XML riallineati all'uso di costanti condivise per \`N2.2\`, default IVA e tipi documento più sensibili.
- **Base più coerente per Fase 2**: la chiusura della Fase 1 lascia il dominio fiscale centralizzato e pronto per iniziare lo smontaggio di \`ui-render.js\`.

## v12.31 (Tax Regime Policy – fase 4)
- **UI visibility centralizzata**: aggiunto \`getUiVisibility()\` nella policy per guidare menu, sezioni azienda e scadenziario senza controlli sparsi nel renderer.
- **Ripulitura moduli legacy**: rimossi altri fallback diretti a \`isForfettario()/isOrdinario()\` in \`ui-render\`, \`company-module\`, \`navigation\`, \`customers\`, \`products\`, \`invoice-form\`, \`invoice-list\`, \`invoice-calc\` e import Timesheet.
- **Renderer più pulito**: \`ui-render.js\` usa ora helper locali capability/UI-visibility-first, preparando il distacco progressivo delle regole di dominio dal rendering.

## v12.30 (Tax Regime Policy – fase 3)
- **Modulo dedicato**: estratta la policy in \`js/core/tax-regime-policy.js\`, separando il dominio fiscale da \`utils.js\`.
- **Compatibilità legacy**: \`utils.js\` mantiene solo i wrapper globali (\`getResolvedTaxRegime\`, \`isForfettario\`, \`isOrdinario\`, ecc.) che delegano alla policy.
- **Capability-first esteso**: aggiornati render iniziale, navigation e anagrafica prodotti per usare capability/default della policy invece di controlli sparsi.
- **Base per step successivi**: il layer ora è pronto per essere riusato da moduli minori e da eventuali test unitari.

## v12.29 (Tax Regime Policy – fase 2)
- **Capability-first UI**: navigation e \`updateCompanyUI()\` ora decidono tramite capability della policy (\`canManagePurchases\`, \`canManageSuppliers\`, \`canUseVatRegisters\`, \`canUseLmSimulation\`, \`canUseOrdinarioSimulation\`) invece di confronti diretti sul regime.
- **Scadenziario centralizzato**: la visibilità dei filtri pagamenti acquisti / IVA passa da \`getScadenziarioVisibility()\` della policy.
- **Pulizia moduli**: ridotti ulteriormente i fallback manuali su \`taxRegime\` nei punti più sensibili (\`company-module\`, \`navigation-module\`, \`ui-render\`, \`invoices-form-module\`).
- **Nuovo aggregatore capability**: aggiunto \`TaxRegimePolicy.getCapabilities()\` per fornire un oggetto unico e coerente alle aree UI.

## v12.27 (Stampa fattura: layout tipografico)
- **Dettaglio/Stampa fattura**: rifinita la tabella righe con larghezze colonna più stabili tra descrizione e valori numerici.
- **Importi**: colonne **Prezzo** e **Totale** ora mantengono il valore in una sola riga (\`€\` + importo senza a capo).
- **Tipografia**: migliorati allineamento numerico, spaziature verticali e resa in stampa/PDF per un layout più pulito.

## v12.25 (Fatture: descrizione righe editabile)
- **Nuova/Modifica fattura**: resa **editabile** la cella *Descrizione* delle righe documento (anche righe importate da Timesheet) tramite edit inline (textarea).
- **Nota**: le fatture in stato **Inviata** restano non modificabili (comportamento invariato).

## v12.24 (Tema scuro: bottoni più leggibili)
- **UI Dark Mode**: aumentato il contrasto dei pulsanti *outline* (\`btn-outline-secondary\`, \`btn-outline-dark\`) e dei bottoni \`btn-dark\` per garantire leggibilità su sfondo scuro.

## v12.23 (Forfettario: Gestione Dati)
- **Impostazioni → Gestione Dati**: in regime **Forfettario** è nascosta la sezione “Elimina Acquisti per Anno”, perché gli acquisti non sono gestiti.

## v12.22 (Forfettario: prefisso descrizione import Timesheet)
- **Anagrafica clienti**: aggiunto campo "Prefisso descrizione import Timesheet (solo Forfettario)".
- **Import ore in fattura**: in regime **Forfettario**, il testo di testa della riga importata può essere personalizzato per cliente (es. "Area di docenza") oppure lasciato vuoto (nessun prefisso). In ordinario il comportamento resta invariato.

## v12.21 (Bollo cliente & Forfettario UI)
- **Forfettario: menu acquisti nascosto**: rimossa la sezione “Fatture di Acquisto” dalla sidebar quando il regime gestionale è Forfettario.
- **Flag cliente Bollo a carico studio**: nuova opzione in anagrafica clienti per non addebitare i 2€ in fattura (Totale Documento invariato), mantenendo comunque l’indicazione del bollo nel file XML.
- **Override sul documento**: il flag viene salvato sul documento (fattura/nota) e ha priorità rispetto all’anagrafica cliente durante calcoli e generazione XML.

## v12.20 (Commesse UI)
- **Allineamento Tabella Commesse**: corretta la generazione righe per rispettare l’intestazione (niente colonne “fantasma”).
- **Colonna “Fatturo a”**: assegnata larghezza più ampia con testo su una riga, ellissi e tooltip (title) per nomi lunghi.

## v12.19 (Timesheet UX)
- **Formattazione Orari Timesheet**: Aggiornato il formato di visualizzazione delle ore da "H / M" a "HH:mm" (es. "03:10") per una migliore leggibilità.
- **Modifica Worklog**: Migliorata l'esperienza di modifica: cliccando su "Modifica", la pagina scorre automaticamente in cima e il focus viene portato sul campo Data.

## v12.18 (Date e Statistiche)
- **Filtri Data Intelligenti**: I filtri del Timesheet (visualizzazione ed export) ora propongono di default il periodo dal 1° del mese corrente fino alla **data odierna** (invece di fine mese).
- **Fix Fuso Orario**: Risolto un problema tecnico nella generazione delle date di default che in alcuni casi causava lo slittamento al giorno precedente.
- **Statistiche Dashboard**: Corretto il calcolo delle ore "Cliente Finale" nei KPI e nelle tabelle: ora i valori a 0 vengono correttamente conteggiati come tali.
- **Totali Progetti**: Aggiunta la colonna "Ore CF Tot" nella tabella Anagrafica Progetti per una rapida consultazione del monte ore lavorato per progetto.

## v12.17 (Fix Timesheet Update & CF Logic)
- **Fix Update Worklog**: Risolto bug critico che impediva il salvataggio delle modifiche ai worklog esistenti (i dati non venivano persistiti correttamente).
- **Data Preservation**: Ora l'aggiornamento preserva correttamente tutti i campi del worklog (inclusi i collegamenti alle fatture \`invoiceId\`).
- **Logica Ore Cliente Finale**: Migliorata la gestione dei campi "Ore CF" e "Minuti CF". Il sistema ora rispetta i valori inseriti manualmente dall'utente (anche se 0), evitando sovrascritture indesiderate con i valori principali, pur mantenendo il sync automatico di default.

## v12.16 (Documentazione Dinamica & Sync)
- **Documentazione Dinamica**: I manuali non sono più cablati nel codice JavaScript. L'app carica ora i file \`.md\` direttamente dalla cartella \`DOCUMENTAZIONE\`.
- **Script di Sincronizzazione**: Introdotto \`aggiorna_manuali.py\` (e \`.ps1\`) per generare automaticamente il bundle JavaScript per l'uso offline o su altri dispositivi.
- **Fallback Intelligente**: Sistema di caricamento ibrido (Fetch + Fallback) per garantire il funzionamento dei manuali in ogni ambiente di esecuzione.

## v12.15 (Portale Documentazione Interattivo)
- **Nuovo Visualizzatore**: Trasformazione del manuale in un'app-nella-app. L'indice (\`00_INDICE.md\`) funge da menu principale interattivo.
- **Navigazione Avanzata**: Supporto per link interni tra file Markdown e pulsante dinamico "Torna all'Indice".
- **Filtro Intelligente**: La sezione Changelog è esclusa automaticamente dall'indice del manuale per una consultazione più pulita.
- **Titoli Dinamici**: L'area documentazione aggiorna il titolo in base alla sezione visualizzata.

## v12.14 (Dark Mode Premium & Sidebar Restruct)
### UI/UX Refinement
- **Dark Mode Premium**: revisione profonda dei contrasti. Eliminati i "blocchi bianchi" (background \`bg-light\`) in testate fatture, riepiloghi e sezione Versione.
- **Contrasti**: migliorata la leggibilità di breadcrumb, testi secondari (\`text-muted\`) e campi di sola lettura (\`form-control-plaintext\`).
- **Uniformità Tabelle**: 
  - **Zebra Striping**: applicato universalmente (Light/Dark) per una scansione dati ottimale.
  - **Header & Footer**: testate e righe totali/footer ora sono in **grassetto** con colori di sfondo distinti dal corpo tabella.
  - **Fix Dark Mode**: rimosso lo sfondo bianco indesiderato sulle testate in modalità scura.

### Sidebar & Navigazione
- **Ristrutturazione Menu**: 
  - Voce **Scadenziario** spostata sotto la sezione **Analisi**.
  - Sezione **Analisi** riposizionata dopo le Fatture di Acquisto per un flusso di lavoro più logico.

## v12.13 (Sidebar Restyle & In-App Docs)
### Sidebar & UI/UX
- **Ristrutturazione Menu**: Sezione "Documenti" divisa in **Fatture di Vendita** (Vendite) e **Fatture di Acquisto** (Acquisti/Scadenziario).
- **Iconografia**: Aggiunte icone a tutte le intestazioni di sezione per una navigazione più intuitiva.
- **Controlli Globali**: Pulsanti **Espandi** e **Comprimi** tutto integrati nella riga "Home".
- **Stabilità Layout**: Fissata larghezza sidebar a 260px con \`scrollbar-gutter: stable\` per evitare restringimenti su Windows.
- **Custom Scrollbar**: Stilizzata la barra di scorrimento del menu con i colori del tema (\`#2c3e50\`) per un look più premium.

### Documentazione
- **Asset Bundling**: Manuale e Changelog ora integrati direttamente nel codice (\`docs-content.js\`).
- **Zero Configuration**: Eliminata la necessità di server locali o file \`.bat\` per la consultazione dei manuali.
- **Accesso Rapido**: Manuale e Versione accessibili istantaneamente dalla sezione **Info**.

## v12.11 (Binding Timesheet-Fatture e Progetti)
### Timesheet / Fatture
- **Binding Worklog-Fattura**: lo stato "Fatturato" dei worklog viene ora aggiornato solo al salvataggio definitivo della fattura.
- **Riconoscimento automatico**: durante l'importazione ore, il sistema riconosce i worklog già collegati ad altre fatture per evitare duplicationi.
- **Sincronizzazione cancellazione**: eliminando una riga fattura, il relativo worklog viene sbloccato; eliminando l'intera fattura, tutti i worklog collegati tornano disponibili.

### Progetti
- **Spostamento Dati**: i campi **Codice Progetto** e **Cliente finale** sono stati spostati dall'anagrafica Commesse ai singoli Progetti per una gestione più granulare.
- **Miglioramento UI**: popolamento automatico del selettore "Cliente finale" nella modale di creazione/modifica progetto.
- **Consistenza**: le tabelle dei progetti ora mostrano direttamente il codice e il cliente finale associato.

## v11.08 (Stable Cloud)
### Gestione Dati (ex Migrazione)
- Rinomina “Migrazione” → **Gestione Dati**.
- **Backup dal Cloud**: esportazione JSON completa (companyInfo + tutte le collezioni).
- **Importa Backup JSON**: import “merge” (aggiorna per ID, non cancella record extra).
- **Ripristino totale (Reset + Import)** con doppia conferma (prompt \`ELIMINA\`).
- **Reset totale dati (Reset classe)** con doppia conferma e cancellazione di:
  - tutte le collezioni principali
  - **tutti i doc in \`settings/*\`** (anche futuri)
- Eliminazioni parziali:
  - **Elimina Documenti per anno** (fatture/NC)
  - **Elimina Acquisti per anno**

### Impostazioni
- **Uso dati (stima)**: tabella + progress bar su 1 GiB (Spark), basata su dimensione JSON dei dati.

### Acquisti
- **Importa XML** (FatturaPA fornitore) nel form Nuovo Acquisto:
  - parsing header/body
  - creazione fornitore con conferma se mancante
  - precompilazione righe e scadenze (se presenti)

### Timesheet / Export CSV
- Esportazione CSV migliorata:
  - date in formato italiano \`gg/mm/aaaa\`
  - rimozione newline e sequenze \`\\n\` dai campi testo
  - ordine colonne: \`Date|EndCustomer|BillToCustomer|Commessa|Project|Minutes|Hours|Billable\`
- Fix popolamento combo filtri (Fatturo a / Commessa / Progetto) all’apertura pagina Export.

### Migliorie UX
- Forzato refresh delle select anno all’apertura della pagina Gestione Dati.

### Dashboard
- Aggiunta pagina **Dashboard** con selettore **Annuale/Mensile**.
- KPI principali: **Ore timesheet totali**, **Ore fatturabili**, **Ore già fatturate**, **N. worklog**.
- Tabelle: dettaglio mensile/giornaliero e Top Progetti/Commesse per ore fatturabili.

## v12.03 (Step39 – Progetti/Timesheet Cliente Finale)
### Progetti
- Aggiunti **Codice Progetto** e **Cliente finale** sul Progetto (non più in Commessa).
- In modale Progetto: quando selezioni un **Servizio**, eredita **tariffa** e flag **Lavoro/Costo** (modificabili).

### Timesheet
- Gestione doppia durata:
  - **Minutes / Hours** = ore da fatturare alla commessa (Fatturo a)
  - **FinalMinutes / FinalHours** = ore valorizzate per il **cliente finale** (di default uguali alle ore commessa)
- Note in timesheet supportano input **multiriga**.
- In modifica worklog, il form torna in testata e porta il focus sui campi principali.

### Export Timesheet
- Aggiunte colonne: **ProjectCode**, **FinalMinutes**, **FinalHours**.
- Nel pivot Giorno+Commessa aggiunti: **FinalTotalMinutes** e **FinalTotalHours**.

### Dashboard
- KPI e tabelle mostrano anche il confronto **Cliente finale (CF)**.
- In Top Commesse/Progetti, la colonna “Cliente finale” è derivata dai Progetti/Worklog del periodo.`,

    "11_DASHBOARD": `# Dashboard (Annuale / Mensile)

La **Dashboard** è una pagina di riepilogo pensata per dare, a colpo d’occhio, lo stato dell’attività in un periodo selezionato.

## A cosa serve
- Visualizzare **Ore timesheet totali** e **Ore fatturabili** (prioritarie in un contesto didattico).
- Identificare rapidamente i **progetti** e le **commesse** più rilevanti per ore.
- Vedere un dettaglio **mensile** (in modalità annuale) o **giornaliero** (in modalità mensile).

## Dove si trova
Menu laterale: **Dashboard**.

## Periodo
In alto trovi i controlli:
- **Periodo**: \`Annuale\` oppure \`Mensile\`.
- **Anno**: selezionabile in base agli anni presenti nei dati (fatture, acquisti, worklog) + anno corrente.
- **Mese**: visibile solo in modalità \`Mensile\`.
- **Aggiorna**: forza il ricalcolo e l’aggiornamento della pagina.

## KPI (card)
Le card KPI mostrano:
- **Ore totali**: somma di tutti i worklog nel periodo.
- **Ore fatturabili**: somma dei worklog con flag \`Fatturabile\` attivo.
- **Ore già fatturate** (indicatore di supporto): worklog collegati a una fattura (\`invoiceId\` presente).
- **N. worklog**: numero di righe timesheet nel periodo.

> Nota: nel progetto il “Timesheet” è derivato dai **worklog**. Quindi, per ripristinare/analizzare le ore, è sufficiente che i worklog siano presenti.

## Tabelle sotto ai KPI
### 1) Dettaglio periodo (Timesheet)
- In **Annuale**: tabella per **mese** con ore totali, ore fatturabili e percentuale.
- In **Mensile**: tabella per **giorno** con ore totali, ore fatturabili e percentuale.

### 2) Top Progetti (ore fatturabili)
Mostra i 10 progetti con più ore fatturabili nel periodo:
- Progetto
- Commessa
- Ore totali
- Ore fatturabili
- % fatturabili

### 3) Top Commesse (ore fatturabili)
Mostra le 10 commesse con più ore fatturabili nel periodo:
- Commessa
- End Customer
- Fatturo a
- Ore totali
- Ore fatturabili
- % fatturabili

## Regole e definizioni
- **Ore totali** = somma di \`minutes\` / 60.
- **Ore fatturabili** = somma di \`minutes\` dei worklog con \`billable !== false\`.
- **Ore già fatturate** = somma di \`minutes\` dei worklog che hanno \`invoiceId\` valorizzato.

`,

    "12_GUIDA_F24_FISCALITA": `# Guida F24 e dati dichiarativi annuali

Questa guida spiega come usare i dati forniti dal commercialista per rendere più realistica la simulazione fiscale del regime forfettario.

> La funzione è didattica e di confronto. Non sostituisce il prospetto ufficiale del commercialista, il modello Redditi o la delega F24.

---

## 1. Prima distinzione: anno redditi e anno versamento

Quando ricevi i documenti per la dichiarazione, è normale trovare insieme dati riferiti ad anni diversi.

Esempio tipico:

- dichiarazione presentata nel **2026**;
- redditi prodotti nel **2025**;
- saldo/conguaglio del **2025**;
- acconti dovuti per il **2026**.

Nel gestionale devi partire dall’**anno redditi**. Se stai verificando la dichiarazione 2026 sui redditi 2025, nella pagina **Fiscalità** seleziona **2025**.

---

## 2. Dove inserire i dati

Percorso:

**Fiscalità → Simulazione Fiscale (Quadro LM + Quadro RR/PXX)**

1. Seleziona un anno specifico nel campo **Anno**.
2. Apri, se serve, il pulsante **Help compilazione F24**.
3. Compila il blocco **Dati dichiarativi annuali**.
4. Premi **Salva e ricalcola**.

I dati vengono salvati in modo separato per anno. Questo evita che un acconto del 2026 venga applicato per errore al 2024 o al 2025.

---

## 3. Quadro LM — Imposta sostitutiva

Usa questa sezione per i valori fiscali del regime forfettario.

| Campo FAC | Documento sorgente | Cosa inserire |
|---|---|---|
| **LM35 contributi deducibili versati** | Quadro LM/prospetto commercialista | Contributi previdenziali effettivamente versati e dedotti nell’anno redditi. |
| **Acconti imposta già versati** | Prospetto commercialista/F24 anno precedente | Acconti dell’imposta sostitutiva già versati per l’anno redditi. |
| **Crediti/compensazioni imposta** | Prospetto commercialista | Eventuali crediti o compensazioni che riducono il saldo. |
| **Saldo F24 imposta 1792** | Modello F24, se presente | Saldo imposta sostitutiva dell’anno redditi. È un dato di confronto. |

### Codici F24 principali per LM

| Codice | Significato operativo nel gestionale |
|---|---|
| **1792** | Saldo imposta sostitutiva dell’anno redditi. |
| **1790** | Acconto prima rata dell’anno successivo. |
| **1791** | Acconto seconda rata o unica soluzione dell’anno successivo. |

Se stai visualizzando il **2025**, i codici **1790** e **1791** riferiti al **2026** vanno nei campi **Acconti anno successivo 2026**. Il gestionale li salva sull’anno 2026.

---

## 4. Quadro RR / INPS — causale PXX

Questa sezione serve per confrontare la simulazione previdenziale con i dati INPS/F24 del commercialista.

Nel modello F24 guarda la **Sezione INPS** e le righe con causale **PXX**.

Il campo più importante è il **periodo di riferimento**:

| Periodo F24 | Come interpretarlo |
|---|---|
| **01/2025–12/2025** | Saldo/conguaglio relativo all’anno redditi 2025. |
| **01/2026–12/2026** | Acconto INPS relativo all’anno successivo 2026. |

| Campo FAC | Documento sorgente | Cosa inserire |
|---|---|---|
| **Contributi RR/PXX già versati per l’anno** | Quadro RR/prospetto commercialista | Contributi/acconti già considerati per l’anno redditi. Riduce il saldo RR/PXX stimato. |
| **Saldo F24 PXX anno redditi** | F24, riga PXX con periodo dell’anno selezionato | Importo PXX del saldo/conguaglio dell’anno redditi. Serve per confronto. |
| **PXX acconto INPS 1ª rata** | F24, riga PXX anno successivo, scadenza estiva | Prima rata di acconto INPS dell’anno successivo. |
| **PXX acconto INPS 2ª rata** | F24/riepilogo commercialista, scadenza novembre | Seconda rata di acconto INPS dell’anno successivo. |

Se il commercialista non ti fornisce il valore “contributi già versati per l’anno”, puoi usarlo solo come dato ricostruito:

**Contributi INPS stimati FAC − Saldo F24 PXX anno redditi**

Questa ricostruzione è utile per simulazione e confronto, ma il valore ufficiale resta quello del prospetto del commercialista.

---

## 5. Esempio operativo

Dichiarazione 2026 sui redditi 2025.

1. Vai in **Fiscalità**.
2. Seleziona **Anno 2025**.
3. In **Quadro LM** inserisci i dati del prospetto LM, in particolare LM35 se disponibile.
4. In **Quadro RR / PXX** inserisci il saldo PXX con periodo 01/2025–12/2025.
5. Nel blocco **Acconti anno successivo 2026** inserisci:
   - codice 1790, se presente;
   - codice 1791, se presente;
   - PXX prima rata 2026;
   - PXX seconda rata 2026.
6. Premi **Salva e ricalcola**.

Quando in futuro aprirai il **2024**, il gestionale userà solo eventuali dati dichiarativi del 2024. Quando aprirai il **2026**, troverai gli acconti salvati per il 2026.

---

## 6. Riporto assistito degli acconti nell’anno successivo

Gli acconti inseriti come **anno successivo** vengono salvati sull’anno di competenza.

Esempio:
- mentre guardi il **2025**, inserisci 1790, 1791 e PXX relativi al **2026**;
- FAC li salva nell’anno **2026**;
- quando selezioni **2026**, FAC mostra un riquadro che propone di riportarli nei campi già versati.

Il riporto è sempre manuale:

| Pulsante | Cosa fa | Dove copia |
|---|---|---|
| **Usa per acconti imposta 2026** | Somma 1790 + 1791 | **Acconti imposta già versati** |
| **Usa per contributi RR/PXX 2026** | Somma le rate PXX | **Contributi RR/PXX già versati per l’anno** |

Dopo aver premuto il pulsante controlla i valori e premi **Salva e ricalcola**.

Il gestionale non applica mai questi importi in automatico, per evitare doppio conteggio se il commercialista fornisce un prospetto aggiornato o se hai già inserito manualmente gli stessi valori.

---

## 7. Formato degli importi

I campi accettano importi con punto o virgola decimale.

Esempi validi:

- \`1513.52\`
- \`1513,52\`
- \`1.513,52\`

Il gestionale normalizza questi valori al salvataggio.

---

## 8. Riquadro Versamenti stimati FAC

Dopo aver salvato i dati dichiarativi annuali, la pagina Fiscalità aggiorna il riquadro **Versamenti stimati FAC**.

Il riquadro mostra una lettura sintetica dei valori operativi:

| Voce | Da dove arriva |
|---|---|
| Saldo imposta sostitutiva anno redditi | saldo stimato FAC o codice F24 1792 se inserito |
| Saldo RR/PXX anno redditi | saldo stimato FAC o riga PXX dell’anno redditi se inserita |
| Acconti imposta anno successivo | stima FAC o codici 1790/1791 inseriti |
| Acconti RR/PXX anno successivo | stima FAC o righe PXX dell’anno successivo inserite |
| Scadenze tipiche | somma riepilogativa dei valori di giugno e novembre |

Se vedi il badge **F24 inserito**, il valore arriva dai dati del commercialista che hai salvato. Se vedi **stima FAC**, il valore è calcolato dal gestionale in modo didattico.

---

## 9. Cosa non viene modificato

L’inserimento dei dati dichiarativi annuali non modifica:

- fatture;
- note di credito;
- XML;
- Timesheet;
- clienti/fornitori;
- dashboard;
- regime ordinario.

Serve solo a migliorare il confronto della pagina **Fiscalità** con F24, Quadro LM e Quadro RR/prospetto INPS del commercialista.
`,
  };
})();