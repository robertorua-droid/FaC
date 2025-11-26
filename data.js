// Gestione Dati (Cloud e Cache)

async function loadAllDataFromCloud() {
    try {
        const companyDoc = await db.collection('settings').doc('companyInfo').get();
        if (companyDoc.exists) globalData.companyInfo = companyDoc.data();

        const collections = ['products', 'customers', 'invoices', 'notes'];
        for (const col of collections) {
            const snapshot = await db.collection(col).get();
            globalData[col] = snapshot.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
        }
        console.log("Dati sincronizzati:", globalData);
    } catch (e) {
        console.error("Errore Load Cloud:", e);
    }
}

async function saveDataToCloud(collection, dataObj, id = null) {
    try {
        if (collection === 'companyInfo') {
            await db.collection('settings').doc('companyInfo').set(dataObj);
            globalData.companyInfo = dataObj;
        } else {
            if (id) {
                const strId = String(id);
                await db.collection(collection).doc(strId).set(dataObj, { merge: true });
                const index = globalData[collection].findIndex(item => String(item.id) === strId);
                if (index > -1) globalData[collection][index] = { ...globalData[collection][index], ...dataObj };
                else globalData[collection].push({ id: strId, ...dataObj });
            } else {
                console.error("ID mancante");
            }
        }
    } catch (e) {
        alert("Errore Cloud: " + e.message);
    }
}

async function deleteDataFromCloud(collection, id) {
    if (confirm("Sei sicuro di voler eliminare?")) {
        try {
            const strId = String(id);
            await db.collection(collection).doc(strId).delete();
            globalData[collection] = globalData[collection].filter(item => String(item.id) !== strId);
            renderAll();
        } catch (e) {
            alert("Errore eliminazione: " + e.message);
        }
    }
}

function getData(key) { return globalData[key] || []; }