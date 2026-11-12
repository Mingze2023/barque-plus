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

// Loads Firebase and returns:
//   app        the Firebase app
//   db         the Barque+ database
//   auth       the login system
//   firestore  Firebase's database functions (doc, getDoc, setDoc, ...)
//   authApi    Firebase's login functions (signInWithEmailAndPassword, ...)
// Throws an Error whose .stage says what failed: 'library' or 'config'.
export async function loadFirebase() {
  let appModule, firestore, authApi;
  try {
    [appModule, firestore, authApi] = await Promise.all([
      import(`${BASE}/firebase-app.js`),
      import(`${BASE}/firebase-firestore.js`),
      import(`${BASE}/firebase-auth.js`),
    ]);
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
  const auth = authApi.getAuth(app);
  return { app, db, auth, firestore, authApi };
}
