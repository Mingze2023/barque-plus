// ============================================================
// Connects the website to Firebase. Every page uses this file.
// Firebase's code is loaded straight from Google (www.gstatic.com),
// so nothing has to be installed.
// ============================================================
import { firebaseConfig, FIREBASE_VERSION } from './firebase-config.js';

const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

// True once the PASTE_HERE placeholders in firebase-config.js are replaced
export function isConfigFilledIn() {
  return Object.values(firebaseConfig).every(v => v && !String(v).includes('PASTE_HERE'));
}

// Loads Firebase and returns { app, db, firestore }.
//   db        = the Barque+ database
//   firestore = Firebase's database functions (addDoc, collection, ...)
// Throws an Error whose .stage says what failed: 'library' or 'config'.
export async function loadFirebase() {
  let appModule, firestore;
  try {
    appModule = await import(`${BASE}/firebase-app.js`);
    firestore = await import(`${BASE}/firebase-firestore.js`);
  } catch (e) {
    const err = new Error('Could not download Firebase from www.gstatic.com.');
    err.stage = 'library';
    throw err;
  }

  if (!isConfigFilledIn()) {
    const err = new Error('js/firebase-config.js still has PASTE_HERE placeholders.');
    err.stage = 'config';
    throw err;
  }

  const app = appModule.initializeApp(firebaseConfig);
  const db = firestore.getFirestore(app);
  return { app, db, firestore };
}
