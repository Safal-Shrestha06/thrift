// =====================================================================
// esewa.js — eSewa ePay v2 helpers (TEST / sandbox environment)
//
// Flow: build signed form -> redirect customer to eSewa -> eSewa
// redirects back to success_url?data=<base64 JSON> -> verify the
// signature of that response before trusting it.
//
// The values below are eSewa's PUBLIC sandbox credentials from
// developer.esewa.com.np — no real money moves in this environment.
//
// !! BEFORE GOING LIVE !!
// The secret key must never ship in browser code. For production,
// move signing + verification into a server (e.g. a Firebase Cloud
// Function), use your live merchant code/secret, and switch FORM_URL
// to https://epay.esewa.com.np/api/epay/main/v2/form
// =====================================================================

export const ESEWA_CONFIG = {
	productCode: 'EPAYTEST',
	secretKey: '8gBm/:&EnhH.1/q',
	formUrl: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
};

// Test wallet (from eSewa's test credentials page):
//   eSewa ID: 9711111111 / 9711111112 / 9711111113   Password: Test@123   MPIN: 1122
//   (verify against developer.esewa.com.np — these can change)

// Same string must be used in the form field AND in the signature.
export function formatAmount(n) {
	const num = Number(n);
	return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

// HMAC-SHA256 -> base64 (needs https:// or http://localhost)
export async function hmacBase64(message, secret = ESEWA_CONFIG.secretKey) {
	if (!window.crypto || !crypto.subtle) {
		throw new Error('Secure context required — open the site via https:// or http://localhost');
	}
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
	let bin = '';
	new Uint8Array(sig).forEach(b => { bin += String.fromCharCode(b); });
	return btoa(bin);
}

export function newTransactionUuid() {
	const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)))
		.map(b => b.toString(16).padStart(2, '0')).join('');
	return `TS-${rand}-${Date.now().toString(36)}`;
}

// Builds the signed form and submits it -> browser navigates to eSewa.
export async function redirectToEsewa({ amount, transactionUuid, successUrl, failureUrl }) {
	const total = formatAmount(amount);
	const signedFieldNames = 'total_amount,transaction_uuid,product_code';
	const signature = await hmacBase64(
		`total_amount=${total},transaction_uuid=${transactionUuid},product_code=${ESEWA_CONFIG.productCode}`
	);

	const fields = {
		amount: total,
		tax_amount: '0',
		total_amount: total,
		transaction_uuid: transactionUuid,
		product_code: ESEWA_CONFIG.productCode,
		product_service_charge: '0',
		product_delivery_charge: '0',
		success_url: successUrl,
		failure_url: failureUrl,
		signed_field_names: signedFieldNames,
		signature,
	};

	const form = document.createElement('form');
	form.method = 'POST';
	form.action = ESEWA_CONFIG.formUrl;
	Object.entries(fields).forEach(([name, value]) => {
		const input = document.createElement('input');
		input.type = 'hidden';
		input.name = name;
		input.value = value;
		form.appendChild(input);
	});
	document.body.appendChild(form);
	form.submit();
}

// Decodes the base64 `data` eSewa appends to success_url.
export function decodeEsewaResponse(dataParam) {
	try {
		// URL params can turn "+" into " " — restore before decoding
		const b64 = dataParam.replace(/ /g, '+');
		return JSON.parse(atob(b64));
	} catch {
		return null;
	}
}

// Re-computes the signature over signed_field_names (in eSewa's order,
// using the response's own values) and compares it to the one received.
export async function verifyEsewaResponse(resp) {
	if (!resp || !resp.signature || !resp.signed_field_names) return false;
	try {
		const message = resp.signed_field_names
			.split(',')
			.map(name => `${name}=${resp[name]}`)
			.join(',');
		const expected = await hmacBase64(message);
		return expected === resp.signature;
	} catch {
		return false;
	}
}
