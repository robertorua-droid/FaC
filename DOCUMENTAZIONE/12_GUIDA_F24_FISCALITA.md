# Guida F24 e dati dichiarativi annuali

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

## 6. Formato degli importi

I campi accettano importi con punto o virgola decimale.

Esempi validi:

- `1513.52`
- `1513,52`
- `1.513,52`

Il gestionale normalizza questi valori al salvataggio.

---

## 7. Riquadro Versamenti stimati FAC

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

## 8. Cosa non viene modificato

L’inserimento dei dati dichiarativi annuali non modifica:

- fatture;
- note di credito;
- XML;
- Timesheet;
- clienti/fornitori;
- dashboard;
- regime ordinario.

Serve solo a migliorare il confronto della pagina **Fiscalità** con F24, Quadro LM e Quadro RR/prospetto INPS del commercialista.
