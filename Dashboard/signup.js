// =====================================================================
// signup.js — creates a real user account in Firebase Authentication
// =====================================================================

import { auth } from "./auth.js";
import {
	createUserWithEmailAndPassword, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const form = document.getElementById('signupForm');
const errorEl = document.getElementById('signupError');

function showError(message) {
	errorEl.textContent = message;
	errorEl.style.display = 'block';
}

form.addEventListener('submit', async e => {
	e.preventDefault();
	errorEl.style.display = 'none';

	const name = document.getElementById('signupName').value.trim();
	const email = document.getElementById('signupEmail').value.trim();
	const password = document.getElementById('signupPassword').value;

	const submitBtn = form.querySelector('button[type="submit"]');
	submitBtn.disabled = true;
	submitBtn.textContent = 'Creating account…';

	try {
		const credential = await createUserWithEmailAndPassword(auth, email, password);
		// Save the person's name onto their Firebase Auth profile
		await updateProfile(credential.user, { displayName: name });

		// Success — send them to the storefront, now logged in
		window.location.href = 'thrift.html';
	} catch (err) {
		submitBtn.disabled = false;
		submitBtn.textContent = 'Sign Up';

		// Firebase error codes -> friendly messages
		if (err.code === 'auth/email-already-in-use') {
			showError('An account with this email already exists. Try logging in instead.');
		} else if (err.code === 'auth/weak-password') {
			showError('Password should be at least 6 characters.');
		} else if (err.code === 'auth/invalid-email') {
			showError('Please enter a valid email address.');
		} else {
			showError('Something went wrong: ' + err.message);
		}
	}
});
