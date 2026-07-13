// =====================================================================
// login.js — signs a user into their real Firebase account
// =====================================================================

import { auth } from "./auth.js";
import {
	signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');

function showError(message) {
	errorEl.textContent = message;
	errorEl.style.display = 'block';
}

form.addEventListener('submit', async e => {
	e.preventDefault();
	errorEl.style.display = 'none';

	const email = document.getElementById('loginEmail').value.trim();
	const password = document.getElementById('loginPassword').value;

	const submitBtn = form.querySelector('button[type="submit"]');
	submitBtn.disabled = true;
	submitBtn.textContent = 'Logging in…';

	try {
		await signInWithEmailAndPassword(auth, email, password);
		window.location.href = 'thrift.html';
	} catch (err) {
		submitBtn.disabled = false;
		submitBtn.textContent = 'Login';

		if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
			showError('Incorrect email or password.');
		} else if (err.code === 'auth/invalid-email') {
			showError('Please enter a valid email address.');
		} else {
			showError('Something went wrong: ' + err.message);
		}
	}
});
