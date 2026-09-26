// =====================================================================
// admin-auth.js — simple hardcoded check, no Firebase Auth involved.
// =====================================================================

import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./admin-config.js";

const form = document.getElementById('adminLoginForm');
const errorEl = document.getElementById('adminLoginError');

function showError(message) {
	errorEl.textContent = message;
	errorEl.style.display = 'block';
}

form.addEventListener('submit', e => {
	e.preventDefault();
	errorEl.style.display = 'none';

	const email = document.getElementById('adminEmail').value.trim();
	const password = document.getElementById('adminPassword').value;

	if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
		window.location.href = 'admin.html';
	} else {
		showError('Incorrect email or password.');
	}
});
