// =====================================================================
// admin-auth.js — logs an admin in, but ONLY lets one specific email
// through. Everyone else gets signed back out and shown an error.
// =====================================================================

import { auth } from "./auth.js";
import { ADMIN_EMAIL } from "./admin-config.js";
import {
	signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const form = document.getElementById('adminLoginForm');
const errorEl = document.getElementById('adminLoginError');

function showError(message) {
	errorEl.textContent = message;
	errorEl.style.display = 'block';
}

form.addEventListener('submit', async e => {
	e.preventDefault();
	errorEl.style.display = 'none';

	const email = document.getElementById('adminEmail').value.trim();
	const password = document.getElementById('adminPassword').value;

	const submitBtn = form.querySelector('button[type="submit"]');
	submitBtn.disabled = true;
	submitBtn.textContent = 'Logging in…';

	try {
		const credential = await signInWithEmailAndPassword(auth, email, password);

		if (credential.user.email !== ADMIN_EMAIL) {
			// Correct password, wrong account — this person is not the admin.
			await signOut(auth);
			showError('This account does not have admin access.');
			submitBtn.disabled = false;
			submitBtn.textContent = 'Login as Admin';
			return;
		}

		window.location.href = 'admin.html';
	} catch (err) {
		submitBtn.disabled = false;
		submitBtn.textContent = 'Login as Admin';

		if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
			showError('Incorrect email or password.');
		} else if (err.code === 'auth/invalid-email') {
			showError('Please enter a valid email address.');
		} else {
			showError('Something went wrong: ' + err.message);
		}
	}
});
