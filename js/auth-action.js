// ============================================================
// Handles the links in Barque+ emails:
//   ...auth-action.html?mode=verifyEmail&oobCode=...
//   ...auth-action.html?mode=resetPassword&oobCode=...
// Firebase adds mode and oobCode (a one-time code) to the link.
// ============================================================
import { loadFirebase } from './firebase.js';

const MIN_PASSWORD_LENGTH = 6;
const $ = (id) => document.getElementById(id);

function show(heading, note) {
  $('actionHeading').textContent = heading;
  $('actionNote').hidden = !note;
  $('actionNote').textContent = note || '';
}

function fail(message) {
  show('Something went wrong');
  $('actionError').textContent = message;
  $('homeLink').hidden = false;
}

function messageFor(error) {
  const code = (error && error.code) || '';
  if (code === 'auth/expired-action-code') return 'This link has expired. Go back to Barque+ and ask for a new one.';
  if (code === 'auth/invalid-action-code') return 'This link was already used or is not valid. Go back to Barque+ and ask for a new one.';
  if (code === 'auth/weak-password') return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (code === 'auth/network-request-failed') return 'Could not reach Firebase. Check your internet connection.';
  return (error && error.message) || 'Something went wrong.';
}

async function start() {
  const params = new URLSearchParams(location.search);
  const actionMode = params.get('mode');
  const code = params.get('oobCode');

  if (!actionMode || !code) {
    fail('This page only works from a link in a Barque+ email.');
    return;
  }

  let fb;
  try {
    fb = await loadFirebase();
  } catch (e) {
    fail('Could not reach Firebase. The network may be blocking www.gstatic.com.');
    return;
  }
  const { auth, authApi } = fb;

  // ----- Verify email -----
  if (actionMode === 'verifyEmail') {
    try {
      await authApi.applyActionCode(auth, code);
      show('Email verified!',
        'Go back to the Barque+ tab and click "I\'ve clicked the link", or open Barque+ below and log in.');
      $('homeLink').hidden = false;
    } catch (e) {
      fail(messageFor(e));
    }
    return;
  }

  // ----- Reset password -----
  if (actionMode === 'resetPassword') {
    let email;
    try {
      email = await authApi.verifyPasswordResetCode(auth, code);
    } catch (e) {
      fail(messageFor(e));
      return;
    }

    show('Choose a new password', `For ${email}`);
    $('resetForm').hidden = false;
    $('newPassword').focus();

    $('resetForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = $('newPassword').value;
      const confirm = $('newConfirm').value;
      const error = $('resetError');
      error.textContent = '';

      if (password.length < MIN_PASSWORD_LENGTH) { error.textContent = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`; return; }
      if (password !== confirm) { error.textContent = 'Passwords do not match.'; return; }

      $('resetBtn').disabled = true;
      try {
        await authApi.confirmPasswordReset(auth, code, password);
        $('resetForm').hidden = true;
        show('Password changed!', 'You can now log in with your new password.');
        $('homeLink').hidden = false;
      } catch (e) {
        error.textContent = messageFor(e);
      }
      $('resetBtn').disabled = false;
    });
    return;
  }

  fail('This kind of link isn\'t used by Barque+.');
}

start();
