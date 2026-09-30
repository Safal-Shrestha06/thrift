// ===================== Firebase =====================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
	getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { verifyEsewaResponse } from "./esewa.js";

const firebaseConfig = {
	apiKey: "AIzaSyC8P6Ws_QBB3cXmdPjTQx1jGVqD8PYCYOw",
	authDomain: "thriftstore01.firebaseapp.com",
	projectId: "thriftstore01",
	storageBucket: "thriftstore01.firebasestorage.app",
	messagingSenderId: "904619736486",
	appId: "1:904619736486:web:d153c192f51a168e09a367",
	measurementId: "G-K2XFJ7V9WF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const productsCol = collection(db, "products");
const ordersCol = collection(db, "orders");
const adsCol = collection(db, "ads");

// ===================== Mock data (users / orders / activity stay local for now) =====================

const AVATAR_COLORS = ['#f8bb00', '#ffd873', '#f2a65a', '#e8c07d', '#f6dd8b'];
function avatarColor(seed) {
	// works for both numeric ids and Firestore string ids
	const num = typeof seed === 'string'
		? [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
		: seed;
	return AVATAR_COLORS[num % AVATAR_COLORS.length];
}
function initials(name) {
	return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function formatStatusLabel(status) {
	return (status || '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

// listings and orders now come from Firestore in real time (see onSnapshot below)
let listings = [];
let orders = [];

const activity = [
	{ text: '<strong>Bikash Thapa</strong> submitted a new listing "Cotton Kurtha Set" for review', time: '12 minutes ago' },
	{ text: '<strong>Anisha Rai\'s</strong> listing "Leather Ankle Boots" was flagged by a buyer', time: '48 minutes ago' },
	{ text: '<strong>Kiran Gurung\'s</strong> account was suspended for policy violations', time: '2 hours ago' },
	{ text: '<strong>Prakriti Adhikari</strong> completed checkout for order TS-10234', time: '3 hours ago' },
	{ text: '<strong>Sujata Karki</strong> joined as a new seller', time: '5 hours ago' },
];

const weekSales = [
	{ day: 'Mon', amt: 4200 },
	{ day: 'Tue', amt: 3100 },
	{ day: 'Wed', amt: 5400 },
	{ day: 'Thu', amt: 4800 },
	{ day: 'Fri', amt: 6700 },
	{ day: 'Sat', amt: 8900 },
	{ day: 'Sun', amt: 7300 },
];

// ===================== Nav switching =====================

document.querySelectorAll('.admin-nav-item').forEach(btn => {
	btn.addEventListener('click', () => {
		document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
		btn.classList.add('active');
		const view = btn.dataset.view;
		document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
		document.getElementById('view-' + view).classList.add('active');
	});
});

// ===================== Stat cards =====================

function renderStats() {
	const totalProducts = listings.length;
	const liveListings = listings.filter(l => l.status === 'live').length;
	const totalSales = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.amount, 0);
	const flagged = listings.filter(l => l.status === 'flagged').length;

	const stats = [
		{ label: 'Total Products', value: totalProducts, delta: '+3 today', up: true },
		{ label: 'Live Listings', value: liveListings, delta: 'Visible to shoppers', up: true },
		{ label: 'Sales (7 days)', value: 'Rs ' + totalSales.toLocaleString(), delta: '+14.6%', up: true },
		{ label: 'Flagged Items', value: flagged, delta: 'Needs review', up: false },
	];

	document.getElementById('statGrid').innerHTML = stats.map(s => `
		<div class="stat-card">
			<div class="stat-label">${s.label}</div>
			<div class="stat-value">${s.value}</div>
			<div class="stat-delta ${s.up ? 'up' : 'down'}">${s.up ? '▲' : '●'} ${s.delta}</div>
		</div>
	`).join('');
}

// ===================== Bar chart =====================

function renderBarChart() {
	const max = Math.max(...weekSales.map(d => d.amt));
	const todayIndex = weekSales.length - 1;
	document.getElementById('barChart').innerHTML = weekSales.map((d, i) => `
		<div class="bar-col">
			<div class="bar ${i === todayIndex ? 'today' : ''}" style="height:${(d.amt / max) * 100}%"></div>
			<span>${d.day}</span>
		</div>
	`).join('');
}

// ===================== Donut chart =====================

const CATEGORY_COLORS = { Women: '#f8bb00', Men: '#f2a65a', Kid: '#ffe0a3', More: '#1f1f23' };

function renderDonut() {
	if (listings.length === 0) {
		document.getElementById('donutChart').innerHTML = '';
		document.getElementById('donutLegend').innerHTML = '<li>No products yet</li>';
		return;
	}

	const counts = {};
	listings.forEach(l => { counts[l.category] = (counts[l.category] || 0) + 1; });
	const total = listings.length;
	const breakdown = Object.entries(counts).map(([label, count]) => ({
		label,
		value: Math.round((count / total) * 100),
		color: CATEGORY_COLORS[label] || '#ccc',
	}));

	const r = 55, cx = 70, cy = 70, circumference = 2 * Math.PI * r;
	let offset = 0;
	const circles = breakdown.map(c => {
		const dash = (c.value / 100) * circumference;
		const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.color}" stroke-width="18"
			stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`;
		offset += dash;
		return circle;
	}).join('');
	document.getElementById('donutChart').innerHTML = circles;

	document.getElementById('donutLegend').innerHTML = breakdown.map(c => `
		<li><span class="swatch" style="background:${c.color}"></span> ${c.label} <strong style="margin-left:auto">${c.value}%</strong></li>
	`).join('');
}

// ===================== Activity feed =====================

function renderActivity() {
	document.getElementById('activityList').innerHTML = activity.map(a => `
		<div class="activity-item">
			<span class="activity-dot"></span>
			<div>
				<p>${a.text}</p>
				<time>${a.time}</time>
			</div>
		</div>
	`).join('');
}

// ===================== Listings table =====================

let listingFilter = 'all';
let listingSearchTerm = '';

function renderListings() {
	const filtered = listings.filter(l => {
		const matchesFilter = listingFilter === 'all' || l.status === listingFilter;
		const matchesSearch = l.item.toLowerCase().includes(listingSearchTerm.toLowerCase());
		return matchesFilter && matchesSearch;
	});

	document.getElementById('listingCount').textContent = `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`;

	document.getElementById('listingsTableBody').innerHTML = filtered.map(l => `
		<tr>
			<td>
				<div class="cell-user">
					<div class="item-thumb" style="background:${l.image ? `url('${l.image}') center/cover` : avatarColor(l.id)}"></div>
					<div class="name">${l.item}</div>
				</div>
			</td>
			<td>${l.seller}</td>
			<td>${l.category}</td>
			<td>Rs ${l.price.toLocaleString()}</td>
			<td><span class="status-pill status-${l.status}">${formatStatusLabel(l.status)}</span></td>
			<td>
				<div class="row-actions">
					${(l.status === 'pending' || l.status === 'flagged') ? `<button data-action="approve" data-id="${l.id}">Approve</button>` : ''}
					${l.status === 'live' ? `<button data-action="out-of-stock" data-id="${l.id}">Mark Out of Stock</button>` : ''}
					${l.status === 'out_of_stock' ? `<button data-action="in-stock" data-id="${l.id}">Mark In Stock</button>` : ''}
					<button data-action="edit" data-id="${l.id}">Edit</button>
					<button class="danger" data-action="remove" data-id="${l.id}">Remove</button>
				</div>
			</td>
		</tr>
	`).join('');
}

document.getElementById('listingFilters').addEventListener('click', e => {
	if (e.target.matches('.filter-pill')) {
		document.querySelectorAll('#listingFilters .filter-pill').forEach(p => p.classList.remove('active'));
		e.target.classList.add('active');
		listingFilter = e.target.dataset.filter;
		renderListings();
	}
});

document.getElementById('listingSearch').addEventListener('input', e => {
	listingSearchTerm = e.target.value;
	renderListings();
});

document.getElementById('listingsTableBody').addEventListener('click', async e => {
	const btn = e.target.closest('button');
	if (!btn) return;
	const id = btn.dataset.id;

	if (btn.dataset.action === 'approve') {
		await updateDoc(doc(db, 'products', id), { status: 'live' });
	}

	if (btn.dataset.action === 'out-of-stock') {
		await updateDoc(doc(db, 'products', id), { status: 'out_of_stock' });
		showToast('Marked out of stock');
	}

	if (btn.dataset.action === 'in-stock') {
		await updateDoc(doc(db, 'products', id), { status: 'live' });
		showToast('Marked back in stock');
	}

	if (btn.dataset.action === 'edit') {
		openProductModal(listings.find(x => x.id === id));
	}

	if (btn.dataset.action === 'remove') {
		openDeleteModal(id);
	}
});

// ===================== Photo upload helper =====================
// Picks a photo from the computer, shrinks it in the browser and turns it
// into a small JPEG "data URL" that is stored in the product's `image`
// field in Firestore — no Firebase Storage setup needed. Works everywhere
// the storefront already shows product.image.

const MAX_PHOTO_DIMENSION = 900;        // px, longest side
const MAX_PHOTO_BYTES = 200 * 1024;     // target size after compression

function loadImageFromFile(file) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
		img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
		img.src = url;
	});
}

async function fileToCompressedDataUrl(file, maxDim = MAX_PHOTO_DIMENSION, maxBytes = MAX_PHOTO_BYTES) {
	if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
	if (file.size > 15 * 1024 * 1024) throw new Error('That image is too large (max 15 MB)');

	const img = await loadImageFromFile(file);
	const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(img.width * scale));
	canvas.height = Math.max(1, Math.round(img.height * scale));
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#fff'; // PNGs with transparency -> white background in JPEG
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

	let quality = 0.85;
	let dataUrl = canvas.toDataURL('image/jpeg', quality);
	while (dataUrl.length * 0.75 > maxBytes && quality > 0.4) {
		quality -= 0.1;
		dataUrl = canvas.toDataURL('image/jpeg', quality);
	}
	return dataUrl;
}

// ===================== Product modal (Add / Edit) =====================

const productModalOverlay = document.getElementById('productModalOverlay');
const productForm = document.getElementById('productForm');
const modalTitle = document.getElementById('modalTitle');

let uploadedProductImage = null; // compressed data URL from the file picker (or an existing uploaded photo)

function openProductModal(product) {
	productForm.reset();
	uploadedProductImage = null;
	document.getElementById('productImagePreview').style.display = 'none';
	document.getElementById('productImageRemoveBtn').style.display = 'none';
	if (product) {
		modalTitle.textContent = 'Edit Product';
		document.getElementById('productId').value = product.id;
		document.getElementById('productName').value = product.item;
		// Uploaded photos are data URLs — keep them out of the URL box
		if (product.image && product.image.startsWith('data:')) {
			uploadedProductImage = product.image;
		} else {
			document.getElementById('productImage').value = product.image || '';
		}
		document.getElementById('productSeller').value = product.seller;
		document.getElementById('productCategory').value = product.category;
		document.getElementById('productPrice').value = product.price;
		document.getElementById('productStatus').value = product.status;
		document.getElementById('productCondition').value = product.condition || 'Good';
		document.getElementById('productDescription').value = product.description || '';
		if (product.image) showImagePreview(product.image);
	} else {
		modalTitle.textContent = 'Add Product';
		document.getElementById('productId').value = '';
		document.getElementById('productStatus').value = 'pending';
		document.getElementById('productCondition').value = 'Good';
	}
	productModalOverlay.classList.add('open');
	document.getElementById('productName').focus();
}

function showImagePreview(url) {
	const img = document.getElementById('productImagePreview');
	img.src = url;
	img.style.display = 'block';
	document.getElementById('productImageRemoveBtn').style.display = 'inline-block';
}

function clearProductImage() {
	uploadedProductImage = null;
	document.getElementById('productImage').value = '';
	document.getElementById('productImageFile').value = '';
	document.getElementById('productImagePreview').style.display = 'none';
	document.getElementById('productImageRemoveBtn').style.display = 'none';
}

document.getElementById('productImageRemoveBtn').addEventListener('click', clearProductImage);

document.getElementById('productImageFile').addEventListener('change', async e => {
	const file = e.target.files[0];
	if (!file) return;
	try {
		uploadedProductImage = await fileToCompressedDataUrl(file);
		document.getElementById('productImage').value = ''; // the uploaded photo wins over a pasted URL
		showImagePreview(uploadedProductImage);
	} catch (err) {
		e.target.value = '';
		showToast(err.message);
	}
});

document.getElementById('productImage').addEventListener('input', e => {
	const url = e.target.value.trim();
	const img = document.getElementById('productImagePreview');
	if (url) {
		uploadedProductImage = null;
		document.getElementById('productImageFile').value = '';
		showImagePreview(url);
	} else if (!uploadedProductImage) {
		img.style.display = 'none';
		document.getElementById('productImageRemoveBtn').style.display = 'none';
	}
});

document.getElementById('productImagePreview').addEventListener('error', () => {
	document.getElementById('productImagePreview').style.display = 'none';
});

function closeProductModal() {
	productModalOverlay.classList.remove('open');
}

document.getElementById('addProductBtn').addEventListener('click', () => openProductModal(null));
document.getElementById('modalCloseBtn').addEventListener('click', closeProductModal);
document.getElementById('modalCancelBtn').addEventListener('click', closeProductModal);
productModalOverlay.addEventListener('click', e => {
	if (e.target === productModalOverlay) closeProductModal();
});

productForm.addEventListener('submit', async e => {
	e.preventDefault();
	const id = document.getElementById('productId').value;
	const data = {
		item: document.getElementById('productName').value.trim(),
		image: uploadedProductImage || document.getElementById('productImage').value.trim(),
		seller: document.getElementById('productSeller').value.trim(),
		category: document.getElementById('productCategory').value,
		price: Number(document.getElementById('productPrice').value),
		status: document.getElementById('productStatus').value,
		condition: document.getElementById('productCondition').value,
		description: document.getElementById('productDescription').value.trim(),
	};

	try {
		if (id) {
			await updateDoc(doc(db, 'products', id), data);
			showToast('Product updated');
		} else {
			await addDoc(productsCol, data);
			showToast('Product added');
		}
		closeProductModal();
	} catch (err) {
		console.error(err);
		showToast('Something went wrong — check console');
	}
	// no manual re-render needed — onSnapshot below updates the table live
});

// ===================== Delete confirm modal =====================

const deleteModalOverlay = document.getElementById('deleteModalOverlay');
let pendingDeleteId = null;

function openDeleteModal(id) {
	const product = listings.find(x => x.id === id);
	pendingDeleteId = id;
	document.getElementById('deleteModalText').textContent = `"${product.item}" will be permanently removed. This can't be undone.`;
	deleteModalOverlay.classList.add('open');
}

function closeDeleteModal() {
	deleteModalOverlay.classList.remove('open');
	pendingDeleteId = null;
}

document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
deleteModalOverlay.addEventListener('click', e => {
	if (e.target === deleteModalOverlay) closeDeleteModal();
});

document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
	try {
		await deleteDoc(doc(db, 'products', pendingDeleteId));
		showToast('Product removed');
	} catch (err) {
		console.error(err);
		showToast('Something went wrong — check console');
	}
	closeDeleteModal();
	// no manual re-render needed — onSnapshot below updates the table live
});

// ===================== Toast =====================

let toastTimer;
function showToast(msg) {
	const toast = document.getElementById('toast');
	toast.textContent = msg;
	toast.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ===================== Orders table =====================

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'];

// eSewa payments: re-check the stored response so the admin can see
// whether it is genuine (valid signature, COMPLETE, matches this order).
const esewaChecks = {}; // orderId -> true | false (cached)

async function checkEsewaOrder(o) {
	const r = o.esewaResponse;
	return !!r
		&& await verifyEsewaResponse(r)
		&& r.status === 'COMPLETE'
		&& r.transaction_uuid === o.id
		&& Number(String(r.total_amount).replace(/,/g, '')) === Number(o.amount);
}

function paymentCell(o) {
	if (o.paymentMethod === 'esewa') {
		const ref = o.esewaTransactionCode ? `<div style="font-size:0.75rem; color:var(--muted)">Ref ${o.esewaTransactionCode}</div>` : '';
		const c = esewaChecks[o.id];
		const verdict = c === undefined
			? `<div style="font-size:0.75rem; color:var(--muted)" data-esewa-check="${o.id}">Checking…</div>`
			: (c
				? `<div style="font-size:0.75rem; color:#1b8a5a" data-esewa-check="${o.id}">✓ Signature verified</div>`
				: `<div style="font-size:0.75rem; color:#c94b4b" data-esewa-check="${o.id}">⚠ Could not verify — check eSewa</div>`);
		return `<span class="status-pill ${o.paymentStatus === 'paid' ? 'status-active' : 'status-pending'}">eSewa ${o.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}</span>${ref}${verdict}`;
	}
	if (o.paymentMethod === 'cod') {
		return `<span class="status-pill status-pending">Cash on delivery</span>`;
	}
	return '<span style="color:var(--muted)">—</span>';
}

function runEsewaChecks() {
	orders.filter(o => o.paymentMethod === 'esewa' && esewaChecks[o.id] === undefined).forEach(async o => {
		esewaChecks[o.id] = await checkEsewaOrder(o);
		const el = document.querySelector(`[data-esewa-check="${o.id}"]`);
		if (el) {
			el.style.color = esewaChecks[o.id] ? '#1b8a5a' : '#c94b4b';
			el.textContent = esewaChecks[o.id] ? '✓ Signature verified' : '⚠ Could not verify — check eSewa';
		}
	});
}

// Only cancelled orders can be selected / deleted (multi-select).
const selectedOrderIds = new Set();

function updateOrderSelectionUI() {
	const cancelled = orders.filter(o => (o.status || 'pending') === 'cancelled');
	// forget selections for orders that were deleted or are no longer cancelled
	[...selectedOrderIds].forEach(id => {
		if (!cancelled.some(o => o.id === id)) selectedOrderIds.delete(id);
	});

	const btn = document.getElementById('deleteSelectedOrdersBtn');
	btn.textContent = `Delete selected (${selectedOrderIds.size})`;
	btn.style.display = selectedOrderIds.size ? 'inline-block' : 'none';

	const all = document.getElementById('ordersSelectAll');
	all.disabled = cancelled.length === 0;
	all.checked = cancelled.length > 0 && selectedOrderIds.size === cancelled.length;
	all.indeterminate = selectedOrderIds.size > 0 && selectedOrderIds.size < cancelled.length;
}

function renderOrders() {
	if (orders.length === 0) {
		updateOrderSelectionUI();
		document.getElementById('ordersTableBody').innerHTML =
			`<tr><td colspan="8" style="color:var(--muted); text-align:center; padding:24px">No orders yet — orders placed at checkout on your storefront will show up here.</td></tr>`;
		return;
	}

	document.getElementById('ordersTableBody').innerHTML = orders.map(o => {
		const itemsSummary = (o.items || []).map(i => `${i.item} ×${i.qty}`).join(', ');
		const currentStatus = o.status || 'pending';

		// New orders need an explicit admin confirmation before anything
		// else — the status dropdown only appears once an order is past
		// "pending", so customers can never skip that confirmation step.
		const isCancelled = currentStatus === 'cancelled';
		const actionCell = currentStatus === 'pending'
			? `<button class="btn-add" data-confirm-order="${o.id}">Confirm Order</button>`
			: (() => {
				const options = ORDER_STATUSES.map(s =>
					`<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${formatStatusLabel(s)}</option>`
				).join('');
				const deleteBtn = isCancelled
					? ` <button type="button" class="btn-danger" style="border:0; cursor:pointer; padding:8px 14px;" data-delete-order="${o.id}">Delete</button>`
					: '';
				return `<select class="status-select" data-order-id="${o.id}">${options}</select>${deleteBtn}`;
			})();

		return `
			<tr>
				<td>${isCancelled ? `<input type="checkbox" data-select-order="${o.id}" aria-label="Select order ${o.id.slice(0, 8)}" ${selectedOrderIds.has(o.id) ? 'checked' : ''} />` : ''}</td>
				<td>${o.id.slice(0, 8)}</td>
				<td>${o.buyer || o.buyerEmail || 'Unknown'}</td>
				<td>${itemsSummary || '—'}</td>
				<td>Rs ${Number(o.amount || 0).toLocaleString()}</td>
				<td>${paymentCell(o)}</td>
				<td><span class="status-pill status-${currentStatus}">${formatStatusLabel(currentStatus)}</span></td>
				<td>${actionCell}</td>
			</tr>
		`;
	}).join('');
	updateOrderSelectionUI();
	runEsewaChecks();
}

async function deleteCancelledOrders(ids) {
	// safety: only ever delete orders that are cancelled right now
	const targets = ids.filter(id => orders.find(o => o.id === id && (o.status || 'pending') === 'cancelled'));
	if (targets.length === 0) return;

	const msg = targets.length === 1
		? 'Permanently delete this cancelled order? This cannot be undone.'
		: `Permanently delete ${targets.length} cancelled orders? This cannot be undone.`;
	if (!confirm(msg)) return;

	const results = await Promise.allSettled(targets.map(id => deleteDoc(doc(db, 'orders', id))));
	const failed = results.filter(r => r.status === 'rejected');
	failed.forEach(r => console.error(r.reason));
	targets.forEach((id, i) => { if (results[i].status === 'fulfilled') selectedOrderIds.delete(id); });

	if (failed.length === 0) {
		showToast(targets.length === 1 ? 'Order deleted' : `${targets.length} orders deleted`);
	} else {
		showToast(`Deleted ${targets.length - failed.length}, could not delete ${failed.length} — check Firestore rules`);
	}
	updateOrderSelectionUI();
}

document.getElementById('deleteSelectedOrdersBtn').addEventListener('click', () => {
	deleteCancelledOrders([...selectedOrderIds]);
});

document.getElementById('ordersSelectAll').addEventListener('change', e => {
	const cancelled = orders.filter(o => (o.status || 'pending') === 'cancelled');
	selectedOrderIds.clear();
	if (e.target.checked) cancelled.forEach(o => selectedOrderIds.add(o.id));
	renderOrders();
});

document.getElementById('ordersTableBody').addEventListener('change', e => {
	const box = e.target.closest('[data-select-order]');
	if (!box) return;
	if (box.checked) selectedOrderIds.add(box.dataset.selectOrder);
	else selectedOrderIds.delete(box.dataset.selectOrder);
	updateOrderSelectionUI();
});

document.getElementById('ordersTableBody').addEventListener('click', e => {
	const delBtn = e.target.closest('[data-delete-order]');
	if (delBtn) deleteCancelledOrders([delBtn.dataset.deleteOrder]);
});

document.getElementById('ordersTableBody').addEventListener('click', async e => {
	const confirmBtn = e.target.closest('[data-confirm-order]');
	if (!confirmBtn) return;
	try {
		await updateDoc(doc(db, 'orders', confirmBtn.dataset.confirmOrder), { status: 'confirmed' });
		showToast('Order confirmed');
	} catch (err) {
		console.error(err);
		showToast('Could not confirm order — check console');
	}
});

document.getElementById('ordersTableBody').addEventListener('change', async e => {
	const select = e.target.closest('[data-order-id]');
	if (!select) return;
	try {
		await updateDoc(doc(db, 'orders', select.dataset.orderId), { status: select.value });
		showToast('Order status updated');
	} catch (err) {
		console.error(err);
		showToast('Could not update order — check console');
	}
});

// ===================== Ads =====================

let ads = [];

function formatPlacementLabel(placement) {
	return placement === 'hero' ? 'Hero Banner' : 'Page Banner';
}

function renderAdsTable() {
	document.getElementById('adCount').textContent = `${ads.length} ad${ads.length !== 1 ? 's' : ''}`;

	document.getElementById('adsTableBody').innerHTML = ads.length
		? ads.map(a => `
			<tr>
				<td>
					<div class="cell-user">
						<div class="item-thumb" style="background:${a.image ? `url('${a.image}') center/cover` : avatarColor(a.id)}"></div>
						<div class="name">${a.title}</div>
					</div>
				</td>
				<td>${formatPlacementLabel(a.placement)}</td>
				<td><span class="status-pill status-${a.status === 'active' ? 'active' : 'inactive'}">${a.status === 'active' ? 'Active' : 'Inactive'}</span></td>
				<td>
					<div class="row-actions">
						<button data-action="edit-ad" data-id="${a.id}">Edit</button>
						<button class="danger" data-action="remove-ad" data-id="${a.id}">Remove</button>
					</div>
				</td>
			</tr>
		`).join('')
		: `<tr><td colspan="4" style="color:var(--muted); text-align:center; padding:24px">No ads yet — add one to publish the homepage hero banner or a page banner.</td></tr>`;
}

document.getElementById('adsTableBody').addEventListener('click', e => {
	const btn = e.target.closest('button');
	if (!btn) return;
	const id = btn.dataset.id;

	if (btn.dataset.action === 'edit-ad') {
		openAdModal(ads.find(x => x.id === id));
	}
	if (btn.dataset.action === 'remove-ad') {
		openAdDeleteModal(id);
	}
});

// ===================== Ad modal (Add / Edit) =====================

const adModalOverlay = document.getElementById('adModalOverlay');
const adForm = document.getElementById('adForm');
const adModalTitle = document.getElementById('adModalTitle');
const adHeroFields = document.getElementById('adHeroFields');
const adPlacementSelect = document.getElementById('adPlacement');

function toggleAdHeroFields() {
	adHeroFields.style.display = adPlacementSelect.value === 'hero' ? 'grid' : 'none';
}
adPlacementSelect.addEventListener('change', toggleAdHeroFields);

let uploadedAdImage = null; // compressed data URL from the file picker

function openAdModal(ad) {
	adForm.reset();
	uploadedAdImage = null;
	document.getElementById('adImagePreview').style.display = 'none';
	if (ad) {
		adModalTitle.textContent = 'Edit Ad';
		document.getElementById('adId').value = ad.id;
		document.getElementById('adTitle').value = ad.title;
		if (ad.image && ad.image.startsWith('data:')) {
			uploadedAdImage = ad.image;
		} else {
			document.getElementById('adImage').value = ad.image || '';
		}
		document.getElementById('adLink').value = ad.link || '';
		document.getElementById('adPlacement').value = ad.placement || 'banner';
		document.getElementById('adStatus').value = ad.status || 'active';
		document.getElementById('adStatValue').value = ad.statValue || '';
		document.getElementById('adStatLabel').value = ad.statLabel || '';
		if (ad.image) showAdImagePreview(ad.image);
	} else {
		adModalTitle.textContent = 'Add Ad';
		document.getElementById('adId').value = '';
		document.getElementById('adPlacement').value = 'banner';
		document.getElementById('adStatus').value = 'active';
	}
	toggleAdHeroFields();
	adModalOverlay.classList.add('open');
	document.getElementById('adTitle').focus();
}

function showAdImagePreview(url) {
	const img = document.getElementById('adImagePreview');
	img.src = url;
	img.style.display = 'block';
}

document.getElementById('adImageFile').addEventListener('change', async e => {
	const file = e.target.files[0];
	if (!file) return;
	try {
		uploadedAdImage = await fileToCompressedDataUrl(file, 1600, 350 * 1024);
		document.getElementById('adImage').value = '';
		showAdImagePreview(uploadedAdImage);
	} catch (err) {
		e.target.value = '';
		showToast(err.message);
	}
});

document.getElementById('adImage').addEventListener('input', e => {
	const url = e.target.value.trim();
	const img = document.getElementById('adImagePreview');
	if (url) {
		uploadedAdImage = null;
		document.getElementById('adImageFile').value = '';
		showAdImagePreview(url);
	} else if (!uploadedAdImage) {
		img.style.display = 'none';
	}
});

document.getElementById('adImagePreview').addEventListener('error', () => {
	document.getElementById('adImagePreview').style.display = 'none';
});

function closeAdModal() {
	adModalOverlay.classList.remove('open');
}

document.getElementById('addAdBtn').addEventListener('click', () => openAdModal(null));
document.getElementById('adModalCloseBtn').addEventListener('click', closeAdModal);
document.getElementById('adModalCancelBtn').addEventListener('click', closeAdModal);
adModalOverlay.addEventListener('click', e => {
	if (e.target === adModalOverlay) closeAdModal();
});

adForm.addEventListener('submit', async e => {
	e.preventDefault();
	const id = document.getElementById('adId').value;
	const placement = document.getElementById('adPlacement').value;
	const adImageValue = uploadedAdImage || document.getElementById('adImage').value.trim();
	if (!adImageValue) {
		showToast('Please upload a banner image or paste an image URL');
		return;
	}

	const data = {
		title: document.getElementById('adTitle').value.trim(),
		image: adImageValue,
		link: document.getElementById('adLink').value.trim(),
		placement,
		status: document.getElementById('adStatus').value,
		// Only meaningful for hero-placement ads, but harmless to store
		// as empty strings otherwise.
		statValue: placement === 'hero' ? document.getElementById('adStatValue').value.trim() : '',
		statLabel: placement === 'hero' ? document.getElementById('adStatLabel').value.trim() : '',
	};

	try {
		if (id) {
			await updateDoc(doc(db, 'ads', id), data);
			showToast('Ad updated');
		} else {
			await addDoc(adsCol, { ...data, createdAt: new Date().toISOString() });
			showToast('Ad added');
		}
		closeAdModal();
	} catch (err) {
		console.error(err);
		showToast('Something went wrong — check console');
	}
	// no manual re-render needed — onSnapshot below updates the table live
});

// ===================== Ad delete confirm modal =====================

const adDeleteModalOverlay = document.getElementById('adDeleteModalOverlay');
let pendingAdDeleteId = null;

function openAdDeleteModal(id) {
	const ad = ads.find(x => x.id === id);
	pendingAdDeleteId = id;
	document.getElementById('adDeleteModalText').textContent = `"${ad.title}" will be permanently removed. This can't be undone.`;
	adDeleteModalOverlay.classList.add('open');
}

function closeAdDeleteModal() {
	adDeleteModalOverlay.classList.remove('open');
	pendingAdDeleteId = null;
}

document.getElementById('adDeleteCancelBtn').addEventListener('click', closeAdDeleteModal);
adDeleteModalOverlay.addEventListener('click', e => {
	if (e.target === adDeleteModalOverlay) closeAdDeleteModal();
});

document.getElementById('adDeleteConfirmBtn').addEventListener('click', async () => {
	try {
		await deleteDoc(doc(db, 'ads', pendingAdDeleteId));
		showToast('Ad removed');
	} catch (err) {
		console.error(err);
		showToast('Something went wrong — check console');
	}
	closeAdDeleteModal();
});

// ===================== Init =====================

renderStats();
renderBarChart();
renderDonut();
renderActivity();

// Live subscription to the "products" collection in Firestore.
// Runs once immediately, then again automatically every time data changes
// (add / edit / delete — from this device or any other).
onSnapshot(productsCol, snapshot => {
	listings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
	renderListings();
	renderStats();
	renderDonut();
}, err => {
	console.error('Firestore error:', err);
	showToast('Could not load products — check Firestore rules/console');
});

// Live subscription to the "orders" collection — these get created
// automatically whenever a customer checks out on thrift.html.
onSnapshot(ordersCol, snapshot => {
	orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
	renderOrders();
	renderStats();
}, err => {
	console.error('Firestore error (orders):', err);
});

// Live subscription to the "ads" collection — the storefront (thrift.js)
// reads this same collection to render the hero banner and page banners.
onSnapshot(adsCol, snapshot => {
	ads = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
	renderAdsTable();
}, err => {
	console.error('Firestore error (ads):', err);
	showToast('Could not load ads — check Firestore rules/console');
});
