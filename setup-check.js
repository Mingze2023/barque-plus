// ============================================================
// Step 1 setup-check page: proves the website can reach Firebase
// and save/read data. Replaced by the real site in later steps.
// ============================================================
import { loadFirebase } from './firebase.js';

function mark(id, state, text) {
  const li = document.getElementById(id);
  li.className = state; // 'ok' or 'bad'
  li.querySelector('.icon').textContent = state === 'ok' ? '✓' : '✕';
  if (text) li.querySelector('.detail').textContent = text;
}

// Turns Firebase's error codes into plain advice
function explain(error) {
  const code = error && error.code ? error.code : '';
  if (code.includes('permission-denied'))
    return 'Firebase refused (permission denied). Paste firestore.rules into Firestore > Rules and click Publish.';
  if (code.includes('not-found') || code.includes('failed-precondition'))
    return 'No database found. Create the Firestore database in the Firebase console.';
  if (code.includes('unavailable'))
    return 'Could not reach the database. The network may be blocking firestore.googleapis.com.';
  if (code.includes('invalid-api-key') || code.includes('api-key'))
    return 'The apiKey in js/firebase-config.js is wrong. Copy it again from Firebase.';
  return (error && error.message) || 'Unknown error.';
}

async function start() {
  let firebase;
  try {
    firebase = await loadFirebase();
  } catch (e) {
    if (e.stage === 'library') {
      mark('check-library', 'bad', e.message + ' The network may be blocking it.');
    } else {
      mark('check-library', 'ok', 'Loaded from www.gstatic.com.');
      mark('check-config', 'bad', e.message + ' Paste your settings from Firebase.');
    }
    return;
  }

  mark('check-library', 'ok', 'Loaded from www.gstatic.com.');
  mark('check-config', 'ok', 'Connected to project "' + firebase.app.options.projectId + '".');

  const { db, firestore } = firebase;
  const { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } = firestore;
  const messages = collection(db, 'connectionTest');

  // Live list of the 10 newest messages
  const newest = query(messages, orderBy('createdAt', 'desc'), limit(10));
  onSnapshot(newest,
    (snapshot) => {
      mark('check-database', 'ok', 'Reading works. Showing the newest messages below.');
      const list = document.getElementById('messages');
      list.innerHTML = '';
      if (snapshot.empty) {
        list.innerHTML = '<li><em>No messages yet.</em></li>';
      }
      snapshot.forEach((doc) => {
        const data = doc.data();
        const li = document.createElement('li');
        li.textContent = data.message;
        const time = document.createElement('time');
        const when = data.createdAt ? data.createdAt.toDate() : new Date();
        time.textContent = when.toLocaleString();
        li.appendChild(time);
        list.appendChild(li);
      });
      document.getElementById('testInput').disabled = false;
      document.getElementById('saveBtn').disabled = false;
    },
    (error) => mark('check-database', 'bad', explain(error))
  );

  document.getElementById('testForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('testInput');
    const errorBox = document.getElementById('saveError');
    const text = input.value.trim();
    errorBox.textContent = '';
    if (!text) return;

    try {
      await addDoc(messages, { message: text.slice(0, 100), createdAt: serverTimestamp() });
      input.value = '';
      mark('check-save', 'ok', 'Saving works. Step 1 is complete!');
    } catch (error) {
      mark('check-save', 'bad', explain(error));
      errorBox.textContent = explain(error);
    }
  });
}

start();
