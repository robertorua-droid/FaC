// firebase-cloud.js
// Inizializzazione Firebase + funzioni Cloud (Firestore/Auth)

function initFirebase() {

        if (typeof firebase === 'undefined') {
            alert("ERRORE CRITICO: Firebase non caricato. Controlla la connessione internet.");
            return false;
        }

        try {
            const firebaseConfig = {
              apiKey: "AIzaSyCuGd5MSKdixcMYOYullnyam6Pj1D9tNbM",
              authDomain: "fprf-6c080.firebaseapp.com",
              projectId: "fprf-6c080",
              storageBucket: "fprf-6c080.firebasestorage.app",
              messagingSenderId: "406236428222",
              appId: "1:406236428222:web:3be6b3b8530ab20ba36bef"
            };

            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            auth = firebase.auth();
            console.log("Firebase connesso.");
            return true;

        } catch (error) {
            console.error("Firebase Error:", error);
            alert("Errore connessione Database: " + error.message);
            return false;
        }

        // =========================================================
}


// 2. GESTIONE DATI CLOUD (MULTI-UTENTE)
    // =========================================================

    async function loadAllDataFromCloud() {
        if (!currentUser) {
            console.warn("loadAllDataFromCloud chiamato senza utente.");
            return;
        }

        try {
            const userRef = getUserDocRef();

            // 1) settings/companyInfo
            const companyDoc = await userRef.collection('settings').doc('companyInfo').get();
            if (companyDoc.exists) {
                globalData.companyInfo = companyDoc.data();
            } else {
                globalData.companyInfo = {};
            }

            // 2) Altre collezioni: products, customers, invoices, notes
            const collections = ['products', 'customers', 'suppliers', 'purchases', 'invoices', 'notes', 'commesse', 'projects', 'worklogs'];
            for (const col of collections) {
                const snapshot = await userRef.collection(col).get();
                globalData[col] = snapshot.docs.map(doc => ({
                    id: String(doc.id),
                    ...doc.data()
                }));
            }

            console.log("Dati sincronizzati per utente:", currentUser.uid, globalData);
        } catch (e) {
            console.error("Errore Load Cloud:", e);
            throw e;
        }
    }

    async function saveDataToCloud(collection, dataObj, id = null) {
        if (!currentUser) {
            alert("Utente non autenticato.");
            return;
        }
        try {
            const userRef = getUserDocRef();

            if (collection === 'companyInfo') {
                await userRef.collection('settings').doc('companyInfo').set(dataObj, { merge: true });
                globalData.companyInfo = { ...(globalData.companyInfo || {}), ...dataObj };
            } else {
                if (!id) {
                    console.error("ID mancante per salvataggio in", collection);
                    return;
                }
                const strId = String(id);
                await userRef.collection(collection).doc(strId).set(dataObj, { merge: true });

                if (!globalData[collection]) globalData[collection] = [];
                const index = globalData[collection].findIndex(item => String(item.id) === strId);
                if (index > -1) {
                    globalData[collection][index] = { ...globalData[collection][index], ...dataObj };
                } else {
                    globalData[collection].push({ id: strId, ...dataObj });
                }
            }
        } catch (e) {
            console.error("Errore Cloud:", e);
            alert("Errore Cloud: " + e.message);
        }
    }

    // Salvataggio batch (utile per aggiornamenti multipli come worklog -> fattura)
    // updates: [{ id: '1', data: { ... } }, ...]
    async function batchSaveDataToCloud(collection, updates) {
        if (!currentUser) {
            alert('Utente non autenticato.');
            return;
        }
        if (!collection) return;
        const list = Array.isArray(updates) ? updates : [];
        if (!list.length) return;

        try {
            const userRef = getUserDocRef();
            const batch = db.batch();

            list.forEach(u => {
                if (!u || u.id == null) return;
                const strId = String(u.id);
                const dataObj = u.data || {};
                const docRef = userRef.collection(collection).doc(strId);
                batch.set(docRef, dataObj, { merge: true });

                // aggiorna anche globalData (in memoria)
                if (!globalData[collection]) globalData[collection] = [];
                const idx = globalData[collection].findIndex(it => String(it.id) === strId);
                if (idx > -1) {
                    globalData[collection][idx] = { ...globalData[collection][idx], ...dataObj };
                } else {
                    globalData[collection].push({ id: strId, ...dataObj });
                }
            });

            await batch.commit();
        } catch (e) {
            console.error('Errore batch Cloud:', e);
            alert('Errore batch Cloud: ' + e.message);
        }
    }


    async function deleteDataFromCloud(collection, id) {
        if (!currentUser) {
            alert("Utente non autenticato.");
            return;
        }

        if (!confirm("Sei sicuro di voler eliminare questo elemento?")) return;

        try {
            const userRef = getUserDocRef();
            const strId = String(id);
            await userRef.collection(collection).doc(strId).delete();

            if (globalData[collection]) {
                globalData[collection] = globalData[collection].filter(item => String(item.id) !== strId);
            }
            renderAll();
        } catch (e) {
            console.error("Errore eliminazione:", e);
            alert("Errore eliminazione: " + e.message);
        }
    }

    // =========================================================

window.initFirebase = initFirebase;
window.batchSaveDataToCloud = batchSaveDataToCloud;
