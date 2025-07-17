// --- firebase-config.js (FINAL, CORRECTED VERSION) ---

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
// --- ADD onAuthStateChanged to this import line ---
import { getAuth, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  writeBatch, 
  doc,
  updateDoc,
  orderBy, 
  limit, 
  startAfter,
  getDocsFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
const auth = getAuth(app);

// Set persistence on the auth object, this part is correct!
setPersistence(auth, browserLocalPersistence);

// Export the configured auth object
export { auth }; 

// Export all other functions
export { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  writeBatch, 
  doc, 
  updateDoc,
  orderBy, 
  limit, 
  startAfter,
  getDocsFromServer,
  signInWithEmailAndPassword,
  onAuthStateChanged // --- ADD onAuthStateChanged to the export list ---
};