// =====================================================================
// admin-gate.js — real Firebase Auth login, shown right on admin.html.
// The dashboard markup stays hidden until the person signs in AND
// their email matches ADMIN_EMAIL. The actual password is checked by
// Firebase's servers — it never appears anywhere in this code.
// =====================================================================

import { auth } from "./auth.js";
import { ADMIN_EMAIL } from "./admin-config.js";
import {
	signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const overlay = document.getElementById('adminGateOverlay');
const shell = document.getElementById('adminShell');
const form = document.getElementById('adminGateForm');
const errorEl = document.getElementById('adminGateError');
const logoutBtn = document.getElementById('adminLogoutBtn');

function unlock() {
	overlay.classList.remove('open');
	overlay.style.display = 'none';
	shell.style.display = '';
}

function lock() {
	overlay.classList.add('open');
	overlay.style.display = '';
	shell.style.display = 'none';
}

function showError(message) {
	errorEl.textContent = message;
	errorEl.style.display = 'block';
}

// Already signed in as the admin from an earlier visit? Skip the form.
onAuthStateChanged(auth, user => {
	if (user && user.email === ADMIN_EMAIL) {
		unlock();
	}
});

form.addEventListener('submit', async e => {
	e.preventDefault();
	errorEl.style.display = 'none';

	const email = document.getElementById('adminGateEmail').value.trim();
	const password = document.getElementById('adminGatePassword').value;

	const submitBtn = form.querySelector('button[type="submit"]');
	submitBtn.disabled = true;
	submitBtn.textContent = 'Logging in…';

	try {
		const credential = await signInWithEmailAndPassword(auth, email, password);

		if (credential.user.email !== ADMIN_EMAIL) {
			// Correct password, wrong account — not the admin.
			await signOut(auth);
			showError('This account does not have admin access.');
			lock();
		} else {
			unlock();
		}
	} catch (err) {
		if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
			showError('Incorrect email or password.');
		} else if (err.code === 'auth/invalid-email') {
			showError('Please enter a valid email address.');
		} else {
			showError('Something went wrong: ' + err.message);
		}
	} finally {
		submitBtn.disabled = false;
		submitBtn.textContent = 'Login';
	}
});

logoutBtn.addEventListener('click', async () => {
	await signOut(auth);
	form.reset();
	lock();
});
