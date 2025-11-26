// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCuGd5MSKdixcMYOYullnyam6Pj1D9tNbM",
  authDomain: "fprf-6c080.firebaseapp.com",
  projectId: "fprf-6c080",
  storageBucket: "fprf-6c080.firebasestorage.app",
  messagingSenderId: "406236428222",
  appId: "1:406236428222:web:3be6b3b8530ab20ba36bef"
};

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Stato Globale
let globalData = {
    companyInfo: {},
    products: [],
    customers: [],
    invoices: [],
    notes: []
};
let currentUser = null;